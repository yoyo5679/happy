const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../../functions/api/[[path]].ts'),'utf8'),e={};new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e);
const routes=['status','import','prune','retry','geocode'];
(async()=>{
 for(const action of routes)for(const method of ['GET','POST','DELETE']){
  const r=await e.onRequest({request:new Request('https://test.example/api/staff/ltc/'+action,{method,headers:{Authorization:'Bearer previously-valid-password'}}),env:{STAFF_PASSWORD:'previously-valid-password',DB:{prepare(){throw Error('retired management must not access DB')}}},params:{path:['staff','ltc',action]}});
  assert.equal(r.status,410);assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');
 }
 let calls=0;globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};
 globalThis.fetch=async url=>{calls++;assert(!String(url).includes('STAFF_PASSWORD'));return new Response(JSON.stringify({documents:[{address_name:'서울 은평구',x:'126.92',y:'37.6'}]}));};
 const r=await e.onRequest({request:new Request('https://test.example/api/ltc/place',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'은평구'})}),env:{KAKAO_REST_KEY:'fixture'},params:{path:['ltc','place']}});assert.equal(r.status,200);assert.equal(calls,1);assert.equal((await r.json()).places[0].lat,37.6);
 const bad=await e.onRequest({request:new Request('https://test.example/api/ltc/search',{method:'POST',body:JSON.stringify({lat:0,lng:0})}),env:{DB:{prepare(){throw Error('invalid coordinates must not access DB')}}},params:{path:['ltc','search']}});assert.equal(bad.status,400);
 const oversized=await e.onRequest({request:new Request('https://test.example/api/ltc/search',{method:'POST',body:'x'.repeat(3000)}),env:{DB:{prepare(){throw Error('oversized request must not access DB')}}},params:{path:['ltc','search']}});assert.equal(oversized.status,413);
 assert(!source.includes('STAFF_PASSWORD'));assert(!source.includes('DELETE FROM ltc WHERE ver'));
 console.log('PASS: old password management routes permanently closed without DB access, API hardening headers, POST address lookup and validation.');
})().catch(e=>{console.error(e);process.exit(1)});
