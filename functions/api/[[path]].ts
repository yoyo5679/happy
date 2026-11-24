// Public long-term care facility API. Customer ledger functionality has been retired.
type D1Result<T> = { results: T[] };
type D1Stmt = {
  bind(...v: unknown[]): D1Stmt;
  all<T = Row>(): Promise<D1Result<T>>;
  first<T = Row>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type D1 = { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> };
type Env = { DB?: D1; KAKAO_REST_KEY?: string; DATA_GO_KR_KEY?: string; KAKAO_BASE?: string; DATA_GO_KR_BASE?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string; SCAN_DAILY_LIMIT?: string };
type Ctx = { request: Request; env: Env; params: { path?: string[] } };
type Row = Record<string, unknown>;

class ServiceError extends Error {}
const asList = (v: unknown): Row[] => Array.isArray(v) ? v as Row[] : v && typeof v === "object" ? Object.values(v) as Row[] : [];
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "x-content-type-options":"nosniff", "referrer-policy":"no-referrer", "x-frame-options":"DENY", "strict-transport-security":"max-age=31536000", "content-security-policy":"default-src 'none'; frame-ancestors 'none'" },
  });
const fail = (status: number, error: string) => json({ error }, status);

const now = () => new Date().toISOString();
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function sha(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
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
  if(path[0]==="staff"&&path[1]==="ltc")return fail(410,"종료된 관리 API입니다.");
  const retired = path[0] === "my" || (path[0] === "staff" && path[1] !== "ltc");
  if (retired) {
    let ledgerCleanup = env.DB ? "complete" : "no_database_binding";
    if (env.DB) { try { await purgeRetiredLedger(env.DB); } catch { ledgerCleanup = "failed"; } }
    return json({ error: "종료된 서비스입니다.", ledgerCleanup }, 410);
  }
  if(path[0]==="ltc"&&path[1]==="monthly-sync"&&path.length===2){
    if(request.method!=="POST")return fail(405,"POST 요청이 필요합니다.");
    const auth=await isSyncWorkflow(request);
    if(!auth.ok)return json({error:"허용된 예약 실행만 사용할 수 있습니다.",code:auth.code},401);
    if(!env.DB)return fail(503,"기관 데이터베이스에 연결하지 못했어요.");
    try{return await monthlyStep(request,env,env.DB);}catch{return fail(503,"기관 업데이트를 잠시 후 다시 시도해 주세요.");}
  }
  if (path[0] === "ltc" && path.length === 2) return ltcPublic(request, env, env.DB, path[1]);
  if (path[0] === "scan" && path.length === 1) return safetyScan(request, env);
  return fail(404, "없는 주소예요");
}

// ───────── 사진 AI 안전진단 (Gemini) ─────────
// 사진은 분석 요청에만 쓰고 어디에도 저장하지 않는다. 남는 것은 하루 이용 횟수(익명 해시)뿐.
const SCAN_ROOMS: Record<string, string> = { bath: "욕실·화장실", bedroom: "침실", entrance: "현관·문턱·계단", living: "거실·주방·복도" };
// 장소별로 추천할 수 있는 품목과 "사진에서 이런 게 보이면" 조건.
// 보행기·지팡이·휠체어·양말처럼 집이 아니라 어르신 몸 상태로 정하는 품목은 사진 진단에서 추천하지 않는다.
const SCAN_ITEMS: Record<string, Record<string, string>> = {
  bath: {
    safetyHandle: "변기 옆·욕조 옆·샤워하는 곳 벽에 붙잡을 손잡이가 없을 때",
    antiSlipMat: "타일 바닥이나 욕조 바닥에 미끄럼방지 매트·처리가 없을 때",
    bathChair: "서서 씻어야 하는 샤워 공간이고 앉아서 씻을 목욕의자가 없을 때",
  },
  bedroom: {
    electricBed: "바닥에 요를 깔고 주무시거나, 침대가 너무 낮아 일어나기 힘들어 보이거나, 붙잡을 난간이 없는 일반 침대일 때",
    safetyHandle: "침대에서 일어설 때 짚을 곳(난간·지지대)이 없을 때",
    pressureMattress: "간병용 침대나 의료용 침상이 보여 오래 누워 지내는 환경으로 보일 때만",
    ramp: "방 문턱에 걸려 넘어질 만한 단차가 보일 때",
  },
  entrance: {
    ramp: "현관 턱이나 문턱에 높은 단차가 있을 때",
    safetyHandle: "신발을 신고 벗거나 턱을 오를 때 붙잡을 곳이 없을 때",
    antiSlipMat: "현관 바닥이 미끄러운 타일·대리석일 때",
  },
  living: {
    safetyHandle: "복도·소파 주변에 붙잡을 곳이 없어 가구를 짚고 다녀야 할 때",
    ramp: "방·베란다·주방 사이 문턱에 단차가 보일 때",
    antiSlipMat: "주방 싱크대 앞 등 물기가 생기는 미끄러운 바닥일 때",
  },
};
const SCAN_LABELS: Record<string, string> = { safetyHandle: "안전손잡이", antiSlipMat: "미끄럼방지 매트", bathChair: "목욕의자", electricBed: "전동침대", pressureMattress: "욕창예방 매트리스", ramp: "경사로" };
const SCAN_PROMPT = (roomKey: string) => `당신은 어르신 낙상 예방을 전문으로 하는 작업치료사입니다.
사진은 어르신이 사는 집의 "${SCAN_ROOMS[roomKey]}"입니다. 사진에 실제로 보이는 것만 근거로 낙상·안전 위험을 점검하세요.
규칙:
- 보이지 않는 것은 추측하지 마세요. 사진 속 구체적인 위치·물건을 근거로 쓰세요(예: "변기 왼쪽 벽").
- 사람이 찍혀 있어도 사람에 대해서는 아무 말도 하지 마세요. 집 환경만 봅니다.
- 위험 요소는 중요한 순서로 최대 5개. 제목은 15자 이내, 설명은 1~2문장, 쉬운 존댓말(~요).
- 각 위험 요소의 fix에는 아래 목록의 키만, 오른쪽 조건이 사진에서 분명히 확인될 때만 넣으세요. 조건이 맞지 않거나 애매하면 fix를 빈 배열로 두세요.
${Object.entries(SCAN_ITEMS[roomKey]).map(([k, v]) => `  ${k} (${SCAN_LABELS[k]}): ${v}`).join("\n")}
- 목록에 없는 용품(보행기, 지팡이, 휠체어, 양말 등)은 절대 추천하지 마세요. 조명·정리정돈·가구 배치처럼 용품이 필요 없는 위험은 fix를 비우고 설명에 해결 방법을 쓰세요.
- fix가 있는 위험 요소에는 그 용품을 설치·배치할 지점을 표시하세요: photo는 사진 번호(첫 사진 0부터), x·y는 그 사진의 왼쪽 위가 (0,0), 오른쪽 아래가 (1000,1000)인 좌표입니다. 예: 변기 옆 벽 손잡이 자리, 문턱 위치, 요가 깔린 자리. fix가 비어 있으면 photo·x·y는 -1로 쓰세요.
- 이미 잘 되어 있는 점이 보이면 good에 최대 3개 짧게 쓰세요(예: 이미 손잡이가 있음).
- 집 안 사진이 아니거나 너무 어둡고 흐려 판단할 수 없으면 usable=false로 하고 이유를 summary에 쓰세요. 다른 장소 사진이면 그 사실도 summary에 쓰세요.
- risk는 1(안전)~5(매우 위험) 정수, summary는 전체 한 줄 요약(40자 이내).`;
const SCAN_SCHEMA = (roomKey: string) => ({
  type: "OBJECT",
  properties: {
    usable: { type: "BOOLEAN" },
    risk: { type: "INTEGER" },
    summary: { type: "STRING" },
    hazards: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          detail: { type: "STRING" },
          severity: { type: "STRING", enum: ["high", "mid", "low"] },
          fix: { type: "ARRAY", items: { type: "STRING", enum: Object.keys(SCAN_ITEMS[roomKey]) } },
          photo: { type: "INTEGER" },
          x: { type: "INTEGER" },
          y: { type: "INTEGER" },
        },
        required: ["title", "detail", "severity", "fix", "photo", "x", "y"],
      },
    },
    good: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["usable", "risk", "summary", "hazards", "good"],
});
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

