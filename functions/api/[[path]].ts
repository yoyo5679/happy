// 고객 장부 API (Cloudflare Pages Functions + D1)
// - 직원용: /api/staff/...  (Authorization: Bearer <STAFF_PASSWORD>)
// - 보호자용: /api/my?k=<링크 키>  (읽기 전용, 이름 가림)
// Cloudflare Pages 설정 → 바인딩에 D1 데이터베이스를 "DB"로, 환경 변수(비밀)에 STAFF_PASSWORD를 넣어야 동작합니다.

type D1Result<T> = { results: T[] };
type D1Stmt = {
  bind(...v: unknown[]): D1Stmt;
  all<T = Row>(): Promise<D1Result<T>>;
  first<T = Row>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type D1 = { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> };
type Env = { DB?: D1; STAFF_PASSWORD?: string; IMWEB_API_KEY?: string; IMWEB_SECRET_KEY?: string; IMWEB_BASE?: string; KAKAO_REST_KEY?: string; DATA_GO_KR_KEY?: string; KAKAO_BASE?: string; DATA_GO_KR_BASE?: string };
type Ctx = { request: Request; env: Env; params: { path?: string[] } };
type Row = Record<string, unknown>;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL, grade TEXT NOT NULL DEFAULT '',
    rate REAL NOT NULL DEFAULT 0.15, period_start TEXT NOT NULL, base_remaining INTEGER NOT NULL,
    base_date TEXT NOT NULL, guardian TEXT NOT NULL DEFAULT '', memo TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL, kind TEXT NOT NULL, product_id TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, price INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL, end_date TEXT, status TEXT NOT NULL DEFAULT 'active', note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS items_recipient ON items(recipient_id)`,
  // 동의 기록 (동의·광고수신 변경·철회). 철회로 장부가 지워져도 기록은 남깁니다.
  `CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL, action TEXT NOT NULL, method TEXT NOT NULL,
    version TEXT NOT NULL, signer TEXT NOT NULL DEFAULT '', relation TEXT NOT NULL DEFAULT '',
    marketing INTEGER NOT NULL DEFAULT 0, ua TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS consents_recipient ON consents(recipient_id)`,
  // 아임웹 주문 가져오기: 이미 장부에 넣었거나 숨긴 주문
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS imweb_orders (
    order_no TEXT PRIMARY KEY, action TEXT NOT NULL, recipient_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
];

// ───────── 아임웹 API (v2) ─────────
// 관리자 → 환경설정 → 외부 서비스 연동(API)에서 발급한 키. Cloudflare 암호 IMWEB_API_KEY / IMWEB_SECRET_KEY
const IMWEB_DEFAULT = "https://api.imweb.me/v2";
// 로컬 테스트용으로만 IMWEB_BASE를 바꿉니다
let IMWEB = IMWEB_DEFAULT;
let imwebToken: { token: string; at: number } | null = null;
const TOKEN_TTL = 30 * 60_000;

class ImwebError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 아임웹 호출 제한(초당 5건): 호출 사이 최소 350ms, 제한에 걸리면 기다렸다가 최대 3번 다시
let lastCall = 0;
async function throttle() {
  const wait = lastCall + 350 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}
const tooMany = (r: Response, j: Row) => r.status === 429 || /TOO\s*MANY/i.test(String(j.msg ?? j.message ?? ""));

async function imwebFetch(url: string, init?: RequestInit): Promise<{ r: Response; j: Row }> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    const r = await fetch(url, init);
    const j = (await r.json().catch(() => ({}))) as Row;
    if (tooMany(r, j) && attempt < 3) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    return { r, j };
  }
}

// 토큰은 D1에 저장해 여러 서버(인스턴스)가 같이 씀 → 인증 호출을 줄여 제한에 덜 걸리게
async function imwebAuth(env: Env, db: D1, fresh = false) {
  if (!env.IMWEB_API_KEY || !env.IMWEB_SECRET_KEY) throw new ImwebError("setup:IMWEB");
  IMWEB = env.IMWEB_BASE || IMWEB_DEFAULT;
  if (!fresh && imwebToken && Date.now() - imwebToken.at < TOKEN_TTL) return imwebToken.token;
  if (!fresh) {
    const saved = await db.prepare("SELECT value, at FROM kv WHERE key = 'imweb_token'").first();
    if (saved && Date.now() - Number(saved.at) < TOKEN_TTL) {
      imwebToken = { token: String(saved.value), at: Number(saved.at) };
      return imwebToken.token;
    }
  }
  const q = new URLSearchParams({ key: env.IMWEB_API_KEY, secret: env.IMWEB_SECRET_KEY });
  const tokenOf = (j: Row) => (j.access_token ?? (j.data as Row | undefined)?.access_token) as string | undefined;
  let { r, j } = await imwebFetch(`${IMWEB}/auth?${q}`);
  // 문서 버전에 따라 POST(JSON)만 받는 경우도 있어 한 번 더 시도
  if (!tokenOf(j) && !tooMany(r, j)) {
    ({ r, j } = await imwebFetch(`${IMWEB}/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: env.IMWEB_API_KEY, secret: env.IMWEB_SECRET_KEY }),
    }));
  }
  const token = tokenOf(j);
  if (!token) {
    if (tooMany(r, j)) throw new ImwebError("아임웹 호출이 잠시 많아요. 10초쯤 뒤에 다시 눌러 주세요.");
    throw new ImwebError(`아임웹 인증 실패: ${String(j.msg ?? j.message ?? r.status)} (키·시크릿을 확인해 주세요)`);
  }
  imwebToken = { token, at: Date.now() };
  await db.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('imweb_token', ?, ?)").bind(token, imwebToken.at).run();
  return token;
}

