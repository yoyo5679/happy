const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'functions/api/[[path]].ts'),'utf8');
const exportsObject={};
new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exportsObject);
const sql=[];
const db={prepare(text){return {text,bind(){return this},async first(){return {n:0}}}},async batch(statements){sql.push(...statements.map(s=>s.text))}};
(async()=>{
 for(const route of ['my','my/consent','my/withdraw','staff/ping','staff/recipients','staff/imweb/orders']){
  for(const method of ['GET','POST','PUT','DELETE']){
   const res=await exportsObject.onRequest({request:new Request(`https://example.com/api/${route}`,{method}),env:{DB:db},params:{path:route.split('/')}});
   assert.equal(res.status,410);assert.equal((await res.json()).ledgerCleanup,'complete');
  }
 }
 assert.deepEqual(sql,['DROP TABLE IF EXISTS items','DROP TABLE IF EXISTS consents','DROP TABLE IF EXISTS imweb_orders','DROP TABLE IF EXISTS recipients','DROP TABLE IF EXISTS kv']);
 require('node:child_process').execFileSync('python',['-c',`import sqlite3,json,sys
c=sqlite3.connect(':memory:')
for t in ['items','consents','imweb_orders','recipients','kv','ltc']:
 c.execute('CREATE TABLE '+t+' (value TEXT)');c.execute('INSERT INTO '+t+" VALUES ('dummy')")
for s in json.load(sys.stdin):c.execute(s)
assert c.execute("SELECT value FROM ltc").fetchone()[0]=='dummy'
assert c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()==[('ltc',)]
`],{input:JSON.stringify(sql)});
 for(const file of ['src/app/staff/StaffApp.tsx','src/app/my/MyLedger.tsx','src/app/my/ConsentForm.tsx','src/lib/ledger.ts','public/my.webmanifest'])assert(!fs.existsSync(path.join(root,file)));
 assert(!source.includes('CREATE TABLE IF NOT EXISTS recipients'));assert(!source.includes('api.imweb.me'));
 console.log('PASS: retired ledger read/write APIs return 410; ledger tables and cached credentials removed; public facility data preserved.');
})().catch(e=>{console.error(e);process.exit(1)});
