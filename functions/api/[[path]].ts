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
type Env = { DB?: D1; STAFF_PASSWORD?: string };
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
];

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