async function scanQuota(request: Request, env: Env, kind = "scan", perPerson = 20, globalLimit = Number(env.SCAN_DAILY_LIMIT) || 1000): Promise<boolean> {
  if (!env.DB) return true;
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const who = Array.from(await sha(`${day}|${ip}|${kind}`)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
  const global = Math.max(1, globalLimit);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS scan_quota (k TEXT PRIMARY KEY, n INTEGER NOT NULL)").run();
  const bump = (k: string) => env.DB!.prepare("INSERT INTO scan_quota (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n").bind(k).first<{ n: number }>();
  const mine = await bump(`${day}:${kind}:${who}`);
  if (Number(mine?.n) > perPerson) return false;
  const all = await bump(`${day}:${kind}:all`);
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM scan_quota WHERE k < ?").bind(day).run();
  return Number(all?.n) <= global;
}

/** AI가 알려 준 설치 위치(사진 번호, 0~1000 좌표)를 검증. 잘못되면 위치 없음(-1) */
function spot(h: Row, photos: number): { photo: number; x: number; y: number } {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : -1);
  const photo = n(h.photo), x = n(h.x), y = n(h.y);
  return photo >= 0 && photo < photos && x >= 0 && x <= 1000 && y >= 0 && y <= 1000 ? { photo, x, y } : { photo: -1, x: -1, y: -1 };
}

async function callGemini(env: Env, model: string, body: unknown): Promise<Response> {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
    body: JSON.stringify(body),
  });
}

