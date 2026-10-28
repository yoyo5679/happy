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
type Env = { DB?: D1; STAFF_PASSWORD?: string; IMWEB_API_KEY?: string; IMWEB_SECRET_KEY?: string; IMWEB_BASE?: string };
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
    name: String(pick(o, "orderer", "name") ?? pick(o, "delivery", "address", "name") ?? ""),
    phones: [pick(o, "orderer", "call"), pick(o, "orderer", "call2"), pick(o, "delivery", "address", "phone"), pick(o, "delivery", "address", "phone2")]
      .map(digits)
      .filter((x) => x.length >= 8),
    total: Number(pick(o, "payment", "total_price") ?? pick(o, "payment", "price") ?? 0),
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
const CONSENT_VERSION = "2026-11-v1";

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

let ready: Promise<unknown> | null = null;
const init = (db: D1) => (ready ??= db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { ready = null; throw e; }));

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
  return {
    name, grade: str(b.grade, 20), rate, period_start: b.period_start, base_remaining: base, base_date: b.base_date,
    guardian: str(b.guardian, 100), memo: str(b.memo, 1000),
  };
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

  // 보호자용: 동의 전에는 장부를 보여주지 않습니다
  if (path[0] === "my" && path.length <= 2) {
    const b = method === "POST" ? await body(request) : {};
    const k = method === "GET" ? url.searchParams.get("k") ?? "" : str(b.k, 64);
    if (k.length < 16) return fail(404, "링크를 다시 확인해 주세요");
    const r = await db.prepare("SELECT * FROM recipients WHERE token = ?").bind(k).first();
    if (!r) return fail(404, "링크가 만료되었거나 올바르지 않아요");
    const consent = consentFrom(await consentRows(db, r.id));
    const ua = request.headers.get("user-agent") ?? "";
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
          name, grade: r.grade, rate: r.rate, period_start: r.period_start,
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
          sample: first ? { ...normOrder(first), elder: findElder(first, po?.data) } : null,
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
        const doneSet = new Set(done.map((d) => String(d.order_no)));
        const orders = [];
        // 품목 조회가 중간에 막히면 그때까지 불러온 것만 돌려주고 partial로 알림
        let partial = false;
        for (const { n } of list) {
          if (!n.order_no || doneSet.has(n.order_no)) continue;
          try {
            const po = await imwebGet(env, db, `/shop/orders/${encodeURIComponent(n.order_no)}/prod-orders`);
            const raw = list.find((x) => x.n.order_no === n.order_no)!.raw;
            orders.push({ ...n, items: normItems(po.data), elder: findElder(raw, po.data) });
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
      const { results } = await db.prepare("SELECT * FROM recipients ORDER BY updated_at DESC").all();
      const { results: items } = await db.prepare("SELECT * FROM items WHERE status = 'active'").all();
      const { results: cs } = await db.prepare("SELECT * FROM consents ORDER BY created_at DESC").all();
      const consents: Record<string, Consent | null> = {};
      for (const rec of results) consents[String(rec.id)] = consentFrom(cs.filter((c) => c.recipient_id === rec.id));
      return json({ recipients: results, items, consents });
    }
    // 등록
    if (!id && method === "POST") {
      const f = recipientFields(await body(request));
      if (typeof f === "string") return fail(400, f);
      const rid = crypto.randomUUID();
      const t = now();
      await db
        .prepare("INSERT INTO recipients (id, token, name, grade, rate, period_start, base_remaining, base_date, guardian, memo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(rid, newToken(), f.name, f.grade, f.rate, f.period_start, f.base_remaining, f.base_date, f.guardian, f.memo, t, t)
        .run();
      return json({ id: rid }, 201);
    }
    const r = id ? await db.prepare("SELECT * FROM recipients WHERE id = ?").bind(id).first() : null;
    if (!r) return fail(404, "어르신 정보를 찾을 수 없어요");
    const touch = () => db.prepare("UPDATE recipients SET updated_at = ? WHERE id = ?").bind(now(), id).run();

    if (!sub) {
      if (method === "GET") {
        const { results } = await db.prepare("SELECT * FROM items WHERE recipient_id = ? ORDER BY date DESC, created_at DESC").bind(id).all();
        return json({ recipient: r, items: results, consent: consentFrom(await consentRows(db, id)) });
      }
      if (method === "PUT") {
        const f = recipientFields(await body(request));
        if (typeof f === "string") return fail(400, f);
        await db
          .prepare("UPDATE recipients SET name=?, grade=?, rate=?, period_start=?, base_remaining=?, base_date=?, guardian=?, memo=?, updated_at=? WHERE id=?")
          .bind(f.name, f.grade, f.rate, f.period_start, f.base_remaining, f.base_date, f.guardian, f.memo, now(), id)
          .run();
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await db.batch([db.prepare("DELETE FROM items WHERE recipient_id = ?").bind(id), db.prepare("DELETE FROM recipients WHERE id = ?").bind(id)]);
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
        await db.prepare("DELETE FROM items WHERE id = ? AND recipient_id = ?").bind(subId, id).run();
        await touch();
        return json({ ok: true });
      }
    }
  }
  return fail(404, "없는 주소예요");
}
