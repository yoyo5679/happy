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
  if(path[0]==="ltc"&&path[1]==="monthly-sync"&&path.length===2){
    if(request.method!=="POST")return fail(405,"POST 요청이 필요합니다.");
    if(!(await isSyncWorkflow(request)))return fail(401,"허용된 예약 실행만 사용할 수 있습니다.");
    if(!env.DB)return fail(503,"기관 데이터베이스에 연결하지 못했어요.");
    try{return await monthlyStep(request,env,env.DB);}catch{return fail(503,"기관 업데이트를 잠시 후 다시 시도해 주세요.");}
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
async function isSyncWorkflow(request:Request):Promise<boolean> {
 try {
  const token=(request.headers.get("authorization")??"").replace(/^Bearer /,"");
  if(token.length>16000)return false;
  const parts=token.split(".");if(parts.length!==3)return false;
  const header=JSON.parse(new TextDecoder().decode(unbase64url(parts[0]))),claims=JSON.parse(new TextDecoder().decode(unbase64url(parts[1])));
  const t=Math.floor(Date.now()/1000);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>120)return false;
  if(claims.iss!=="https://token.actions.githubusercontent.com"||claims.aud!==SYNC_AUDIENCE||claims.repository!==SYNC_REPO||claims.repository_id!=="1406565226"||claims.repository_owner_id!=="62796904"||claims.ref!==SYNC_REF||claims.workflow_ref!==SYNC_WORKFLOW||!["schedule","workflow_dispatch","push"].includes(claims.event_name))return false;
  if(typeof claims.exp!=="number"||claims.exp<=t||typeof claims.iat!=="number"||claims.iat>t+30||claims.iat<t-3600||typeof claims.nbf!=="number"||claims.nbf>t+30)return false;
  const keys=await cachedPublic<{keys:(JsonWebKey&{kid:string})[]}>(request,"github-oidc-keys",300,async()=>{
   const r=await fetch("https://token.actions.githubusercontent.com/.well-known/jwks",{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error("oidc");return r.json();
  });
  const jwk=keys.value.keys.find(k=>k.kid===header.kid&&k.kty==="RSA");if(!jwk)return false;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,unbase64url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
 }catch{return false;}
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