async function safetyScan(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return fail(405, "POST 요청이 필요합니다.");
  if (!env.GEMINI_API_KEY) return fail(503, "AI 진단이 아직 준비 중이에요. 잠시 후 다시 시도해 주세요.");
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return fail(403, "허용되지 않은 요청이에요.");
  if (Number(request.headers.get("content-length") || 0) > 6_000_000) return fail(413, "사진 용량이 너무 커요.");
  let input: { room?: unknown; images?: unknown };
  try { input = await request.json(); } catch { return fail(400, "요청 형식이 올바르지 않아요."); }
  const room = typeof input.room === "string" && SCAN_ROOMS[input.room] ? input.room : "";
  const images = Array.isArray(input.images) ? input.images.filter((v): v is string => typeof v === "string" && v.length > 100 && v.length < 2_000_000 && B64.test(v)) : [];
  if (!room) return fail(400, "장소를 골라 주세요.");
  if (images.length < 1 || images.length > 3 || images.length !== (input.images as unknown[]).length) return fail(400, "사진을 1~3장 올려 주세요.");
  try { if (!(await scanQuota(request, env))) return fail(429, "오늘 진단 가능 횟수를 모두 썼어요. 내일 다시 이용하시거나 전화·카카오톡으로 상담해 주세요."); }
  catch { /* 횟수 기록 실패는 진단을 막지 않음 */ }

  const body = {
    contents: [{ role: "user", parts: [{ text: SCAN_PROMPT(room) }, ...images.map(data => ({ inline_data: { mime_type: "image/jpeg", data } }))] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCAN_SCHEMA(room) },
  };
  try {
    let res = await callGemini(env, env.GEMINI_MODEL || "gemini-2.5-flash", body);
    if (res.status === 404 && !env.GEMINI_MODEL) res = await callGemini(env, "gemini-flash-latest", body);
    if (res.status === 429) return fail(503, "지금 진단 요청이 많아요. 잠시 후 다시 시도해 주세요.");
    if (!res.ok) return fail(502, "AI 진단에 실패했어요. 잠시 후 다시 시도해 주세요.");
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
    const r = JSON.parse(text) as Row;
    const cats = new Set(Object.keys(SCAN_ITEMS[room]));
    const hazards = asList(r.hazards).slice(0, 5).map(h => ({
      title: str(h.title, 40),
      detail: str(h.detail, 240),
      severity: ["high", "mid", "low"].includes(String(h.severity)) ? String(h.severity) : "mid",
      fix: (Array.isArray(h.fix) ? h.fix : []).filter((c): c is string => typeof c === "string" && cats.has(c)).slice(0, 3),
      ...spot(h, images.length),
    })).filter(h => h.title);
    return json({
      usable: r.usable !== false,
      risk: Math.min(5, Math.max(1, Math.round(Number(r.risk) || 1))),
      summary: str(r.summary, 120),
      hazards,
      good: (Array.isArray(r.good) ? r.good : []).map(g => str(g, 80)).filter(Boolean).slice(0, 3),
    });
  } catch {
    return fail(502, "AI 진단 결과를 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.");
  }
}

const LTC_KINDS = ["visit", "bath", "day", "short", "home"];

async function kakao(env: Env, path: string, q: Record<string, string>): Promise<Row> {
  if (!env.KAKAO_REST_KEY) throw new ServiceError("setup:KAKAO");
  const r = await fetch(`${env.KAKAO_BASE || "https://dapi.kakao.com"}${path}?${new URLSearchParams(q)}`, { headers: { Authorization: `KakaoAK ${env.KAKAO_REST_KEY}` } });
  const j = (await r.json().catch(() => ({}))) as Row;
  if (!r.ok) throw new ServiceError(`카카오 오류: ${String(j.message ?? j.msg ?? r.status)}`);
  return j;
}

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

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
// Public NHIS fields only. Empty numeric tags are unknown, never zero.
const profileStaffFields:Record<string,string>={equipLong:"시설장",socWel:"사회복지사",nur:"간호사",nurArticle:"간호조무사",physicalMTret:"물리치료사",wrkMTret:"작업치료사",recuProt_1:"요양보호사 1급",recuProt_2:"요양보호사 2급",recuProtDelay:"요양보호사 유예인원",chrgDoc:"전임 의사",chargeDoc:"촉탁 의사",hdOfce:"사무국장",ofceEmp:"사무원",nut:"영양사",cook:"조리원",hygiPrsn:"위생원",mgmtPrsn:"관리인",suppPrsn:"보조원",etcPer:"기타 인력"};
function xmlValue(xml:string,tag:string):string {
 const raw=xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))?.[1]?.trim()??"";
 return raw.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,"$1").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
}
async function nhisProfileItem(env:Env,operation:string,code:string,ptype:string):Promise<string> {
 if(!env.DATA_GO_KR_KEY)throw new ServiceError("profile:auth");
 const key=encodeURIComponent(env.DATA_GO_KR_KEY.includes("%")?decodeURIComponent(env.DATA_GO_KR_KEY):env.DATA_GO_KR_KEY);
 const r=await fetch(`${env.DATA_GO_KR_BASE||"https://apis.data.go.kr"}/B550928/getLtcInsttDetailInfoService02/${operation}?serviceKey=${key}&longTermAdminSym=${code}&adminPttnCd=${encodeURIComponent(ptype)}`,{signal:AbortSignal.timeout(8000)});
 const xml=await r.text();
 const status=xmlValue(xml,"resultCode"),auth=xmlValue(xml,"returnAuthMsg");
 if(!r.ok||auth||(status&&status!=="00"&&status!=="0"))throw new ServiceError("profile:upstream");
 if(!/<response[\s>]/.test(xml))throw new ServiceError("profile:upstream");
 const item=xml.match(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/)?.[1]??"";
 if(item&&xmlValue(item,"longTermAdminSym")!==code)throw new ServiceError("profile:identity");
 if(item&&xmlValue(item,"adminPttnCd")!==ptype)throw new ServiceError("profile:identity");
 return item;
}
function profileDate(v:string){if(!/^\d{8}$/.test(v)||v==="00000000")return null;const date=`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;return Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:null;}
// Monthly public-institution additions. Only the pinned GitHub workflow may mutate this data.
const SYNC_REPO="yoyo5679/happy",SYNC_REF="refs/heads/claude/festive-albattani-sjd0d8";
const SYNC_WORKFLOW=`${SYNC_REPO}/.github/workflows/ltc-monthly.yml@${SYNC_REF}`;
const SYNC_AUDIENCE="https://happycare.pages.dev/ltc-monthly";
const SYNC_SIDOS=["11","26","27","28","29","30","31","36","41","43","44","46","47","48","50","51","52"];
const SYNC_AREA:Record<string,string>={"11":"서울","26":"부산","27":"대구","28":"인천","29":"광주","30":"대전","31":"울산","36":"세종","41":"경기","43":"충북","44":"충남","46":"전남","47":"경북","48":"경남","50":"제주","51":"강원","52":"전북"};
function syncKind(type:string):string|null {
 if(["B01","C01"].includes(type))return "visit";
 if(["B02","C02"].includes(type))return "bath";
 if(["B03","C03"].includes(type)||/^[HI]/.test(type))return "day";
 if(["B04","C04","A05"].includes(type))return "short";
 if(["A01","A02","A03","A04","S41"].includes(type)||/^[GM]/.test(type))return "home";
 return null; // Welfare-equipment and nursing-only providers are not published here.
}
function unbase64url(s:string):Uint8Array<ArrayBuffer> {return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));}
async function isSyncWorkflow(request:Request):Promise<{ok:boolean;code?:string}> {
 const deny=(code:string)=>({ok:false,code});
 try {
  const token=(request.headers.get("authorization")??"").replace(/^Bearer /,"");
  if(token.length>16000)return deny("oidc_token_size");
  const parts=token.split(".");if(parts.length!==3)return deny("oidc_token_format");
  const header=JSON.parse(new TextDecoder().decode(unbase64url(parts[0]))),claims=JSON.parse(new TextDecoder().decode(unbase64url(parts[1])));
  const t=Math.floor(Date.now()/1000);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>120)return deny("oidc_algorithm");
  if(claims.iss!=="https://token.actions.githubusercontent.com")return deny("oidc_issuer");
  if(!(claims.aud===SYNC_AUDIENCE||(Array.isArray(claims.aud)&&claims.aud.includes(SYNC_AUDIENCE))))return deny("oidc_audience");
  if(claims.repository!==SYNC_REPO)return deny("oidc_repository");
  if(String(claims.repository_id)!=="1406565226"||String(claims.repository_owner_id)!=="62796904")return deny("oidc_repository_id");
  if(claims.ref!==SYNC_REF)return deny("oidc_ref");
  if(claims.workflow_ref!==SYNC_WORKFLOW)return deny("oidc_workflow");
  if(!["schedule","workflow_dispatch","push"].includes(claims.event_name))return deny("oidc_event");
  if(typeof claims.exp!=="number"||claims.exp<=t||typeof claims.iat!=="number"||claims.iat>t+30||claims.iat<t-3600||(claims.nbf!==undefined&&(typeof claims.nbf!=="number"||claims.nbf>t+30)))return deny("oidc_time");
  const keys=await cachedPublic<{keys:(JsonWebKey&{kid:string})[]}>(request,"github-oidc-keys",300,async()=>{
   const r=await fetch("https://token.actions.githubusercontent.com/.well-known/jwks",{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error("oidc");return r.json();
  });
  const jwk=keys.value.keys.find(k=>k.kid===header.kid&&k.kty==="RSA");if(!jwk)return deny("oidc_signing_key");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,unbase64url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`))?{ok:true}:deny("oidc_signature");
 }catch{return deny("oidc_verification_unavailable");}
}

