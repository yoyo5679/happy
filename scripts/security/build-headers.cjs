const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=path.resolve(__dirname,'../../out');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]);}
const rules=[];
for(const file of files(out).filter(x=>x.endsWith('.html'))){
 const html=fs.readFileSync(file,'utf8'),hashes=new Set();
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/i.test(match[1]))hashes.add("'sha256-"+crypto.createHash('sha256').update(match[2]).digest('base64')+"'");
 const csp="default-src 'self'; script-src 'self' "+[...hashes].join(' ')+"; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests";
 const line='  Content-Security-Policy: '+csp;
 if(Buffer.byteLength(line)>2000)throw Error('CSP exceeds Cloudflare header line limit: '+file);
 const relative='/'+path.relative(out,file).split(path.sep).join('/');
 const canonical=relative==='/index.html'?'/':relative.replace(/\/index\.html$/,'/').replace(/\.html$/,'');
 for(const route of new Set([relative,canonical,...(canonical!=='/'?[canonical.replace(/\/$/,'')+'/']:[])]))rules.push(route+'\n'+line);
}
if(rules.length+3>100)throw Error('Too many Cloudflare header rules');
fs.writeFileSync(path.join(out,'_headers'),fs.readFileSync(path.resolve(__dirname,'../../public/_headers'),'utf8')+'\n'+rules.join('\n\n')+'\n');
console.log(`Generated hashed CSP for ${rules.length} HTML routes.`);