async function imwebGet(env: Env, db: D1, path: string, retry = true): Promise<Row> {
  const token = await imwebAuth(env, db);
  const { r, j } = await imwebFetch(`${IMWEB}${path}`, { headers: { "access-token": token } });
  // 토큰 만료 → 한 번만 새 토큰으로 다시
  if (retry && (r.status === 401 || j.code === -5 || j.code === 401)) {
    imwebToken = null;
    await imwebAuth(env, db, true);
    return imwebGet(env, db, path, false);
  }
  if (tooMany(r, j)) throw new ImwebError("아임웹 호출이 잠시 많아요. 10초쯤 뒤에 다시 눌러 주세요.");
  if (!r.ok || (typeof j.code === "number" && j.code !== 200)) throw new ImwebError(`아임웹 응답 오류: ${String(j.msg ?? j.message ?? r.status)}`);
  return j;
}

// 장부에서 아임웹 주문 품목을 지우면, 그 주문의 품목이 하나도 안 남았을 때 '처리함' 표시를 풀어 다시 가져올 수 있게
async function releaseImwebOrders(db: D1, notes: unknown[]) {
  const nos = new Set(notes.map((n) => String(n ?? "").match(/아임웹 주문 (\S+)/)?.[1]).filter(Boolean) as string[]);
  for (const no of nos) {
    const left = await db.prepare("SELECT 1 FROM items WHERE note LIKE ? LIMIT 1").bind(`%아임웹 주문 ${no}%`).first();
    if (!left) await db.prepare("DELETE FROM imweb_orders WHERE order_no = ? AND action = 'added'").bind(no).run();
  }
}

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const pick = (o: unknown, ...keys: string[]): unknown => {
  let cur: unknown = o;
  for (const k of keys) cur = cur && typeof cur === "object" ? (cur as Row)[k] : undefined;
  return cur;
};
const asList = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : v && typeof v === "object" ? (Object.values(v) as Row[]) : []);

/** 주문 목록 응답을 필요한 값만 정리 (필드 이름이 조금 달라도 버티도록) */
function normOrder(o: Row) {
  const t = Number(o.order_time ?? o.order_date ?? pick(o, "payment", "pay_time") ?? 0);
  const time = t > 1e12 ? t : t * 1000;
  return {
    order_no: String(o.order_no ?? o.order_code ?? ""),
    date: time ? new Date(time + 9 * 3600_000).toISOString().slice(0, 10) : "",
    // 주문자 번호는 서버 안에서 대조에만 쓰고 화면에는 끝 4자리만 보냄
    phones: [pick(o, "orderer", "call"), pick(o, "orderer", "call2"), pick(o, "delivery", "address", "phone"), pick(o, "delivery", "address", "phone2")]
      .map(digits)
      .filter((x) => x.length >= 8),
    total: Number(pick(o, "payment", "total_price") ?? pick(o, "payment", "price") ?? 0),
  };
}

/** 직원 화면용 주문: 번호 원문 대신 끝 4자리 + 대조값 + 번호로 찾은 어르신 */
async function forStaff(db: D1, n: ReturnType<typeof normOrder>, recHashes: Row[]) {
  const hashes = await Promise.all(n.phones.map((p) => phoneHash(db, p)));
  const hit = recHashes.find((r) => hashes.includes(String(r.guardian_hash)));
  return {
    order_no: n.order_no,
    date: n.date,
    total: n.total,
    phone_tail: n.phones[0]?.slice(-4) ?? "",
    phone_hash: hashes[0] ?? "",
    phone_rid: hit ? String(hit.id) : "",
  };
}

