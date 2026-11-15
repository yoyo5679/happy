const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../out'),headers=fs.readFileSync(path.join(out,'_headers'),'utf8');
const rules=headers.split(/\n\n+/).map(x=>x.split('\n').filter(l=>l&&!l.startsWith('#'))).filter(x=>x.length);
const mapping=new Map(rules.filter(x=>x[0].startsWith('/')).map(x=>[x[0],x.slice(1).join('\n')]));
for(const page of ['index','care','care/detail','care/happycare','partner','privacy']){
 const html=fs.readFileSync(path.join(out,page+'.html'),'utf8'),route=page==='index'?'/':'/'+page,csp=mapping.get(route);assert(csp,'CSP exists for '+route);assert(!csp.includes("script-src 'self' 'unsafe-inline'"));assert(csp.includes("frame-ancestors 'none'"));
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/i.test(m[1]))assert(csp.includes('sha256-'+crypto.createHash('sha256').update(m[2]).digest('base64')),'inline script hash matches '+route);
}
assert(headers.includes('geolocation=(self)'));assert(headers.includes('Referrer-Policy: no-referrer'));assert(headers.includes('Strict-Transport-Security: max-age=31536000'));assert(headers.includes('/imweb/*\n  Access-Control-Allow-Origin: *'));
assert(rules.length<=100);assert(headers.split('\n').every(x=>Buffer.byteLength(x)<=2000));
console.log('PASS: build-specific CSP authorizes actual Next inline scripts, blocks foreign frames/scripts, preserves location permission and mall data access within Pages header limits.');
