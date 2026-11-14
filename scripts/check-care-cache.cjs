const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'functions/api/[[path]].ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const saved=new Map();globalThis.caches={default:{async match(r){return saved.get(r.url)?.clone()},async put(r,res){saved.set(r.url,res.clone())}}};
function moduleApi(){const e={};new Function('exports',compiled)(e);return e.onRequest;}
const base={lat:37.60,lng:126.92};
const row=(code,lat,grade,date,kinds=['visit'])=>({code,name:code,addr:'서울특별시 은평구',desig:date,cap:0,kinds:JSON.stringify(kinds),grades:JSON.stringify({visit:[grade,2025]}),lat,lng:126.92,approx:0});
const rows=[row('near-C',37.601,'C','2010-01-01'),row('far-A',37.610,'A','2015-01-01'),row('old-unrated',37.603,'','2008-01-01'),row('outside',37.70,'A','2000-01-01'),row('bath-only',37.602,'A','2008-01-01',['bath'])];
const queries=[];let reads=0;
const db={prepare(sql){queries.push(sql);return {bind(...v){this.args=v;return this},async all(){assert(sql.includes('WHERE lat BETWEEN'));reads++;await new Promise(r=>setTimeout(r,5));return {results:rows}},async run(){assert(sql.includes('CREATE INDEX'));}}}};
function context(query,env={DB:db}){return {request:new Request(`https://test.example/api/ltc/search?lat=${base.lat}&lng=${base.lng}&r=5&kinds=visit&${query}`),env,params:{path:['ltc','search']}}}
(async()=>{
 let api=moduleApi();
 const [a,b]=await Promise.all([api(context('sort=near')),api(context('sort=grade'))]);
 assert.equal(reads,1,'concurrent sorts share one DB query');assert.equal((await a.json()).items[0].code,'near-C');assert.equal((await b.json()).items[0].code,'far-A');
 const before=queries.length;
 api=moduleApi(); // Simulate a new instance with no memory/shared promises.
 const hit=await api(context('sort=new',{DB:{prepare(){throw new Error('quota exceeded')}}}));
 assert.equal(hit.status,200);assert.equal(hit.headers.get('x-ltc-candidates-cache'),'HIT');const j=await hit.json();assert.equal(j.items[0].code,'far-A');assert.equal(j.total,3);assert(!j.items.some(r=>r.code==='outside'));
 const shifted=context('sort=near');shifted.request=new Request('https://test.example/api/ltc/search?lat=37.604&lng=126.92&r=5&kinds=visit');const shiftedResult=await api(shifted);assert.equal(shiftedResult.headers.get('x-ltc-candidates-cache'),'HIT');assert.equal((await shiftedResult.json()).items[0].code,'old-unrated','cached candidates still use exact GPS for distances');
 assert.equal(queries.length,before,'cache hit does not create indexes or query DB');assert(!queries.some(q=>/recipients|sqlite_master|ALTER TABLE/.test(q)),'public searches do not touch ledger/schema migrations');
 const bathCtx=context('sort=grade');bathCtx.request=new Request('https://test.example/api/ltc/search?lat=37.60&lng=126.92&r=5&kinds=bath');const bath=await api(bathCtx);assert.equal((await bath.json()).items[0].code,'bath-only');assert.equal(reads,1);
 const invalid=context('sort=near');invalid.request=new Request('https://test.example/api/ltc/search?lat=0&lng=0');assert.equal((await api(invalid)).status,400);
 const quota=context('sort=near',{DB:{prepare(){return {bind(){return this},async run(){},async all(){throw new Error("D1_ERROR: free tier daily row read limit")}}}}});quota.request=new Request('https://test.example/api/ltc/search?lat=35.1&lng=129.1&r=5');const fail=await api(quota);assert.equal(fail.status,503);const msg=(await fail.json()).error;assert(!/D1_ERROR|SQLITE/.test(msg));assert(msg.includes('오전 9시'));
 globalThis.fetch=async()=>new Response(JSON.stringify({documents:[{address_name:'서울 은평구',x:'126.92',y:'37.6'}]}),{status:200});
 const place={request:new Request('https://test.example/api/ltc/place?q=은평구'),env:{KAKAO_REST_KEY:'test-only'},params:{path:['ltc','place']}};assert.equal((await api(place)).status,200,'address lookup works without D1');delete place.env.KAKAO_REST_KEY;assert.equal((await api(place)).status,200,'address lookup cached');
 assert(!source.includes('SELECT COUNT(*) AS n FROM ltc WHERE lat IS NULL'));
 let detailReads=0;
 const detailCtx=(code,DB)=>({request:new Request(`https://test.example/api/ltc/detail?c=${code}`),env:{DB},params:{path:['ltc','detail']}});
 const detailDb={prepare(sql){assert(sql.includes('WHERE code = ?'),'details use primary key');return {bind(code){this.code=code;return this},async first(){detailReads++;return this.code==='12345678901'?{...rows[0],code:this.code,phone:'02-123-4567'}:null}}}};
 const detail=await api(detailCtx('12345678901',detailDb));assert.equal(detail.status,200);assert.deepEqual((await detail.json()).facility.kinds,['visit']);
 api=moduleApi();const detailHit=await api(detailCtx('12345678901',{prepare(){throw new Error('must use cache')}}));assert.equal(detailHit.status,200);assert.equal(detailHit.headers.get('x-ltc-detail-cache'),'HIT');assert.equal(detailReads,1);
 assert.equal((await api(detailCtx('bad',detailDb))).status,400);assert.equal((await api(detailCtx('99999999999',detailDb))).status,404);
 const snapshotSource=fs.readFileSync(path.join(root,'src/lib/facility.ts'),'utf8');const snapshotExports={};new Function('exports',ts.transpileModule(snapshotSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(snapshotExports);
 const snapshots=new Map();globalThis.sessionStorage={setItem(k,v){snapshots.set(k,v)},getItem(k){return snapshots.get(k)}};
 snapshotExports.rememberFacility({...rows[0],code:'12345678901',kinds:['visit'],grades:{},km:0.1,visitorLat:37.6});const restored=snapshotExports.restoreFacility('12345678901');assert(restored);assert(!('km' in restored));assert(!('visitorLat' in restored));
 // Profile integration: official field mappings, independent cached sections and honest failure states.
 const profileDb={prepare(sql){assert(sql.includes('WHERE code = ?'));return {bind(code){this.code=code;return this},async first(){return {code:this.code,ptype:'A03'}}}}};
 const profileCtx=code=>({request:new Request(`https://test.example/api/ltc/profile?c=${code}`),env:{DB:profileDb,DATA_GO_KR_KEY:'fixture-only'},params:{path:['ltc','profile']}});
 let profileFetches=0;globalThis.fetch=async url=>{profileFetches++;const u=new URL(url);assert.equal(u.searchParams.get('adminPttnCd'),'A03');const fields=u.pathname.endsWith('getStaffSttusDetailInfoItem02')?'<recuProt_1>23</recuProt_1><recuProt_2>0</recuProt_2><socWel></socWel>':'<stpRptDt>20100420</stpRptDt><longTermPeribRgtDt>20100501</longTermPeribRgtDt>';
 return new Response(`<response><header><resultCode>00</resultCode></header><body><item><longTermAdminSym>${u.searchParams.get('longTermAdminSym')}</longTermAdminSym><adminPttnCd>A03</adminPttnCd>${fields}</item></body></response>`);};
 let profile=await (await api(profileCtx('12345678902'))).json();assert.equal(profile.general.installed,'2010-04-20');assert.equal(profile.general.designated,'2010-05-01');assert.equal(profile.workforce.staff.find(x=>x.key==='recuProt_1').count,23);assert.equal(profile.workforce.staff.find(x=>x.key==='recuProt_2').count,0);assert.equal(profile.workforce.staff.find(x=>x.key==='socWel').count,null,'empty is unknown, never zero');
 await api(profileCtx('12345678902'));assert.equal(profileFetches,2,'repeat detail views reuse cached API responses');
 globalThis.fetch=async()=>new Response('<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>');
 profile=await (await api(profileCtx('12345678903'))).json();assert.equal(profile.general.status,'unavailable');assert.equal(profile.workforce.status,'unavailable');assert(!JSON.stringify(profile).includes('fixture-only'));
 globalThis.fetch=async url=>{const u=new URL(url);return new Response(`<response><header><resultCode>00</resultCode></header><body><item><longTermAdminSym>${u.searchParams.get('longTermAdminSym')}</longTermAdminSym><adminPttnCd>A03</adminPttnCd><stpRptDt>20260231</stpRptDt></item></body></response>`);};
 profile=await (await api(profileCtx('12345678903'))).json();assert.equal(profile.general.status,'ok','auth failure was not cached');assert.equal(profile.general.installed,null,'invalid calendar date is unknown');assert.equal(profile.workforce.status,'ok');assert(profile.workforce.staff.every(x=>x.count===null),'missing counts remain unknown');
 console.log('PASS: shared candidate cache, DB-free cache hits and address lookup, exact distance/grade/age filters, request validation and friendly quota errors.');
})().catch(e=>{console.error(e);process.exit(1)});