// ── 주문서에 적힌 어르신(수급자) 성함 찾기 ──
// 주문서 추가 항목이 {title, value} 꼴이거나, 키 이름·옵션 글자에 "수급자/어르신/대상자" 등이 들어 있는 경우를 찾습니다.
const ELDER_LABEL = /(어르신|수급자|대상자|이용자|사용자|recipient|elder|patient)/i;
const NOT_ELDER = /(주문자|받는|수령|배송|입금|예금주|보호자|orderer|delivery|receiver|depositor)/i;
const cleanName = (v: unknown) => {
  const m = String(v ?? "").replace(/님/g, " ").match(/[가-힣]{2,5}/);
  return m ? m[0] : "";
};
function findElder(...sources: unknown[]): { name: string; from: string } | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, key: string, depth: number): { name: string; from: string } | null => {
    if (depth > 7 || v == null || seen.has(v)) return null;
    if (typeof v === "string") {
      if (ELDER_LABEL.test(key) && !NOT_ELDER.test(key) && cleanName(v)) return { name: cleanName(v), from: key };
      // 옵션 글자 안: "수급자 성함: 김순자"
      const m = v.match(/(어르신|수급자|대상자|이용자)\s*(성함|이름|명)?\s*[:：]\s*([가-힣]{2,5})/);
      return m ? { name: m[3], from: `${m[1]}${m[2] ?? ""}` } : null;
    }
    if (typeof v !== "object") return null;
    seen.add(v);
    const o = v as Row;
    // {title|name|label: "수급자 성함", value|answer: "김순자"}
    const label = String(o.title ?? o.label ?? o.question ?? o.name ?? o.key ?? "");
    const val = o.value ?? o.answer ?? o.content ?? o.text;
    if (label && ELDER_LABEL.test(label) && !NOT_ELDER.test(label) && typeof val === "string" && cleanName(val)) return { name: cleanName(val), from: label };
    for (const [k, x] of Object.entries(o)) {
      const hit = walk(x, k, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  for (const src of sources) {
    const hit = walk(src, "", 0);
    if (hit) return hit;
  }
  return null;
}

// 연결 확인용: 응답 구조(경로 = 값)를 개인정보는 가려서 보여 줌
function describe(v: unknown, path = "", out: string[] = [], depth = 0): string[] {
  if (out.length > 120 || depth > 7) return out;
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Row)) describe(x, path ? `${path}.${k}` : k, out, depth + 1);
    return out;
  }
  const str = String(v ?? "");
  const keep = /(title|label|question|status|type|code|key|_no|time|date|price|count|prod_name|option_name)$/i.test(path) || /^\d{1,6}$/.test(str);
  out.push(`${path} = ${keep ? str.slice(0, 40) : str ? str[0] + "○".repeat(Math.min(str.length - 1, 6)) : ""}`);
  return out;
}

function normItems(prodOrders: unknown) {
  const out: { prod_no: string; name: string; count: number; price: number; status: string }[] = [];
  for (const po of asList(prodOrders)) {
    const status = String(po.status ?? "");
    for (const it of asList(po.items ?? po.item ?? [])) {
      out.push({
        prod_no: String(it.prod_no ?? it.prod_code ?? ""),
        name: String(it.prod_name ?? it.name ?? ""),
        count: Number(pick(it, "payment", "count") ?? it.count ?? it.ea ?? 1) || 1,
        price: Number(pick(it, "payment", "price") ?? it.price ?? 0),
        status: String(it.status ?? status),
      });
    }
  }
  return out;
}

// src/data/consent.ts 의 CONSENT_VERSION 과 같게 유지 (문구가 바뀌면 다시 동의를 받습니다)
const CONSENT_VERSION = "2026-11-v2";

type Consent = { at: string; method: string; signer: string; relation: string; version: string; marketing: boolean; current: boolean };

function consentFrom(rows: Row[]): Consent | null {
  // rows: 최신순
  const agree = rows.find((r) => r.action === "agree");
  if (!agree) return null;
  const mk = rows.find((r) => r.action === "agree" || r.action === "marketing")!;
  return {
    at: String(agree.created_at), method: String(agree.method), signer: String(agree.signer), relation: String(agree.relation),
    version: String(agree.version), marketing: mk.marketing === 1, current: agree.version === CONSENT_VERSION,
  };
}
const consentRows = (db: D1, rid: unknown) =>
  db.prepare("SELECT * FROM consents WHERE recipient_id = ? ORDER BY created_at DESC").bind(rid).all().then((r) => r.results);
