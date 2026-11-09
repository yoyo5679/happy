"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import specs from "@/data/specifications.json";
import pageMap from "@/data/catalog-pages.json";
import { categories, products, copay, won, productUrl, type CategoryKey } from "@/data/products";
import { RatePicker } from "@/components/RatePicker";

type Spec = typeof specs[number];
type Row = { id: string; name: string; category: CategoryKey; spec?: Spec; product?: typeof products[number]; page?: number };
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const matched = new Set<string>();
const rows: Row[] = specs.map(s => {
  const p = products.find(p => p.code === s.code) ?? products.find(p => p.category === s.category && normalize(p.name) === normalize(s.name));
  if (p) matched.add(p.id);
  return {id: s.code, name: s.name, category: s.category as CategoryKey, spec: s, product: p, page: s.page};
});
rows.push(...products.filter(p => !matched.has(p.id)).map(p => ({id:p.id,name:p.name,category:p.category,product:p,page:p.code ? (pageMap as Record<string,number>)[p.code] : undefined})));
const cats = Object.keys(categories).filter(c => rows.some(r => r.category === c)) as CategoryKey[];
const source = (n:number) => `/catalog-2026/page-${String(n).padStart(2,"0")}.webp`;
const fields: [keyof Spec,string][] = [["width","가로 (cm)"],["depth","세로 (cm)"],["height","높이 (cm)"],["seat","좌면 가로 × 세로 / 높이 (cm)"],["weight","무게 (kg)"],["load","최대하중 (kg)"],["material","재질"]];
export function SizeList() {
  const [cat,setCat] = useState<CategoryKey>("walker");
  const [query,setQuery] = useState("");
  const [verified,setVerified] = useState(true);
  const [sort,setSort] = useState("default");
  const [rate,setRate] = useState(.15);
  const [selected,setSelected] = useState<string[]>([]);
  const [compare,setCompare] = useState(false);
  const [page,setPage] = useState(15);
  const [message,setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const read = () => { const c = location.hash.slice(1); if(c === "category_1") setCat("walker"); else if(c in categories) setCat(c as CategoryKey); };
    read(); window.addEventListener("hashchange",read); return () => window.removeEventListener("hashchange",read);
  },[]);
  const list = rows.filter(r => (query ? normalize(r.name + " " + r.id).includes(normalize(query)) : r.category === cat) && (!verified || r.spec)).sort((a,b) => sort === "weight" ? (a.spec?.weight ?? Infinity) - (b.spec?.weight ?? Infinity) : sort === "width" ? (Number(a.spec?.width) || Infinity) - (Number(b.spec?.width) || Infinity) : Number(!a.spec) - Number(!b.spec));
  const picks = rows.filter(r => selected.includes(r.id));
  function pick(c: CategoryKey) {setCat(c);setQuery("");setVerified(rows.some(r => r.category === c && r.spec));location.hash=c;}
  function toggle(id:string) { if(selected.includes(id)) setSelected(selected.filter(x=>x!==id)); else if(selected.length<4) setSelected([...selected,id]); else setMessage("한 번에 4개까지 비교할 수 있어요. 선택한 제품을 하나 해제해 주세요."); }
  function openSource(n:number) {setPage(n);dialog.current?.showModal();}
  return <div className="sl-page">
    <div className="sl-breadcrumb"><Link href="/">홈</Link><span> / </span><Link href="/catalog">전체 모델</Link><span> / 제원표</span></div>
    <section className="sl-hero">
      <div><span className="sl-eyebrow">HAPPY CARE · SIZE GUIDE</span><h1>우리 집에 맞는 크기,<br/>한눈에 비교해 보세요.</h1><p>문을 지날 수 있는지, 앉기 편한 높이인지.<br/>구입 전에 치수부터 차근차근 확인하세요.</p><div className="sl-tags"><span>가가온 2026 · 2호</span><span>{specs.length}개 모델 제원 확인</span></div><button className="sl-text-button" onClick={()=>openSource(1)}>카탈로그 70쪽 전체 보기 ↗</button></div>
      <figure><img src="/catalog-2026/size-guide.webp" alt="보행기의 가로, 세로, 높이를 확인하는 안내 그림"/><figcaption>AI로 제작한 치수 안내 이미지 · 실제 제품은 아래에서 확인하세요.</figcaption></figure>
    </section>
    <section className="sl-steps" aria-label="치수 확인 순서"><div><b>01</b><span><strong>통로의 폭</strong>현관문과 욕실 문 안쪽을 재세요.</span></div><div><b>02</b><span><strong>사용자의 자세</strong>좌면 높이와 최대하중을 확인하세요.</span></div><div><b>03</b><span><strong>제품의 제원</strong>가로·세로·높이와 여유 공간을 비교하세요.</span></div></section>
    <nav className="sl-categories" aria-label="제원표 품목">{cats.map(c=><button key={c} aria-pressed={cat===c&&!query} className={cat===c&&!query?"active":""} onClick={()=>pick(c)}>{categories[c].emoji} {categories[c].label}<small>{rows.filter(r=>r.category===c&&r.spec).length || "원본"}</small></button>)}</nav>
    <div className="sl-toolbar"><label className="sl-search"><span>모델 검색</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="전체 품목에서 모델명·급여코드 검색" type="search"/></label><label className="sl-sort">정렬<select value={sort} onChange={e=>setSort(e.target.value)}><option value="default">제원 확인 순</option><option value="weight">무게 가벼운 순</option><option value="width">가로 좁은 순</option></select></label></div>
    <div className="sl-heading"><div><h2>{query ? "전체 검색 결과" : categories[cat].label} <span>{list.length}</span></h2><p>치수 cm · 무게/최대하중 kg · — 는 미확인 또는 해당 없음</p></div><label className="sl-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>제원 확인 모델만</label></div>
    <RatePicker rate={rate} onChange={setRate}/>
    <p className="sl-note">제원은 첨부 카탈로그 원본 기준이며 실제 치수에 차이가 있을 수 있습니다. 가격·재고는 기존 해피케어몰 등록 정보 기준입니다. 주문 전 상세페이지에서 확인하세요.</p>
    <p role="status" className="sl-status">{message}</p>
    {list.length ? <div className="sl-table-wrap"><table className="sl-table"><caption className="sl-sr-only">복지용구 모델별 제원 비교표</caption><thead><tr><th scope="col">비교</th><th scope="col">제품명 / 모델</th><th scope="col">가격 / 본인부담금</th>{fields.map(([key,label])=><th scope="col" key={key}>{label}</th>)}<th scope="col">카탈로그</th></tr></thead><tbody>{list.map(r=>{const listing = r.product?.buy ?? r.product?.rent; return <tr key={r.id}><td><input aria-label={`${r.name} 비교 선택`} type="checkbox" checked={selected.includes(r.id)} onChange={()=>toggle(r.id)}/></td><th scope="row"><div className="sl-model">{r.product?.img&&<img src={r.product.img} alt="" loading="lazy"/>}<div>{r.product ? <a href={productUrl(r.product)} target="_blank" rel="noopener noreferrer">{r.name} ↗</a> : <strong>{r.name}</strong>}<small>{r.spec?.code ?? r.product?.code ?? "급여코드 미확인"}</small>{!r.spec&&<span className="sl-pending">제원 확인 중</span>}</div></div></th><td>{listing ? <><span>{r.product?.rent&&!r.product.buy ? "월 " : ""}{won(listing.price)}</span><strong className="sl-copay">{won(copay(listing.price,rate))}</strong><small>본인부담 {Math.round(rate*100)}%</small></> : "몰 가격 확인 필요"}</td>{fields.map(([key])=><td key={key}>{r.spec?.[key] || "—"}</td>)}<td>{r.page ? <button className="sl-source-button" onClick={()=>openSource(r.page!)}>{r.page}쪽 보기 ↗</button> : <button className="sl-source-button" onClick={()=>openSource(1)}>전체 원본 보기</button>}</td></tr>})}</tbody></table></div> : <div className="sl-empty"><h3>조건에 맞는 확인 제원이 없어요.</h3><p>모델명을 다시 검색하거나 전체 모델을 확인해 보세요.</p><button onClick={()=>{setVerified(false);setQuery("");}}>전체 모델 보기</button><button onClick={()=>openSource(1)}>카탈로그 원본 보기</button></div>}
    {selected.length>0&&<aside className="sl-compare-bar"><span><strong>{selected.length} / 4</strong>개 선택</span><button onClick={()=>setCompare(!compare)}>{compare ? "비교표 접기" : "선택 제품 비교"}</button><button onClick={()=>{setSelected([]);setCompare(false);setMessage("");}}>선택 해제</button></aside>}
    {compare&&picks.length>0&&<section className="sl-comparison"><h2>선택한 제품 비교</h2><button onClick={()=>window.print()}>비교표 인쇄</button><div className="sl-table-wrap"><table className="sl-table"><thead><tr><th scope="col">항목</th>{picks.map(r=><th scope="col" key={r.id}>{r.name}</th>)}</tr></thead><tbody>{fields.map(([key,label])=><tr key={key}><th scope="row">{label}</th>{picks.map(r=><td key={r.id}>{r.spec?.[key] || "—"}</td>)}</tr>)}</tbody></table></div></section>}
    <section className="sl-bottom"><h2>가격과 본인부담금도 함께 살펴보세요.</h2><p>제품별 구입·대여 조건은 전체 모델에서 확인할 수 있어요.</p><Link className="btn primary" href="/catalog">전체 모델 둘러보기 →</Link></section>
    <dialog ref={dialog} className="sl-dialog" onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}><div className="sl-dialog-toolbar"><strong>가가온 2026년 2호 · {page} / 70쪽</strong><button onClick={()=>dialog.current?.close()} aria-label="카탈로그 닫기">닫기 ×</button></div><div className="sl-page-controls"><button disabled={page===1} onClick={()=>setPage(page-1)}>← 이전</button><label>쪽 이동 <input type="number" min={1} max={70} value={page} onChange={e=>{const n=Number(e.target.value);if(n>=1&&n<=70)setPage(n);}}/></label><button disabled={page===70} onClick={()=>setPage(page+1)}>다음 →</button><a href={source(page)} target="_blank" rel="noopener noreferrer">크게 보기 ↗</a></div><img className="sl-source-page" src={source(page)} alt={`가가온 2026년 2호 카탈로그 원본 ${page}쪽`}/></dialog>
  </div>;
}
