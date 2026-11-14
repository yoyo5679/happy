// Public long-term care facility API. Customer ledger functionality has been retired.
type D1Result<T> = { results: T[] };
type D1Stmt = {
  bind(...v: unknown[]): D1Stmt;
  all<T = Row>(): Promise<D1Result<T>>;
  first<T = Row>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type D1 = { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> };
type Env = { DB?: D1; STAFF_PASSWORD?: string; KAKAO_REST_KEY?: string; DATA_GO_KR_KEY?: string; KAKAO_BASE?: string; DATA_GO_KR_BASE?: string };
type Ctx = { request: Request; env: Env; params: { path?: string[] } };
type Row = Record<string, unknown>;

class ServiceError extends Error {}
const asList = (v: unknown): Row[] => Array.isArray(v) ? v as Row[] : v && typeof v === "object" ? Object.values(v) as Row[] : [];
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
const fail = (status: number, error: string) => json({ error }, status);

const now = () => new Date().toISOString();
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN);

async function sha(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
async function isStaff(req: Request, env: Env) {
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !env.STAFF_PASSWORD) return false;
  const [a, b] = await Promise.all([sha(given), sha(env.STAFF_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function body(req: Request): Promise<Row> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Row) : {};
  } catch {
    return {};
  }
}


// User-requested retirement: purge only the former ledger tables, never the facility data.
const RETIRED_TABLES = ["items", "consents", "imweb_orders", "recipients", "kv"];
let cleanup: Promise<void> | null = null;
async function purgeRetiredLedger(db: D1): Promise<void> {
  return cleanup ??= (async () => {
    // Clear data before retiring the tables; tolerate schemas from older deployments.
    const placeholders = RETIRED_TABLES.map(() => "?").join(",");
    const { results: existing } = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`).bind(...RETIRED_TABLES).all();
    const present = RETIRED_TABLES.filter(name => existing.some(row => row.name === name));
    if (present.length) await db.batch(present.map(name => db.prepare(`DELETE FROM ${name}`)));
    for (const name of present) {
      const remaining = await db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).first();
      if (!remaining || Number(remaining.n) !== 0) throw new Error("Ledger cleanup incomplete");
    }
  })().catch(error => { cleanup = null; throw error; });
}
export async function onRequest({ request, env, params }: Ctx): Promise<Response> {
  const path = params.path ?? [];
  const retired = path[0] === "my" || (path[0] === "staff" && path[1] !== "ltc");
  if (retired) {
    let ledgerCleanup = env.DB ? "complete" : "no_database_binding";
    if (env.DB) { try { await purgeRetiredLedger(env.DB); } catch { ledgerCleanup = "failed"; } }
    return json({ error: "종료된 서비스입니다.", ledgerCleanup }, 410);
  }
  if (path[0] === "ltc" && path.length === 2) return ltcPublic(request, env, env.DB, path[1]);
  if (!env.DB) return fail(503, "setup:DB");
  if (path[0] === "staff" && path[1] === "ltc" && path.length === 3) {
    if (!(await isStaff(request, env))) return fail(401, "인증이 필요합니다.");
    return ltcStaff(request, env, env.DB, path[2]);
  }
  return fail(404, "없는 주소예요");
}

const LTC_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ltc (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, addr TEXT NOT NULL, sido TEXT NOT NULL, desig TEXT NOT NULL DEFAULT '',
    kinds TEXT NOT NULL, grades TEXT NOT NULL DEFAULT '{}', ptype TEXT NOT NULL DEFAULT '', cap INTEGER NOT NULL DEFAULT 0,
    ver TEXT NOT NULL DEFAULT '', lat REAL, lng REAL, geo_fail INTEGER NOT NULL DEFAULT 0, phone TEXT, phone_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ltc_lat ON ltc(lat)`,
  `CREATE INDEX IF NOT EXISTS ltc_lat_lng ON ltc(lat,lng)`,
  `CREATE INDEX IF NOT EXISTS ltc_pending_geocode ON ltc(code) WHERE lat IS NULL AND geo_fail < 2`,
];
// 나중에 붙인 칸: 법정동명(못 찾을 때 대체), 대략 위치 표시
const LTC_MIGRATIONS = [`ALTER TABLE ltc ADD COLUMN dong TEXT NOT NULL DEFAULT ''`, `ALTER TABLE ltc ADD COLUMN approx INTEGER NOT NULL DEFAULT 0`];
const LTC_KINDS = ["visit", "bath", "day", "short", "home"];

async function kakao(env: Env, path: string, q: Record<string, string>): Promise<Row> {
  if (!env.KAKAO_REST_KEY) throw new ServiceError("setup:KAKAO");
  const r = await fetch(`${env.KAKAO_BASE || "https://dapi.kakao.com"}${path}?${new URLSearchParams(q)}`, { headers: { Authorization: `KakaoAK ${env.KAKAO_REST_KEY}` } });
  const j = (await r.json().catch(() => ({}))) as Row;
  if (!r.ok) throw new ServiceError(`카카오 오류: ${String(j.message ?? j.msg ?? r.status)}`);
  return j;
}

/** 공단 주소를 카카오가 알아듣는 꼴로: 옛 지번(번지·호, 행정동[법정동]), 덧붙은 말, 건물·호수 정리 */
function addrCandidates(addr: string): string[] {
  const a0 = addr.replace(/\s+/g, " ").trim();
  const a1 = a0
    .replace(/\S+?\[(\S+?)\]/g, "$1") // 논현제1동[논현동] → 논현동
    .replace(/(\d+)\s*번지\s*(\d+)\s*호/g, "$1-$2") // 94번지 17호 → 94-17
    .replace(/(\d+)\s*번지/g, "$1")
    .replace(/\s*외\s*\d+\s*필지.*/, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .split(",")[0]
    .trim();
  const road = a1.match(/^(.*?(?:로|길)\s+\d+(?:-\d+)?)(?=\D|$)/)?.[1]; // "수명로2길 96" (로2 에서 끊기지 않게 띄어쓰기 필수)
  const jibun = a1.match(/^(.*?(?:동|리|가|읍|면)\s+(?:산\s*)?\d+(?:-\d+)?)(?=\D|$)/)?.[1];
  return [...new Set([road, jibun, a1, a0].filter((x): x is string => !!x && x.length > 6))].slice(0, 3);
}

/**
 * 주소 → 좌표. ① 주소(정리한 꼴 포함) ② 기관 이름 + 시군구로 장소 검색 ③ 법정동 중심(대략 위치)
 * 셋 다 실패하면 null
 */
async function geocode(env: Env, addr: string, name = "", dong = ""): Promise<{ lat: number; lng: number; approx: boolean } | null> {
  for (const q of addrCandidates(addr)) {
    const d = asList((await kakao(env, "/v2/local/search/address.json", { query: q, size: "1" })).documents)[0];
    if (d?.x && d?.y) return { lat: Number(d.y), lng: Number(d.x), approx: false };
  }
  const area = dong.split(" ").slice(0, 2).join(" "); // 서울특별시 은평구
  const gu = dong.split(" ")[1] ?? "";
  if (name && area) {
    const docs = asList((await kakao(env, "/v2/local/search/keyword.json", { query: `${area} ${name}`, size: "5" })).documents);
    const hit = docs.find((d) => gu && String(d.address_name ?? "").includes(gu) && String(d.place_name ?? "").replace(/\s/g, "").includes(name.replace(/\s/g, "").slice(0, 4)));
    if (hit?.x && hit?.y) return { lat: Number(hit.y), lng: Number(hit.x), approx: false };
  }
  if (dong) {
    const d = asList((await kakao(env, "/v2/local/search/address.json", { query: dong, size: "1" })).documents)[0];
    if (d?.x && d?.y) return { lat: Number(d.y), lng: Number(d.x), approx: true };
  }
  return null;
}

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

let ltcReady: Promise<unknown> | null = null;
const ltcInit = (db: D1) =>
  (ltcReady ??= (async () => {
    await db.batch(LTC_SCHEMA.map((s) => db.prepare(s)));
    for (const m of LTC_MIGRATIONS) await db.prepare(m).run().catch(() => {});
  })().catch((e) => {
    ltcReady = null;
    throw e;
  }));

// Cache public institution data only. Customer records and staff responses are never cached.
const PUBLIC_CACHE_VERSION = "ltc-public-20261109-v1";
const inFlight = new Map<string, Promise<unknown>>();
function publicCache(): Cache | undefined {
  return typeof caches === "undefined" ? undefined : (caches as unknown as { default?: Cache }).default;
}
async function cachedPublic<T>(request: Request, key: string, ttl: number, load: () => Promise<T>): Promise<{value:T; cache:string}> {
  const url = new URL(`/__ltc_cache/${PUBLIC_CACHE_VERSION}/${key}`, request.url);
  const cacheKey = new Request(url.toString());
  const cache = publicCache();
  const saved = await cache?.match(cacheKey).catch(() => undefined);
  if (saved) return { value: await saved.json() as T, cache: "HIT" };
  const pending = inFlight.get(url.toString());
  if (pending) return { value: await pending as T, cache: "SHARED" };
  const work = (async () => {
    const value = await load();
    if (cache) await cache.put(cacheKey, new Response(JSON.stringify(value), {headers: {"content-type":"application/json", "cache-control":`public, max-age=${ttl}`}})).catch(() => {});
    return value;
  })();
  inFlight.set(url.toString(),work);
  try { return {value: await work, cache:"MISS"}; } finally { inFlight.delete(url.toString()); }
}
let searchIndex: Promise<unknown> | null = null;
async function ensureSearchIndex(db: D1) {
  await (searchIndex ??= db.prepare("CREATE INDEX IF NOT EXISTS ltc_lat_lng ON ltc(lat, lng)").run().catch(() => {searchIndex=null;}));
}
function publicError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (/daily|quota|free tier|row read|row write/i.test(message)) return fail(503,"기관 정보 조회 한도에 도달해 잠시 검색할 수 없어요. 한국 시간 오전 9시 이후 다시 찾아 주세요.");
  if (/setup:KAKAO/.test(message)) return fail(503,"지금은 주소 검색을 이용할 수 없어요. 내 위치에서 찾기를 이용해 주세요.");
  if (/setup:DATA_GO_KR/.test(message)) return fail(503,"전화번호를 불러오지 못했어요. 지도에서 기관 정보를 확인해 주세요.");
  return fail(503,"기관 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
}

/** 누구나 쓰는 검색 (로그인 없음) */
async function ltcPublic(request: Request, env: Env, db: D1 | undefined, action: string): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  try {
    // 가까운 기관: ?lat&lng&r(km)&kinds=visit,day&sort=near|grade|old
    if (action === "search") {
      const lat = Number(q.get("lat"));
      const lng = Number(q.get("lng"));
      if (!(lat > 32 && lat < 39.5 && lng > 124 && lng < 132.5)) return fail(400, "위치를 확인해 주세요");
      const r = Math.min(30, Math.max(1, Number(q.get("r")) || 5));
      const kinds = (q.get("kinds") ?? "").split(",").filter((k) => LTC_KINDS.includes(k));
      const sort = q.get("sort") ?? "near";
      const dLat = r / 111;
      const dLng = r / (111 * Math.cos((lat * Math.PI) / 180));
      // Expand to a shared grid bounding box, but retain the exact GPS point for distances.
      const grid = 0.02;
      const bounds = [Math.floor((lat-dLat)/grid)*grid,Math.ceil((lat+dLat)/grid)*grid,Math.floor((lng-dLng)/grid)*grid,Math.ceil((lng+dLng)/grid)*grid].map(v=>Number(v.toFixed(4)));
      const candidates = await cachedPublic<Row[]>(request,`area/${bounds.join(",")}`,3600,async()=>{
        if (!db) throw new ServiceError("setup:DB");
        await ensureSearchIndex(db);
        const result = await db.prepare("SELECT code, name, addr, desig, kinds, grades, cap, lat, lng, approx FROM ltc WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?").bind(...bounds).all();
        return result.results;
      });
      const results = candidates.value;
      const want = kinds.length ? kinds : LTC_KINDS;
      const rank = (g: string) => /^[ABCDE]$/.test(g) ? "ABCDE".indexOf(g) + 1 : 9;
      const list = results
        .map((x) => {
          const ks = JSON.parse(String(x.kinds)) as string[];
          const gs = JSON.parse(String(x.grades)) as Record<string, [string, number]>;
          const shown = ks.filter((k) => want.includes(k));
          const best = Math.min(9, ...shown.map((k) => rank(gs[k]?.[0] ?? "")));
          return { code: x.code, name: x.name, addr: x.addr, desig: x.desig, cap: x.cap, kinds: ks, grades: gs, shown, best, km: km(lat, lng, Number(x.lat), Number(x.lng)), lat: x.lat, lng: x.lng, approx: x.approx === 1 };
        })
        .filter((x) => x.shown.length && x.km <= r);
      list.sort((a, b) =>
        sort === "grade" ? a.best - b.best || a.km - b.km : sort === "new" ? String(b.desig || "").localeCompare(String(a.desig || "")) || a.km - b.km : a.km - b.km,
      );
      const response = json({ total: list.length, items: list.slice(0, 80).map(({ best: _b, ...x }) => ({ ...x, km: Math.round(x.km * 10) / 10 })) });
      response.headers.set("x-ltc-candidates-cache",candidates.cache);
      return response;
    }
    // 동네·주소로 위치 찾기: ?q=
    if (action === "place") {
      const text = (q.get("q") ?? "").trim().slice(0, 60);
      if (text.length < 2) return fail(400, "동네 이름이나 주소를 2글자 이상 입력해 주세요");
      const digest = [...await sha(text.replace(/\s+/g," "))].map(b=>b.toString(16).padStart(2,"0")).join("");
      const answer = await cachedPublic<{places:unknown[]}>(request,`place/${digest}`,86400,async()=>{
      const a = asList((await kakao(env, "/v2/local/search/address.json", { query: text, size: "5" })).documents);
      const k = a.length ? [] : asList((await kakao(env, "/v2/local/search/keyword.json", { query: text, size: "5" })).documents);
      const places = [...a.map((d) => ({ name: String(d.address_name), lat: Number(d.y), lng: Number(d.x) })), ...k.map((d) => ({ name: `${d.place_name} (${d.address_name})`, lat: Number(d.y), lng: Number(d.x) }))];
        return {places};
      });
      const response = json(answer.value);
      response.headers.set("x-ltc-place-cache",answer.cache);
      return response;
    }

    // Individual public institution detail, indexed by its primary key and cached.
    if (action === "detail") {
      const code = str(q.get("c"),20);
      if (!/^\d{8,15}$/.test(code)) return fail(400,"기관 주소를 다시 확인해 주세요.");
      const detail = await cachedPublic<Row | null>(request,`detail/${code}`,3600,async()=>{
        if (!db) throw new ServiceError("setup:DB");
        const row = await db.prepare("SELECT code, name, addr, desig, cap, kinds, grades, lat, lng, approx, phone FROM ltc WHERE code = ?").bind(code).first();
        if (!row) return null;
        return {...row,kinds:JSON.parse(String(row.kinds)),grades:JSON.parse(String(row.grades)),approx:Number(row.approx)===1};
      });
      if (!detail.value) return fail(404,"기관 정보를 찾을 수 없어요.");
      const response=json({facility:detail.value});response.headers.set("x-ltc-detail-cache",detail.cache);return response;
    }
    // 전화번호: 공단 API(일반현황)로 조회 후 30일 저장
    if (action === "phone") {
      const code = str(q.get("c"), 20);
      if (!db) throw new ServiceError("setup:DB");
      const row = await db.prepare("SELECT code, ptype, phone, phone_at FROM ltc WHERE code = ?").bind(code).first();
      if (!row) return fail(404, "기관을 찾을 수 없어요");
      if (row.phone_at && Date.now() - Date.parse(String(row.phone_at)) < 30 * 86400_000) return json({ phone: row.phone || "" });
      if (!env.DATA_GO_KR_KEY) return fail(503, "setup:DATA_GO_KR");
      const key = env.DATA_GO_KR_KEY.includes("%") ? env.DATA_GO_KR_KEY : encodeURIComponent(env.DATA_GO_KR_KEY);
      const r = await fetch(
        `${env.DATA_GO_KR_BASE || "https://apis.data.go.kr"}/B550928/getLtcInsttDetailInfoService02/getGeneralSttusDetailInfoItem02?serviceKey=${key}&longTermAdminSym=${encodeURIComponent(code)}&adminPttnCd=${encodeURIComponent(String(row.ptype))}`,
      );
      const xml = await r.text();
      const tag = (t: string) => xml.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1]?.trim() ?? "";
      if (!xml.includes("<item>")) {
        const msg = tag("returnAuthMsg") || tag("resultMsg") || tag("errMsg");
        if (msg) return fail(502, `공단 API: ${msg}`);
      }
      const phone = [tag("locTelNo_1") || tag("locTelNo1"), tag("locTelNo_2") || tag("locTelNo2"), tag("locTelNo_3") || tag("locTelNo3")].filter(Boolean).join("-");
      await db.prepare("UPDATE ltc SET phone = ?, phone_at = ? WHERE code = ?").bind(phone, now(), code).run();
      return json({ phone });
    }
  } catch (e) { return publicError(e); }

  return fail(404, "없는 주소예요");
}

/** 직원: 기관 데이터 옮기기·좌표 붙이기 */
async function ltcStaff(request: Request, env: Env & { ASSETS?: { fetch: (r: Request | URL) => Promise<Response> } }, db: D1, action: string): Promise<Response> {
  await ltcInit(db);
  try {
    if (action === "status") {
      const meta = await (await (env.ASSETS ? env.ASSETS.fetch(new URL("/ltc/meta.json", request.url)) : fetch(new URL("/ltc/meta.json", request.url)))).json().catch(() => null);
      const c = await db.prepare("SELECT COUNT(*) AS n, SUM(lat IS NOT NULL) AS geo, SUM(lat IS NULL AND geo_fail >= 2) AS fail, SUM(approx = 1) AS approx, MAX(ver) AS ver FROM ltc").first();
      return json({ meta, count: Number(c?.n ?? 0), geocoded: Number(c?.geo ?? 0), failed: Number(c?.fail ?? 0), approx: Number(c?.approx ?? 0), ver: c?.ver ?? null, kakao: !!env.KAKAO_REST_KEY, dataGoKr: !!env.DATA_GO_KR_KEY });
    }
    if (action === "import" && request.method === "POST") {
      const b = await body(request);
      const sido = str(b.sido, 4);
      const ver = str(b.ver, 20);
      if (!/^\d{2}$/.test(sido) || !ver) return fail(400, "시도·버전이 필요해요");
      const u = new URL(`/ltc/facilities-${sido}.json`, request.url);
      const res = env.ASSETS ? await env.ASSETS.fetch(u) : await fetch(u);
      if (!res.ok) return fail(404, `facilities-${sido}.json 이 없어요`);
      const rows = (await res.json()) as Row[];
      // 주소가 바뀐 곳·아직 못 찾은 곳은 좌표를 다시 찾게 함
      const stmt = `INSERT INTO ltc (code, name, addr, sido, desig, kinds, grades, ptype, cap, ver, dong)
        SELECT json_extract(value,'$.c'), json_extract(value,'$.n'), json_extract(value,'$.a'), ?2, json_extract(value,'$.d'),
               json_extract(value,'$.k'), json_extract(value,'$.g'), json_extract(value,'$.p'), json_extract(value,'$.q'), ?3,
               coalesce(json_extract(value,'$.b'), '')
        FROM json_each(?1) WHERE true
        ON CONFLICT(code) DO UPDATE SET name = excluded.name, sido = excluded.sido, desig = excluded.desig, kinds = excluded.kinds,
          grades = excluded.grades, ptype = excluded.ptype, cap = excluded.cap, ver = excluded.ver, dong = excluded.dong,
          lat = CASE WHEN ltc.addr = excluded.addr THEN ltc.lat END, lng = CASE WHEN ltc.addr = excluded.addr THEN ltc.lng END,
          approx = CASE WHEN ltc.addr = excluded.addr THEN ltc.approx ELSE 0 END,
          geo_fail = CASE WHEN ltc.addr = excluded.addr AND ltc.lat IS NOT NULL THEN ltc.geo_fail ELSE 0 END, addr = excluded.addr`;
      const chunks = [];
      for (let i = 0; i < rows.length; i += 1000) chunks.push(db.prepare(stmt).bind(JSON.stringify(rows.slice(i, i + 1000)), sido, ver));
      await db.batch(chunks);
      return json({ sido, rows: rows.length });
    }
    // 못 찾은 곳 다시 찾기
    if (action === "retry" && request.method === "POST") {
      await db.prepare("UPDATE ltc SET geo_fail = 0 WHERE lat IS NULL").run();
      return json({ ok: true });
    }
    // 이번 버전에 없는 기관(폐업 등) 지우기
    if (action === "prune" && request.method === "POST") {
      const ver = str((await body(request)).ver, 20);
      if (!ver) return fail(400, "버전이 필요해요");
      await db.prepare("DELETE FROM ltc WHERE ver != ?").bind(ver).run();
      return json({ ok: true });
    }
    // 좌표 붙이기: 한 번에 40곳 (카카오 동시 8건)
    if (action === "geocode" && request.method === "POST") {
      // 무료 요금제는 요청 1번에 외부 호출 50개까지 → 한 번에 8곳 (한 곳에 최대 6번 조회)
      const { results } = await db.prepare("SELECT code, addr, name, dong, geo_fail FROM ltc WHERE lat IS NULL AND geo_fail < 2 LIMIT 8").all();
      const out: { c: string; lat: number | null; lng: number | null; a: number; f: number }[] = [];
      for (let i = 0; i < results.length; i += 8) {
        await Promise.all(
          results.slice(i, i + 8).map(async (x) => {
            const g = await geocode(env, String(x.addr), String(x.name), String(x.dong ?? "")).catch((e) => {
              if (e instanceof ServiceError && /setup|limit|quota|초과|권한|disabled/i.test(e.message)) throw e;
              return null;
            });
            // 동네 중심까지 못 찾으면 다시 시도할 의미가 없어 바로 실패로 둠
            out.push({ c: String(x.code), lat: g?.lat ?? null, lng: g?.lng ?? null, a: g?.approx ? 1 : 0, f: g ? 0 : 2 });
          }),
        );
      }
      if (out.length)
        await db
          .prepare(
            `UPDATE ltc SET lat = json_extract(j.value,'$.lat'), lng = json_extract(j.value,'$.lng'), approx = json_extract(j.value,'$.a'), geo_fail = json_extract(j.value,'$.f')
             FROM json_each(?) AS j WHERE ltc.code = json_extract(j.value,'$.c')`,
          )
          .bind(JSON.stringify(out))
          .run();
      const next = await db.prepare("SELECT code FROM ltc WHERE lat IS NULL AND geo_fail < 2 LIMIT 1").first();
      return json({ done: out.filter((x) => x.lat != null).length, failed: out.filter((x) => x.lat == null).length, hasMore: !!next });
    }
  } catch (e) {
    if (e instanceof ServiceError) return fail(e.message.startsWith("setup:") ? 503 : 502, e.message);
    return fail(502, (e as Error).message);
  }
  return fail(404, "없는 주소예요");
}
