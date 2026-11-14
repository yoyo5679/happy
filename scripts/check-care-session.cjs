const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),storage=new Map();
globalThis.sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
let clock=Date.now();Date.now=()=>clock;
function compile(file,requireFn=require){const e={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(e,requireFn);return e;}
function environment(){
 const session=compile('src/lib/care-search-session.ts');let active;
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={useState(initial){const h=active,i=h.cursor++;if(!(i in h.hooks))h.hooks[i]=typeof initial==='function'?initial():initial;return [h.hooks[i],v=>{const next=typeof v==='function'?v(h.hooks[i]):v;if(!Object.is(next,h.hooks[i])){h.hooks[i]=next;h.dirty=true;}}]},useEffect(fn,deps){const h=active,i=h.cursor++,prev=h.hooks[i];if(!prev||!equal(prev.deps,deps)){h.pending.push(()=>{prev?.cleanup?.();h.hooks[i]={deps,cleanup:fn()}})}},useCallback(fn,deps){const h=active,i=h.cursor++,prev=h.hooks[i];if(!prev||!equal(prev.deps,deps))h.hooks[i]={deps,fn};return h.hooks[i].fn}};
 const jsx=(type,props)=>({type,props});
 const component=compile('src/app/care/CareFinder.tsx',id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:id.includes('care-search-session')?session:id.includes('/facility')?{rememberFacility(){}}:id==='next/link'?{default:'link'}:new Proxy({},{get:(_,k)=>k})).CareFinder;
 function mount(){const h={hooks:[],pending:[],cursor:0,dirty:true,tree:null};h.flush=()=>{let loops=0;while(h.dirty){assert(++loops<30,'render loop');h.dirty=false;h.cursor=0;active=h;h.tree=component();const effects=h.pending.splice(0);for(const effect of effects)effect();}};h.unmount=()=>h.hooks.forEach(x=>x?.cleanup?.());h.flush();return h;}
 return {session,mount};
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
function text(tree){if(tree==null||tree===false)return '';if(typeof tree!=='object')return String(tree);if(Array.isArray(tree))return tree.map(text).join('');return text(tree.props?.children);}
const tick=()=>new Promise(r=>setImmediate(r));
async function settle(h){for(let i=0;i<5;i++){await tick();h.flush();}}
const choose=(h,kind,value)=>{const n=nodes(h.tree).find(kind);assert(n,'control exists');n.props.onChange({target:{value}});h.flush();};
const click=(h,label)=>{const n=nodes(h.tree).find(n=>n.type==='button'&&text(n)===label);assert(n,label);n.props.onClick();h.flush();};
const query=h=>nodes(h.tree).find(n=>n.type==='input').props.value;
const row={code:'11111000006',name:'테스트 기관',addr:'서울 은평구',desig:'2008-06-25',cap:30,kinds:['visit'],shown:['visit'],grades:{visit:['A',2025]},km:1,lat:37.61,lng:126.92};
let calls=[];globalThis.fetch=async url=>{calls.push(url);return new Response(JSON.stringify(url.includes('/place')?{places:[{name:'서울 은평구',lat:37.61,lng:126.92}]}:{items:[row],total:1}));};
(async()=>{
 let env=environment(),h=env.mount();assert.equal(calls.length,0,'opening search without a location does not query');
 choose(h,n=>n.type==='input','은평구');nodes(h.tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle(h);assert(text(h.tree).includes('기준 위치: 서울 은평구'));
 click(h,'🏠 방문요양');await settle(h);click(h,'최신 순');await settle(h);choose(h,n=>n.type==='select','10');await settle(h);
 assert.equal(env.session.restoreCareSearch().sort,'new');assert.equal(env.session.restoreCareSearch().radius,10);assert.deepEqual(env.session.restoreCareSearch().kinds,['visit']);
 const before=calls.length;h.unmount();h=env.mount();await settle(h);assert.equal(query(h),'은평구');assert.equal(calls.length,before,'returning from a detail reuses recent results without another search');assert(text(h.tree).includes('10km 안에 1곳'));
 h.unmount();env=environment();h=env.mount();await settle(h);assert.equal(query(h),'은평구');assert.equal(calls.length,before,'full reload restores tab state, not only module memory');
 const normalFetch=globalThis.fetch;let finishOld;globalThis.fetch=()=>new Promise(resolve=>{finishOld=resolve});
 click(h,'평가등급 순');click(h,'최신 순');finishOld(new Response(JSON.stringify({items:[{...row,name:'오래된 응답'}],total:1})));await settle(h);assert.equal(env.session.restoreCareSearch().result.items[0].name,row.name,'cancelled older response cannot replace the latest selection');globalThis.fetch=normalFetch;
 click(h,'복지용구');h.unmount();env=environment();h=env.mount();await settle(h);assert(nodes(h.tree).find(n=>text(n)==='복지용구'&&n.type==='button').props['aria-pressed'],'equipment category also survives a return');
 click(h,'🏠 방문요양');await settle(h); // Toggle normal category, then save again.
 h.unmount();clock+=301_000;globalThis.fetch=async()=>new Response(JSON.stringify({error:'잠시 후 다시 찾아 주세요.'}),{status:503});env=environment();h=env.mount();assert(text(h.tree).includes('10km 안에 1곳'),'stale result remains visible while refreshing');await settle(h);assert(text(h.tree).includes('10km 안에 1곳'),'temporary API failure keeps the last matching result');assert(text(h.tree).includes('잠시 후 다시 찾아 주세요.'));
 h.unmount();clock+=3600_001;env=environment();assert.equal(env.session.restoreCareSearch(),null,'expired location and results are not restored');
 storage.set('hc_care_search_v1','{broken');assert.equal(environment().session.restoreCareSearch(),null,'corrupt storage does not break search');
 console.log('PASS: detail return and full reload retain search settings/results; equipment state survives; fresh results avoid requests; background failure retains results; expired/corrupt sessions are ignored.');
})().catch(e=>{console.error(e);process.exit(1)});