let syncReady:Promise<void>|null=null;
async function syncSchema(db:D1):Promise<void> {
 await (syncReady??=(async()=>{await db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS ltc_sync_jobs (id TEXT PRIMARY KEY, from_date TEXT NOT NULL, to_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'collecting', sido_index INTEGER NOT NULL DEFAULT 0, page INTEGER NOT NULL DEFAULT 1, seen INTEGER NOT NULL DEFAULT 0, last_page_key TEXT NOT NULL DEFAULT '', scanned INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0, unresolved INTEGER NOT NULL DEFAULT 0, lease_owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL, completed_at TEXT, error_code TEXT)`),
  db.prepare(`CREATE TABLE IF NOT EXISTS ltc_sync_queue (job_id TEXT NOT NULL, code TEXT NOT NULL, payload TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, error_code TEXT, PRIMARY KEY(job_id,code))`),
  db.prepare(`CREATE INDEX IF NOT EXISTS ltc_sync_pending ON ltc_sync_queue(job_id,done,code)`),
 ]);})().catch(e=>{syncReady=null;throw e;}));
}
type SyncCandidate={code:string;name:string;sido:string;district:string;desig:string;kinds:string[];types:string[]};
function syncWindow(period:string,first:boolean):{from:string;to:string} {
 const [y,m]=period.split("-").map(Number);
 return {from:first?"2026-06-11":new Date(Date.UTC(y,m-3,1)).toISOString().slice(0,10),to:new Date(Date.UTC(y,m-1,0)).toISOString().slice(0,10)};
}
function syncSummary(row:Row|null){if(!row)return null;return {period:row.id,from:row.from_date,to:row.to_date,status:row.status,scanned:Number(row.scanned),added:Number(row.added),updated:Number(row.updated),unresolved:Number(row.unresolved),startedAt:row.started_at,completedAt:row.completed_at,error:row.error_code||null};}
async function syncStatus(db:D1):Promise<Row> {
 try {
  const latest=await db.prepare("SELECT * FROM ltc_sync_jobs ORDER BY id DESC LIMIT 1").first();
  const completed=await db.prepare("SELECT * FROM ltc_sync_jobs WHERE completed_at IS NOT NULL ORDER BY id DESC LIMIT 1").first();
  return {available:true,current:syncSummary(latest),lastCompleted:syncSummary(completed)};
 }catch(e){if(/no such table/i.test(String(e)))return {available:true,current:null,lastCompleted:null};throw e;}
}
async function syncRevision(request:Request,db:D1|undefined):Promise<string>{
 if(!db)return "baseline";
 const r=await cachedPublic<string>(request,"monthly-published-revision",60,async()=>{
  try {const row=await db.prepare("SELECT id FROM ltc_sync_jobs WHERE completed_at IS NOT NULL ORDER BY id DESC LIMIT 1").first();return String(row?.id||"baseline");}catch{return "baseline";}
 });return r.value;
}
async function monthlyList(env:Env,sido:string,from:string,to:string,page:number):Promise<{items:SyncCandidate[];rawCount:number;total:number;fingerprint:string}> {
 if(!env.DATA_GO_KR_KEY)throw new ServiceError("sync:key");
 const raw=env.DATA_GO_KR_KEY.trim(),key=encodeURIComponent(raw.includes("%")?decodeURIComponent(raw):raw);
 const q=new URLSearchParams({siDoCd:sido,startRgtDt:from.replace(/-/g,""),endRgtDt:to.replace(/-/g,""),pageNo:String(page),numOfRows:"100"});
 const r=await fetch(`${env.DATA_GO_KR_BASE||"https://apis.data.go.kr"}/B550928/searchLtcInsttService02/getLtcInsttSeachList02?serviceKey=${key}&${q}`,{signal:AbortSignal.timeout(12000)});
 const xml=await r.text();if(!r.ok||!["00","0"].includes(xmlValue(xml,"resultCode"))||xmlValue(xml,"returnAuthMsg"))throw new ServiceError("sync:list-provider");
 const count=xmlValue(xml,"totalCount");if(!/^\d+$/.test(count))throw new ServiceError("sync:list-count");
 const parts=Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g));if(parts.length>100)throw new ServiceError("sync:page-size");
 const grouped=new Map<string,SyncCandidate>();
 for(const part of parts){const x=part[1],code=xmlValue(x,"longTermAdminSym"),type=xmlValue(x,"adminPttnCd"),desig=profileDate(xmlValue(x,"longTermPeribRgtDt"));
  const kind=syncKind(type);if(!kind)continue;
  if(!/^\d{11}$/.test(code)||xmlValue(x,"siDoCd")!==sido||!desig||desig<from||desig>to)throw new ServiceError("sync:list-validation");
  const candidate={code,name:xmlValue(x,"adminNm"),sido,district:xmlValue(x,"siGunGuCd"),desig,kinds:[kind],types:[type]};
  if(!candidate.name||!/^\d{3}$/.test(candidate.district))throw new ServiceError("sync:list-validation");
  const prior=grouped.get(code);grouped.set(code,prior?{...candidate,desig:prior.desig>candidate.desig?prior.desig:candidate.desig,kinds:[...new Set([...prior.kinds,kind])],types:[...new Set([...prior.types,type])]}:candidate);
 }
 return {items:[...grouped.values()],rawCount:parts.length,total:Number(count),fingerprint:[...await sha(parts.map(p=>["longTermAdminSym","adminPttnCd","longTermPeribRgtDt"].map(k=>xmlValue(p[1],k)).join(":")).join("|"))].map(b=>b.toString(16).padStart(2,"0")).join("")};
}
async function monthlyKakao(env:Env,path:string,query:Record<string,string>):Promise<Row>{
 if(!env.KAKAO_REST_KEY)throw new ServiceError("sync:map-key");
 const r=await fetch(`${env.KAKAO_BASE||"https://dapi.kakao.com"}${path}?${new URLSearchParams(query)}`,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_KEY}`},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new ServiceError("sync:map-provider");return r.json();
}
function cleanInstitutionName(s:string){return s.replace(/[\s()㈜·.,\-]/g,"").toLowerCase();}
async function resolveMonthly(env:Env,c:SyncCandidate):Promise<{addr:string;lat:number;lng:number;phone:string}|null> {
 const type=c.types[0],general=await nhisProfileItem(env,"getGeneralSttusDetailInfoItem02",c.code,type);
 if(!general)return null;
 const district=xmlValue(general,"siDoCd")+xmlValue(general,"siGunGuCd");
 if(district!==c.sido+c.district) return null;
 const docs=asList((await monthlyKakao(env,"/v2/local/search/keyword.json",{query:`${SYNC_AREA[c.sido]} ${c.name}`,size:"15"})).documents);
 const exact=docs.filter(x=>cleanInstitutionName(String(x.place_name||""))===cleanInstitutionName(c.name));
 const matches:{addr:string;lat:number;lng:number;phone:string}[]=[];
 // Reject ambiguous names instead of assigning a different institution's map pin.
 for(const doc of exact.slice(0,2)){
  const lat=Number(doc.y),lng=Number(doc.x);if(!(lat>32&&lat<39.5&&lng>124&&lng<132.5))continue;
  const regions=asList((await monthlyKakao(env,"/v2/local/geo/coord2regioncode.json",{x:String(lng),y:String(lat)})).documents);
  const sourceDong=xmlValue(general,"BDongCd"),sourceRi=xmlValue(general,"riCd");
  const legalPrefix=district+(/^\d{3}$/.test(sourceDong)?sourceDong:"")+( /^\d{3}$/.test(sourceDong)&&/^\d{2}$/.test(sourceRi)?sourceRi:"");
  if(!regions.some(r=>r.region_type==="B"&&String(r.code||"").startsWith(legalPrefix)))continue;
  const road=String(doc.road_address_name||""),house=road.match(/\s(\d+)(?:-(\d+))?(?:\s|$)/);
  const sourceMain=xmlValue(general,"gunmulMlno"),sourceSub=xmlValue(general,"gunmulSlno");
  if(sourceMain&&Number(sourceMain)>0&&(!house||Number(house[1])!==Number(sourceMain)||Number(house[2]||0)!==Number(sourceSub||0)))continue;
  const addr=road||String(doc.address_name||"");if(!addr)continue;
  const phone=["locTelNo_1","locTelNo_2","locTelNo_3"].map(k=>xmlValue(general,k)).filter(Boolean).join("-");
  matches.push({addr,lat,lng,phone});
 }
 return matches.length===1?matches[0]:null;
}
async function monthlyStep(request:Request,env:Env,db:D1):Promise<Response> {
 await syncSchema(db);
 const period=new Date().toISOString().slice(0,7);
 let job=await db.prepare("SELECT * FROM ltc_sync_jobs WHERE completed_at IS NULL ORDER BY id LIMIT 1").first();
 if(!job){
  job=await db.prepare("SELECT * FROM ltc_sync_jobs WHERE id = ?").bind(period).first();
  if(!job){
   const previous=await db.prepare("SELECT * FROM ltc_sync_jobs WHERE completed_at IS NOT NULL ORDER BY id DESC LIMIT 1").first(),window=syncWindow(period,!previous);
   await db.prepare("INSERT OR IGNORE INTO ltc_sync_jobs (id,from_date,to_date,started_at) VALUES (?,?,?,?)").bind(period,window.from,window.to,now()).run();
   if(previous)await db.prepare("INSERT OR IGNORE INTO ltc_sync_queue (job_id,code,payload) SELECT ?,code,payload FROM ltc_sync_queue WHERE job_id = ? AND done = 2").bind(period,previous.id).run();
   job=await db.prepare("SELECT * FROM ltc_sync_jobs WHERE id = ?").bind(period).first();
  }
 }
 if(!job)throw new ServiceError("sync:job");
 if(job.completed_at)return json({done:job.id===period,job:syncSummary(job)});
 const id=String(job.id),owner=crypto.randomUUID(),lease=Date.now()+120_000;
 const lock=await db.prepare("UPDATE ltc_sync_jobs SET lease_owner = ?, lease_until = ? WHERE id = ? AND lease_until < ? AND completed_at IS NULL RETURNING id").bind(owner,lease,id,Date.now()).first();
 if(!lock)return json({done:false,busy:true,job:syncSummary(job)});
 job=(await db.prepare("SELECT * FROM ltc_sync_jobs WHERE id=?").bind(id).first())!;
 try {
  if(job.status==="collecting"){
   const sido=SYNC_SIDOS[Number(job.sido_index)],page=Number(job.page);
   const result=await monthlyList(env,sido,String(job.from_date),String(job.to_date),page);
   if(page>1&&result.rawCount&&job.last_page_key===result.fingerprint)throw new ServiceError("sync:pagination-repeat");
   if(!result.rawCount&&Number(job.seen)<result.total)throw new ServiceError("sync:incomplete-page");
   const existing=await db.prepare("SELECT code,payload FROM ltc_sync_queue WHERE job_id = ? AND code IN (SELECT value FROM json_each(?))").bind(id,JSON.stringify(result.items.map(x=>x.code))).all();
   const merged=result.items.map(c=>{const old=existing.results.find(x=>x.code===c.code);if(!old)return c;const p=JSON.parse(String(old.payload)) as SyncCandidate;return {...c,desig:p.desig>c.desig?p.desig:c.desig,kinds:[...new Set([...p.kinds,...c.kinds])],types:[...new Set([...p.types,...c.types])]};});
   const next=Number(job.seen)+result.rawCount>=result.total;
   const index=Number(job.sido_index)+(next?1:0);
   await db.batch([
    db.prepare("INSERT INTO ltc_sync_queue (job_id,code,payload) SELECT ?,json_extract(value,'$.code'),json(value) FROM json_each(?) WHERE true ON CONFLICT(job_id,code) DO UPDATE SET payload=excluded.payload").bind(id,JSON.stringify(merged)),
    db.prepare("UPDATE ltc_sync_jobs SET sido_index=?,page=?,seen=?,last_page_key=?,scanned=scanned+?,status=?,error_code=NULL WHERE id=? AND lease_owner=?").bind(index,next?1:page+1,next?0:Number(job.seen)+result.rawCount,next?"":result.fingerprint,result.rawCount,index>=SYNC_SIDOS.length?"publishing":"collecting",id,owner),
   ]);
  }else{
   const pending=await db.prepare("SELECT code,payload FROM ltc_sync_queue WHERE job_id=? AND done=0 ORDER BY code LIMIT 4").bind(id).all();
   if(!pending.results.length){await db.prepare("UPDATE ltc_sync_jobs SET status=CASE WHEN unresolved>0 THEN 'complete_with_warnings' ELSE 'complete' END,completed_at=?,error_code=NULL WHERE id=? AND lease_owner=?").bind(now(),id,owner).run();}
   const outcomes=await Promise.allSettled(pending.results.map(async row=>{
    const c=JSON.parse(String(row.payload)) as SyncCandidate;
    const current=await db.prepare("SELECT code,name,addr,kinds,grades,desig,lat,lng,ptype,ver FROM ltc WHERE code=?").bind(c.code).first();
    const newKinds=[...new Set([...(current?JSON.parse(String(current.kinds)):[]),...c.kinds])];
    // Unchanged known institutions already have verified coordinates; avoid repeat external calls.
    if(current&&current.name===c.name&&String(current.desig)>=c.desig&&JSON.stringify([...JSON.parse(String(current.kinds))].sort())===JSON.stringify([...newKinds].sort())&&current.lat!=null&&current.lng!=null){
     await db.prepare("UPDATE ltc_sync_queue SET done=1 WHERE job_id=? AND code=?").bind(id,c.code).run();return;
    }
    const resolved=await resolveMonthly(env,c);
    if(!resolved){await db.batch([db.prepare("UPDATE ltc_sync_queue SET done=2,error_code='map_unverified' WHERE job_id=? AND code=?").bind(id,c.code),db.prepare("UPDATE ltc_sync_jobs SET unresolved=unresolved+1 WHERE id=? AND lease_owner=?").bind(id,owner)]);return;}
    // Never delete existing records or overwrite assessment grades/capacity with missing API fields.
    await db.batch([
     db.prepare(`INSERT INTO ltc (code,name,addr,sido,desig,kinds,grades,ptype,cap,ver,lat,lng,geo_fail,phone,phone_at,dong,approx) VALUES (?,?,?,?,?,?,'{}',?,0,?,?,?,0,?,?,'',0)
      ON CONFLICT(code) DO UPDATE SET name=excluded.name,addr=excluded.addr,sido=excluded.sido,desig=CASE WHEN excluded.desig>ltc.desig THEN excluded.desig ELSE ltc.desig END,kinds=excluded.kinds,lat=excluded.lat,lng=excluded.lng,geo_fail=0,approx=0,phone=CASE WHEN excluded.phone!='' THEN excluded.phone ELSE ltc.phone END,phone_at=CASE WHEN excluded.phone!='' THEN excluded.phone_at ELSE ltc.phone_at END`).bind(c.code,c.name,resolved.addr,c.sido,c.desig,JSON.stringify(newKinds),current?.ptype||c.types[0],current?.ver||"2026-06-25",resolved.lat,resolved.lng,resolved.phone,now()),
     db.prepare("UPDATE ltc_sync_queue SET done=1,error_code=NULL WHERE job_id=? AND code=?").bind(id,c.code),
     db.prepare(`UPDATE ltc_sync_jobs SET ${current?"updated":"added"}=${current?"updated":"added"}+1,error_code=NULL WHERE id=? AND lease_owner=?`).bind(id,owner),
    ]);
   }));
   const failed=outcomes.find(x=>x.status==="rejected");if(failed?.status==="rejected")throw failed.reason;
  }
 }catch(e){
  const code=e instanceof ServiceError&&/^sync:[a-z-]+$/.test(e.message)?e.message.replace("sync:",""):e instanceof ServiceError&&e.message.startsWith("profile:")?"detail-provider":"temporary-provider-error";
  await db.prepare("UPDATE ltc_sync_jobs SET error_code=? WHERE id=? AND lease_owner=?").bind(code,id,owner).run();
  return json({done:false,retry:true,error:code,job:syncSummary(await db.prepare("SELECT * FROM ltc_sync_jobs WHERE id=?").bind(id).first())},503);
 }finally{await db.prepare("UPDATE ltc_sync_jobs SET lease_until=0,lease_owner=NULL WHERE id=? AND lease_owner=?").bind(id,owner).run();}
 const final=await db.prepare("SELECT * FROM ltc_sync_jobs WHERE id=?").bind(id).first();
 return json({done:!!final?.completed_at&&id===period,job:syncSummary(final)});
}

async function ltcPublic(request: Request, env: Env, db: D1 | undefined, action: string): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  if(request.method==="POST"&&["search","place"].includes(action)){
    if(Number(request.headers.get("content-length"))>2048)return fail(413,"검색 요청이 너무 큽니다.");
    try {
      const reader=request.body?.getReader();if(!reader)return fail(400,"검색 조건을 다시 확인해 주세요.");
      const chunks:Uint8Array[]=[];let size=0;
      while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>2048){await reader.cancel();return fail(413,"검색 요청이 너무 큽니다.");}chunks.push(chunk.value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const input=JSON.parse(new TextDecoder().decode(bytes)) as Record<string,unknown>;
      if(!input||typeof input!=="object"||Array.isArray(input))return fail(400,"검색 조건을 다시 확인해 주세요.");
      for(const key of action==="search"?["lat","lng","r","kinds","sort"]:["q"]){const value=input[key];if(typeof value==="string"||typeof value==="number")q.set(key,String(value));}
    }catch{return fail(400,"검색 조건을 다시 확인해 주세요.");}
  }
  try {
    if(action==="update-status"){
      if(!db)return json({available:false,current:null,lastCompleted:null});
      const status=await cachedPublic<Row>(request,"monthly-update-status",60,()=>syncStatus(db));return json(status.value);
    }
    // Bounded, read-only monthly integration preview. No DB imports or scheduled writes.
    if(action==="new-preview") {
      const today=new Date();
      const start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-1,1)).toISOString().slice(0,10);
      const end=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),0)).toISOString().slice(0,10);
      const scope=q.get("scope")==="seoul"?"seoul":q.get("scope")==="control"?"control":"eunpyeong";
      const district=scope==="control"?"110":scope==="eunpyeong"?"380":null;
      const preview=await cachedPublic<Row>(request,`new-preview-v4/${scope}/${start}`,300,async()=>{
        if(!env.DATA_GO_KR_KEY)return {ok:false,providerCode:"KEY_NOT_CONFIGURED"};
        const raw=env.DATA_GO_KR_KEY.trim();
        const key=encodeURIComponent(raw.includes("%")?decodeURIComponent(raw):raw);
        const query=new URLSearchParams({siDoCd:"11",pageNo:"1",numOfRows:"10"});
        if(scope!=="seoul")query.set("adminPttnCd",scope==="control"?"A03":"C01");
        if(district)query.set("siGunGuCd",district);
        if(scope==="control")query.set("adminNm","청운노인요양원");
        else {query.set("startRgtDt",start.replace(/-/g,""));query.set("endRgtDt",end.replace(/-/g,""));}
        const r=await fetch(`${env.DATA_GO_KR_BASE||"https://apis.data.go.kr"}/B550928/searchLtcInsttService02/getLtcInsttSeachList02?serviceKey=${key}&${query}`,{signal:AbortSignal.timeout(12000)});
        const xml=await r.text();
        const status=xmlValue(xml,"resultCode"),auth=xmlValue(xml,"returnAuthMsg");
        if(!r.ok||auth||!['00','0'].includes(status)||!/<response[\s>]/.test(xml)){
          const code=auth||status;
          return {ok:false,providerCode:/^[A-Z0-9_]{1,80}$/.test(code)?code:"UPSTREAM_RESPONSE_ERROR"};
        }
        const rawItems=Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g));
        const items=rawItems.slice(0,10).map(match=>{
          const item=match[1];return {code:xmlValue(item,"longTermAdminSym"),name:xmlValue(item,"adminNm"),type:xmlValue(item,"adminPttnCd"),sido:xmlValue(item,"siDoCd"),district:xmlValue(item,"siGunGuCd"),designated:profileDate(xmlValue(item,"longTermPeribRgtDt")),registered:profileDate(xmlValue(item,"stpRptDt"))};
        });
        const total=xmlValue(xml,"totalCount");
        return {ok:true,providerCode:status,sampleOnly:true,scope,area:scope==="control"?"서울 종로구":scope==="seoul"?"서울 전체":"서울 은평구",kind:scope==="control"?"요양원 A03":scope==="seoul"?"전체 유형":"방문요양 C01",from:scope==="control"?null:start,to:scope==="control"?null:end,total:/^\d+$/.test(total)?Number(total):null,returned:items.length,uniqueSampleInstitutions:new Set(items.map(x=>x.code)).size,filterBasis:"기관지정일",dateFilterVerified:scope!=="control"&&items.length?items.every(x=>x.designated&&x.designated>=start&&x.designated<=end):null,areaFilterVerified:items.length?items.every(x=>x.sido==='11'&&(!district||x.district===district)):null,controlMatched:scope==='control'?items.some(x=>x.code==='11111000006'):null,items,checkedAt:now()};
      });
      const response=json(preview.value,preview.value.ok?200:502);
      response.headers.set("x-ltc-new-preview-cache",preview.cache);return response;
    }
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
      const revision=await syncRevision(request,db);
      const candidates = await cachedPublic<Row[]>(request,`area/${revision}/${bounds.join(",")}`,3600,async()=>{
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

    if(action==="profile") {
      const code=str(q.get("c"),20);if(!/^\d{8,15}$/.test(code))return fail(400,"기관 주소를 다시 확인해 주세요.");
      // Cache each source separately so one temporary failure cannot erase another section.
      const identity=await cachedPublic<Row|null>(request,`profile-identity/${code}`,3600,async()=>{
        if(!db)throw new ServiceError("setup:DB");
        return db.prepare("SELECT code, ptype FROM ltc WHERE code = ?").bind(code).first();
      });
      if(!identity.value)return fail(404,"기관을 찾을 수 없어요.");
      const ptype=String(identity.value.ptype);
      const general=cachedPublic<Row>(request,`profile-general-v1/${code}/${ptype}`,86400,async()=>{
        const item=await nhisProfileItem(env,"getGeneralSttusDetailInfoItem02",code,ptype);
        return {status:item?"ok":"empty",installed:profileDate(xmlValue(item,"stpRptDt")),designated:profileDate(xmlValue(item,"longTermPeribRgtDt")),phone:["locTelNo_1","locTelNo_2","locTelNo_3"].map(t=>xmlValue(item,t)).filter(Boolean).join("-"),fetchedAt:now()};
      });
      const workforce=(async()=>{
        // Operation confirmed from the user's approved public-data API guide.
        const operation="getStaffSttusDetailInfoItem02";
        return cachedPublic<Row>(request,`profile-staff-v1/${operation}/${code}/${ptype}`,86400,async()=>{
          const item=await nhisProfileItem(env,operation,code,ptype);
          const staff=Object.entries(profileStaffFields).map(([key,label])=>{const raw=xmlValue(item,key);return {key,label,count:/^\d+$/.test(raw)?Number(raw):null};});
          return {status:item?"ok":"empty",staff,fetchedAt:now()};
        });
      })();
      const [g,w]=await Promise.allSettled([general,workforce]);
      return json({general:g.status==="fulfilled"?g.value.value:{status:"unavailable"},workforce:w.status==="fulfilled"?w.value.value:{status:"unavailable"}});
    }
    // Individual public institution detail, indexed by its primary key and cached.
    if (action === "detail") {
      const code = str(q.get("c"),20);
      if (!/^\d{8,15}$/.test(code)) return fail(400,"기관 주소를 다시 확인해 주세요.");
      const revision=await syncRevision(request,db);
      const detail = await cachedPublic<Row | null>(request,`detail/${revision}/${code}`,3600,async()=>{
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