const logConsent = (db: D1, rid: unknown, c: { action: string; method: string; version?: string; signer?: string; relation?: string; marketing?: boolean; ua?: string }) =>
  db
    .prepare("INSERT INTO consents (id, recipient_id, action, method, version, signer, relation, marketing, ua, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), rid, c.action, c.method, c.version ?? CONSENT_VERSION, c.signer ?? "", c.relation ?? "", c.marketing ? 1 : 0, (c.ua ?? "").slice(0, 200), now())
    .run();

// 최소 수집으로 바꾸면서 추가한 칸 (예전 DB에도 붙임 · 이미 있으면 오류 → 무시)
const MIGRATIONS = [
  `ALTER TABLE recipients ADD COLUMN guardian_hash TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE recipients ADD COLUMN needs_check INTEGER NOT NULL DEFAULT 0`,
];

let ready: Promise<unknown> | null = null;
const init = (db: D1) =>
  (ready ??= (async () => {
    await db.batch(SCHEMA.map((s) => db.prepare(s)));
    for (const m of MIGRATIONS) await db.prepare(m).run().catch(() => {});
    await minimizeOldData(db);
  })().catch((e) => {
    ready = null;
    throw e;
  }));

// ───────── 최소 수집 ─────────
// 보호자 휴대폰은 원래 번호로 되돌릴 수 없는 값(HMAC)으로만 저장 → 주문자 번호와 같은지 대조만 가능
async function phoneSalt(db: D1) {
  const row = await db.prepare("SELECT value FROM kv WHERE key = 'phone_salt'").first();
  if (row) return String(row.value);
  const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.prepare("INSERT OR IGNORE INTO kv (key, value, at) VALUES ('phone_salt', ?, ?)").bind(salt, Date.now()).run();
  return String((await db.prepare("SELECT value FROM kv WHERE key = 'phone_salt'").first())!.value);
}
async function phoneHash(db: D1, phone: unknown) {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 8) return "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(await phoneSalt(db)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(d.slice(-8))));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 예전에 저장한 등급·보호자 이름/번호·메모·브라우저 정보를 지우고, 번호는 대조용 값으로만 남김 */
async function minimizeOldData(db: D1) {
  const { results } = await db.prepare("SELECT id, guardian, guardian_hash FROM recipients WHERE guardian != '' OR grade != '' OR memo != ''").all();
  for (const r of results) {
    const h = r.guardian_hash ? String(r.guardian_hash) : await phoneHash(db, r.guardian);
    await db.prepare("UPDATE recipients SET guardian = '', grade = '', memo = '', guardian_hash = ? WHERE id = ?").bind(h, r.id).run();
  }
  await db.prepare("UPDATE consents SET ua = '' WHERE ua != ''").run();
}

/** 보유기간 지난 정보 파기: 3년 넘게 변동 없는 장부, 장부가 없어진 동의 기록, 오래된 주문 처리 기록 */
async function purgeExpired(db: D1) {
  const cut = new Date(Date.now() - 3 * 365 * 86400_000).toISOString();
  const { results } = await db.prepare("SELECT id FROM recipients WHERE updated_at < ?").bind(cut).all();
  for (const r of results) {
    await db.batch([db.prepare("DELETE FROM items WHERE recipient_id = ?").bind(r.id), db.prepare("DELETE FROM recipients WHERE id = ?").bind(r.id)]);
  }
  await db.prepare("DELETE FROM consents WHERE created_at < ? AND recipient_id NOT IN (SELECT id FROM recipients)").bind(cut).run();
  await db.prepare("DELETE FROM imweb_orders WHERE created_at < ?").bind(cut).run();
}

/** 직원 화면에 보내는 어르신 정보 (대조용 번호값은 보내지 않음) */
const pub = (r: Row) => ({
  id: r.id, token: r.token, name: r.name, rate: r.rate, period_start: r.period_start, base_remaining: r.base_remaining,
  base_date: r.base_date, needs_check: r.needs_check === 1, has_phone: !!r.guardian_hash, created_at: r.created_at, updated_at: r.updated_at,
});

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

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

const RATES = [0.15, 0.09, 0.06, 0];

function recipientFields(b: Row) {
  const name = str(b.name, 40);
  const rate = Number(b.rate);
  const base = int(b.base_remaining);
  if (!name) return "어르신 성함을 입력해 주세요";
  if (!RATES.includes(rate)) return "본인부담률이 올바르지 않아요";
  if (!isDate(b.period_start)) return "적용기간 시작일을 입력해 주세요";
  if (!isDate(b.base_date)) return "조회일을 입력해 주세요";
  if (!(base >= 0 && base <= 10_000_000)) return "조회 잔액을 확인해 주세요";
  return { name, rate, period_start: b.period_start, base_remaining: base, base_date: b.base_date, needs_check: b.needs_check === true ? 1 : 0 };
}

function itemFields(b: Row) {
  const kind = b.kind === "rent" ? "rent" : b.kind === "buy" ? "buy" : "";
  const name = str(b.name, 100);
  const price = int(b.price);
  const qty = kind === "rent" ? 1 : int(b.qty);
  if (!kind) return "구입/대여를 선택해 주세요";
  if (!name) return "품목 이름을 입력해 주세요";
  if (!(price > 0 && price <= 5_000_000)) return "금액을 확인해 주세요";
  if (!(qty >= 1 && qty <= 99)) return "수량을 확인해 주세요";
  if (!isDate(b.date)) return kind === "rent" ? "대여 시작일을 입력해 주세요" : "구입일을 입력해 주세요";
  const end = b.end_date ? (isDate(b.end_date) ? b.end_date : null) : null;
  if (b.end_date && !end) return "대여 종료일 형식이 올바르지 않아요";
  return {
    kind, product_id: str(b.product_id, 40), category: str(b.category, 40), name, price, qty, date: b.date,
    end_date: kind === "rent" ? end : null, status: b.status === "cancelled" ? "cancelled" : "active", note: str(b.note, 300),
  };
}

async function body(req: Request): Promise<Row> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Row) : {};
  } catch {
    return {};
  }
}

