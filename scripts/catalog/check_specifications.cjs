const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root=require('node:path').resolve(__dirname, '../..');
const products=JSON.parse(fs.readFileSync(`${root}/src/data/products.json`));
const compiled=ts.transpileModule(fs.readFileSync(`${root}/src/data/size-guide.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS, esModuleInterop:true}}).outputText;
const exportsObject={};
new Function('require','exports',compiled)(name=>name==='./products'?{products}:JSON.parse(fs.readFileSync(`${root}/src/data/${name.replace('./','')}`)),exportsObject);
const {sizeRows,specValue,comparableValue,excludedSizeCategories,availableSizeProduct}=exportsObject;
assert.equal(sizeRows.length,products.filter(p=>!excludedSizeCategories.includes(p.category)&&[p.buy,p.rent].some(l=>l&&!l.soldOut)).length);
assert.equal(new Set(sizeRows.map(r=>r.id)).size,sizeRows.length);
const audit=JSON.parse(fs.readFileSync(`${root}/src/data/specification-audit.json`));
assert.equal(Object.keys(audit.products).length,products.filter(p=>!excludedSizeCategories.includes(p.category)).length);
for(const row of sizeRows){assert(row.product.buy||row.product.rent);assert(!row.product.buy?.soldOut);assert(!row.product.rent?.soldOut);}
const mixed=availableSizeProduct({...products[0],buy:{price:100,url:"buy",soldOut:true},rent:{price:20,url:"rent",soldOut:false}});
assert.equal(mixed.buy,undefined);assert.equal(mixed.rent.price,20);
const unavailable=availableSizeProduct({...products[0],buy:{price:100,url:"buy",soldOut:true},rent:{price:20,url:"rent",soldOut:true}});assert.equal(unavailable.buy,undefined);assert.equal(unavailable.rent,undefined);
for(const row of sizeRows){assert(products.some(p=>p.id===row.id));assert(!excludedSizeCategories.includes(row.category));assert.notEqual(row.sourceStatus,'unregistered');assert.equal(audit.products[row.id].status,row.sourceStatus);if(row.spec){assert(row.spec.page>=1&&row.spec.page<=70);assert.equal(row.spec.category,row.category);assert.match(row.spec.code,/^[A-Z]\d{11}$/);}}
const unverified=sizeRows.find(r=>!r.spec);assert(unverified);assert.equal(specValue(unverified,'width'),'첨부 카탈로그 미수록');
const wheelchair=sizeRows.find(r=>r.category==='wheelchair'&&r.spec);assert(wheelchair);assert.equal(specValue(wheelchair,'load'),'원본 미기재');assert.match(specValue(wheelchair,'width'),/ cm$/);
const bed=sizeRows.find(r=>r.category==='electricBed'&&r.spec);assert(bed);assert.equal(specValue(bed,'seat'),'해당 없음');assert.match(specValue(bed,'height'),/ cm$/);
const ranged={...sizeRows[0],spec:{...sizeRows[0].spec,width:'중 44.5 / 대 49.5'}};assert.equal(comparableValue(ranged,'width'),44.5);
const removedSpec=JSON.parse(fs.readFileSync(`${root}/src/data/specifications.json`)).filter(s=>!products.some(p=>(p.code&&p.code===s.code)||(p.category===s.category&&p.name.toLowerCase().replace(/[^a-z0-9가-힣]/g,'')===s.name.toLowerCase().replace(/[^a-z0-9가-힣]/g,''))));
for(const s of removedSpec)assert(!sizeRows.some(r=>r.spec?.code===s.code));
const component=fs.readFileSync(`${root}/src/app/sizelist/SizeList.tsx`,'utf8');
assert(!component.includes('openSource'));assert(!component.includes('카탈로그 원본 보기'));assert(component.includes('다른 제원만 보기'));
assert(!component.includes('확인 중'));
console.log(`PASS: ${sizeRows.length} mall models; ${sizeRows.filter(r=>r.spec).length} linked specifications; ${removedSpec.length} catalog-only records excluded; missing-value states, units and range sorting verified.`);