const maskName = (n: string) => (n.length <= 1 ? n : n.length === 2 ? n[0] + "○" : n[0] + "○".repeat(n.length - 2) + n[n.length - 1]);

export async function onRequest({ request, env, params }: Ctx): Promise<Response> {
  if (!env.DB) return fail(503, "setup:DB");
  const db = env.DB;
  await init(db);
  const path = params.path ?? [];
  const method = request.method;
  const url = new URL(request.url);

  // 장기요양기관 찾기 (공개)
  if (path[0] === "ltc" && path.length === 2) return ltcPublic(request, env, db, path[1]);

  // 보호자용: 동의 전에는 장부를 보여주지 않습니다
  if (path[0] === "my" && path.length <= 2) {
    const b = method === "POST" ? await body(request) : {};
    const k = method === "GET" ? url.searchParams.get("k") ?? "" : str(b.k, 64);
    if (k.length < 16) return fail(404, "링크를 다시 확인해 주세요");
    const r = await db.prepare("SELECT * FROM recipients WHERE token = ?").bind(k).first();
    if (!r) return fail(404, "링크가 만료되었거나 올바르지 않아요");
    const consent = consentFrom(await consentRows(db, r.id));
    const ua = ""; // 브라우저 정보는 수집하지 않음
    const action = path[1];

    if (method === "GET" && !action) {
      const name = maskName(String(r.name));
      if (!consent?.current) return json({ needConsent: true, version: CONSENT_VERSION, recipient: { name } });
      const { results } = await db
        .prepare("SELECT id, kind, product_id, category, name, price, qty, date, end_date, status FROM items WHERE recipient_id = ? AND status = 'active' ORDER BY date DESC")
        .bind(r.id)
        .all();
      return json({
        consent: { at: consent.at, marketing: consent.marketing },
        recipient: {
          name, rate: r.rate, period_start: r.period_start,
          base_remaining: r.base_remaining, base_date: r.base_date, updated_at: r.updated_at,
        },
        items: results,
      });
    }
    if (method === "POST" && action === "consent") {
      const signer = str(b.signer, 40);
      const relation = str(b.relation, 20);
      if (!signer || !relation) return fail(400, "동의하시는 분의 성함과 관계를 입력해 주세요");
      if (!(b.collect === true && b.sensitive === true && b.guardian === true && b.overseas === true)) return fail(400, "필수 항목에 모두 동의해 주세요");
      if (b.version !== CONSENT_VERSION) return fail(409, "동의서 내용이 바뀌었어요. 화면을 새로 고쳐 주세요");
      await logConsent(db, r.id, { action: "agree", method: "web", signer, relation, marketing: b.marketing === true, ua });
      return json({ ok: true });
    }
    if (method === "POST" && action === "marketing") {
      if (!consent) return fail(400, "먼저 이용 동의가 필요해요");
      await logConsent(db, r.id, { action: "marketing", method: "web", signer: consent.signer, relation: consent.relation, marketing: b.marketing === true, ua });
      return json({ ok: true });
    }
    // 동의 철회: 웹 장부 정보를 바로 지웁니다 (동의·철회 기록만 남김)
    if (method === "POST" && action === "withdraw") {
      await logConsent(db, r.id, { action: "withdraw", method: "web", signer: consent?.signer, relation: consent?.relation, ua });
      await db.batch([db.prepare("DELETE FROM items WHERE recipient_id = ?").bind(r.id), db.prepare("DELETE FROM recipients WHERE id = ?").bind(r.id)]);
      return json({ ok: true });
    }
    return fail(404, "없는 주소예요");
  }

  if (path[0] !== "staff") return fail(404, "없는 주소예요");
  if (!env.STAFF_PASSWORD) return fail(503, "setup:STAFF_PASSWORD");
  if (!(await isStaff(request, env))) {
    await new Promise((r) => setTimeout(r, 400));
    return fail(401, "비밀번호가 맞지 않아요");
  }
  const [, res, id, sub, subId] = path;

  if (res === "ping") return json({ ok: true });

  // 아임웹 주문 가져오기
  if (res === "ltc") return ltcStaff(request, env, db, String(id ?? ""));

  if (res === "imweb") {
    try {
      if (id === "check" && method === "GET") {
        const to = Math.floor(Date.now() / 1000);
        const j = await imwebGet(env, db, `/shop/orders?order_date_from=${to - 30 * 86400}&order_date_to=${to}&offset=1&limit=1`);
        const first = asList(pick(j, "data", "list"))[0];
        const no = first ? normOrder(first).order_no : "";
        const po = no ? await imwebGet(env, db, `/shop/orders/${encodeURIComponent(no)}/prod-orders`).catch(() => null) : null;
        return json({
          ok: true,
          count: Number(pick(j, "data", "pagenation", "data_count") ?? pick(j, "data", "pagination", "data_count") ?? 0) || null,
          sample: first ? { ...(await forStaff(db, normOrder(first), [])), elder: findElder(first, po?.data) } : null,
          keys: first ? [...describe(first, "order"), ...describe(po?.data, "prod_orders")] : [],
        });
      }
      if (id === "orders" && method === "GET") {
        // from=YYYY-MM-DD(한국 날짜)부터, 없으면 days일 전부터 (최대 1년)
        const fromQ = url.searchParams.get("from") ?? "";
        const fromTs = isDate(fromQ) ? Math.floor(Date.parse(`${fromQ}T00:00:00+09:00`) / 1000) : NaN;
        const days = Number.isFinite(fromTs)
          ? Math.min(366, Math.max(1, Math.ceil((Date.now() / 1000 - fromTs) / 86400)))
          : Math.min(366, Math.max(1, Number(url.searchParams.get("days")) || 30));
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const to = Math.floor(Date.now() / 1000);
        // 무료 요금제 외부 호출 50개 제한 + 아임웹 초당 5건 제한 → 한 번에 20건씩 (약 6초)
        const from = Number.isFinite(fromTs) ? fromTs : to - days * 86400;
        const j = await imwebGet(env, db, `/shop/orders?order_date_from=${from}&order_date_to=${to}&offset=${page}&limit=20`);
        const list = asList(pick(j, "data", "list")).map((o) => ({ raw: o, n: normOrder(o) }));
        const totalPage = Number(pick(j, "data", "pagenation", "total_page") ?? pick(j, "data", "pagination", "total_page") ?? 1) || 1;
        const { results: done } = await db.prepare("SELECT order_no, action FROM imweb_orders").all();
        const { results: recHashes } = await db.prepare("SELECT id, guardian_hash FROM recipients WHERE guardian_hash != ''").all();
        const doneSet = new Set(done.map((d) => String(d.order_no)));
        const orders = [];
        // 품목 조회가 중간에 막히면 그때까지 불러온 것만 돌려주고 partial로 알림
        let partial = false;
        for (const { n } of list) {
          if (!n.order_no || doneSet.has(n.order_no)) continue;
          try {
            const po = await imwebGet(env, db, `/shop/orders/${encodeURIComponent(n.order_no)}/prod-orders`);
            const raw = list.find((x) => x.n.order_no === n.order_no)!.raw;
            orders.push({ ...(await forStaff(db, n, recHashes)), items: normItems(po.data), elder: findElder(raw, po.data) });
          } catch (e) {
            if (!orders.length) throw e;
            partial = true;
            break;
          }
        }
        return json({ orders, page, totalPage, partial });
      }
      if (id === "mark" && method === "POST") {
        const b = await body(request);
        const orderNo = str(b.order_no, 60);
        const action = b.action === "added" ? "added" : "ignored";
        if (!orderNo) return fail(400, "주문번호가 없어요");
        await db
          .prepare("INSERT OR REPLACE INTO imweb_orders (order_no, action, recipient_id, created_at) VALUES (?,?,?,?)")
          .bind(orderNo, action, str(b.recipient_id, 60), now())
          .run();
        return json({ ok: true });
      }
    } catch (e) {
      if (e instanceof ImwebError) return fail(e.message.startsWith("setup:") ? 503 : 502, e.message);
      return fail(502, `아임웹에 연결하지 못했어요: ${(e as Error).message}`);
    }
  }

  if (res === "recipients") {
    // 목록
    if (!id && method === "GET") {
      await purgeExpired(db);
      const { results } = await db.prepare("SELECT * FROM recipients ORDER BY updated_at DESC").all();
      const { results: items } = await db.prepare("SELECT * FROM items WHERE status = 'active'").all();
      const { results: cs } = await db.prepare("SELECT * FROM consents ORDER BY created_at DESC").all();
      const consents: Record<string, Consent | null> = {};
      for (const rec of results) consents[String(rec.id)] = consentFrom(cs.filter((c) => c.recipient_id === rec.id));
      return json({ recipients: results.map(pub), items, consents });
    }
    // 등록
    if (!id && method === "POST") {
      const b = await body(request);
      const f = recipientFields(b);
      if (typeof f === "string") return fail(400, f);
      // 주문에서 등록할 때는 서버가 만든 대조값(guardian_hash)을 그대로, 직원이 입력하면 번호를 대조값으로 바꿔 저장
      const hash = /^[0-9a-f]{64}$/.test(String(b.guardian_hash ?? "")) ? String(b.guardian_hash) : await phoneHash(db, b.guardian_phone);
      const rid = crypto.randomUUID();
      const t = now();
      await db
        .prepare("INSERT INTO recipients (id, token, name, rate, period_start, base_remaining, base_date, guardian_hash, needs_check, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(rid, newToken(), f.name, f.rate, f.period_start, f.base_remaining, f.base_date, hash, f.needs_check, t, t)
        .run();
      return json({ id: rid }, 201);
    }
    const r = id ? await db.prepare("SELECT * FROM recipients WHERE id = ?").bind(id).first() : null;
    if (!r) return fail(404, "어르신 정보를 찾을 수 없어요");
    const touch = () => db.prepare("UPDATE recipients SET updated_at = ? WHERE id = ?").bind(now(), id).run();

    if (!sub) {
      if (method === "GET") {
        const { results } = await db.prepare("SELECT * FROM items WHERE recipient_id = ? ORDER BY date DESC, created_at DESC").bind(id).all();
        return json({ recipient: pub(r), items: results, consent: consentFrom(await consentRows(db, id)) });
      }
      if (method === "PUT") {
        const b = await body(request);
        const f = recipientFields(b);
        if (typeof f === "string") return fail(400, f);
        // 새 번호를 넣으면 대조값을 바꾸고, '번호 지우기'면 비움, 아니면 그대로
        const hash = b.clear_phone === true ? "" : str(b.guardian_phone, 30) ? await phoneHash(db, b.guardian_phone) : String(r.guardian_hash ?? "");
        await db
          .prepare("UPDATE recipients SET name=?, rate=?, period_start=?, base_remaining=?, base_date=?, guardian_hash=?, needs_check=?, updated_at=? WHERE id=?")
          .bind(f.name, f.rate, f.period_start, f.base_remaining, f.base_date, hash, f.needs_check, now(), id)
          .run();
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const { results: gone } = await db.prepare("SELECT note FROM items WHERE recipient_id = ?").bind(id).all();
        await db.batch([db.prepare("DELETE FROM items WHERE recipient_id = ?").bind(id), db.prepare("DELETE FROM recipients WHERE id = ?").bind(id)]);
        await releaseImwebOrders(db, gone.map((g) => g.note));
        return json({ ok: true });
      }
    }
    // 종이 동의서로 받은 경우 직원이 기록
    if (sub === "consent" && method === "POST") {
      const b = await body(request);
      const signer = str(b.signer, 40);
      const relation = str(b.relation, 20);
      if (!signer || !relation) return fail(400, "동의하신 분의 성함과 관계를 입력해 주세요");
      await logConsent(db, id, { action: "agree", method: "paper", signer, relation, marketing: b.marketing === true });
      return json({ ok: true });
    }
    // 보호자 링크 새로 만들기 (예전 링크는 더 이상 열리지 않음)
    if (sub === "token" && method === "POST") {
      const token = newToken();
      await db.prepare("UPDATE recipients SET token = ?, updated_at = ? WHERE id = ?").bind(token, now(), id).run();
      return json({ token });
    }
    if (sub === "items") {
      if (!subId && method === "POST") {
        const f = itemFields(await body(request));
        if (typeof f === "string") return fail(400, f);
        const iid = crypto.randomUUID();
        await db
          .prepare("INSERT INTO items (id, recipient_id, kind, product_id, category, name, price, qty, date, end_date, status, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(iid, id, f.kind, f.product_id, f.category, f.name, f.price, f.qty, f.date, f.end_date, f.status, f.note, now())
          .run();
        await touch();
        return json({ id: iid }, 201);
      }
      if (subId && method === "PUT") {
        const f = itemFields(await body(request));
        if (typeof f === "string") return fail(400, f);
        await db
          .prepare("UPDATE items SET kind=?, product_id=?, category=?, name=?, price=?, qty=?, date=?, end_date=?, status=?, note=? WHERE id=? AND recipient_id=?")
          .bind(f.kind, f.product_id, f.category, f.name, f.price, f.qty, f.date, f.end_date, f.status, f.note, subId, id)
          .run();
        await touch();
        return json({ ok: true });
      }
      if (subId && method === "DELETE") {
        const gone = await db.prepare("SELECT note FROM items WHERE id = ? AND recipient_id = ?").bind(subId, id).first();
        await db.prepare("DELETE FROM items WHERE id = ? AND recipient_id = ?").bind(subId, id).run();
        if (gone) await releaseImwebOrders(db, [gone.note]);
        await touch();
        return json({ ok: true });
      }
    }
  }
  return fail(404, "없는 주소예요");
}

// ───────── 장기요양기관 찾기 (공단 공개자료 + 카카오 좌표) ─────────
// 기관 목록은 public/ltc/facilities-{시도}.json (scripts/ltc/build.py) → 직원 화면에서 D1로 옮기고 좌표를 붙임
const LTC_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ltc (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, addr TEXT NOT NULL, sido TEXT NOT NULL, desig TEXT NOT NULL DEFAULT '',
    kinds TEXT NOT NULL, grades TEXT NOT NULL DEFAULT '{}', ptype TEXT NOT NULL DEFAULT '', cap INTEGER NOT NULL DEFAULT 0,
    ver TEXT NOT NULL DEFAULT '', lat REAL, lng REAL, geo_fail INTEGER NOT NULL DEFAULT 0, phone TEXT, phone_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ltc_lat ON ltc(lat)`,
];
// 나중에 붙인 칸: 법정동명(못 찾을 때 대체), 대략 위치 표시
const LTC_MIGRATIONS = [`ALTER TABLE ltc ADD COLUMN dong TEXT NOT NULL DEFAULT ''`, `ALTER TABLE ltc ADD COLUMN approx INTEGER NOT NULL DEFAULT 0`];
const LTC_KINDS = ["visit", "bath", "day", "short", "home"];

async function kakao(env: Env, path: string, q: Record<string, string>): Promise<Row> {
  if (!env.KAKAO_REST_KEY) throw new ImwebError("setup:KAKAO");
  const r = await fetch(`${env.KAKAO_BASE || "https://dapi.kakao.com"}${path}?${new URLSearchParams(q)}`, { headers: { Authorization: `KakaoAK ${env.KAKAO_REST_KEY}` } });
  const j = (await r.json().catch(() => ({}))) as Row;
  if (!r.ok) throw new ImwebError(`카카오 오류: ${String(j.message ?? j.msg ?? r.status)}`);
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

/** 누구나 쓰는 검색 (로그인 없음) */
async function ltcPublic(request: Request, env: Env, db: D1, action: string): Promise<Response> {
  await ltcInit(db);
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
      const { results } = await db
        .prepare("SELECT code, name, addr, desig, kinds, grades, cap, lat, lng, approx FROM ltc WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?")
        .bind(lat - dLat, lat + dLat, lng - dLng, lng + dLng)
        .all();
      const want = kinds.length ? kinds : LTC_KINDS;
      const rank = (g: string) => "ABCDE".indexOf(g) + 1 || 9;
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
        sort === "grade" ? a.best - b.best || a.km - b.km : sort === "old" ? String(a.desig || "9").localeCompare(String(b.desig || "9")) || a.km - b.km : a.km - b.km,
      );
      return json({ total: list.length, items: list.slice(0, 80).map(({ best: _b, ...x }) => ({ ...x, km: Math.round(x.km * 10) / 10 })) });
    }
    // 동네·주소로 위치 찾기: ?q=
    if (action === "place") {
      const text = (q.get("q") ?? "").trim().slice(0, 60);
      if (text.length < 2) return fail(400, "동네 이름이나 주소를 2글자 이상 입력해 주세요");
      const a = asList((await kakao(env, "/v2/local/search/address.json", { query: text, size: "5" })).documents);
      const k = a.length ? [] : asList((await kakao(env, "/v2/local/search/keyword.json", { query: text, size: "5" })).documents);
      const places = [...a.map((d) => ({ name: String(d.address_name), lat: Number(d.y), lng: Number(d.x) })), ...k.map((d) => ({ name: `${d.place_name} (${d.address_name})`, lat: Number(d.y), lng: Number(d.x) }))];
      return json({ places });
    }
    // 전화번호: 공단 API(일반현황)로 조회 후 30일 저장
    if (action === "phone") {
      const code = str(q.get("c"), 20);
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
  } catch (e) {
    if (e instanceof ImwebError) return fail(e.message.startsWith("setup:") ? 503 : 502, e.message);
    return fail(502, (e as Error).message);
  }
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
              if (e instanceof ImwebError && /setup|limit|quota|초과|권한|disabled/i.test(e.message)) throw e;
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
      const left = await db.prepare("SELECT COUNT(*) AS n FROM ltc WHERE lat IS NULL AND geo_fail < 2").first();
      return json({ done: out.filter((x) => x.lat != null).length, failed: out.filter((x) => x.lat == null).length, remaining: Number(left?.n ?? 0) });
    }
  } catch (e) {
    if (e instanceof ImwebError) return fail(e.message.startsWith("setup:") ? 503 : 502, e.message);
    return fail(502, (e as Error).message);
  }
  return fail(404, "없는 주소예요");
}
