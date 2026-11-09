"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { categories, copay, won, productUrl, type CategoryKey } from "@/data/products";
import { sizeRows as rows, sizeFields as fields, specValue, comparableValue } from "@/data/size-guide";
import { RatePicker } from "@/components/RatePicker";
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const cats = Object.keys(categories).filter(c => rows.some(r => r.category === c)) as CategoryKey[];
export function SizeList() {
  const [cat,setCat] = useState<CategoryKey>("walker");
  const [query,setQuery] = useState("");
  const [verified,setVerified] = useState(true);
  const [sort,setSort] = useState("default");
  const [rate,setRate] = useState(.15);
  const [selected,setSelected] = useState<string[]>([]);
  const [differencesOnly,setDifferencesOnly] = useState(false);
  const comparisonDialog = useRef<HTMLDialogElement>(null);
  const [message,setMessage] = useState("");
  useEffect(() => {
    const read = () => { const c = location.hash.slice(1); if(c === "category_1") setCat("walker"); else if(cats.includes(c as CategoryKey)) {setCat(c as CategoryKey);setVerified(rows.some(r => r.category === c && r.spec));} };
    read(); window.addEventListener("hashchange",read); return () => window.removeEventListener("hashchange",read);
  },[]);
  const list = rows.filter(r => (query ? normalize(r.name + " " + (r.product.code ?? "") + " " + r.id).includes(normalize(query)) : r.category === cat) && (!verified || r.spec)).sort((a,b) => sort === "weight" ? comparableValue(a,"weight") - comparableValue(b,"weight") : sort === "width" ? comparableValue(a,"width") - comparableValue(b,"width") : Number(!a.spec) - Number(!b.spec));
  const picks = rows.filter(r => selected.includes(r.id));
  function pick(c: CategoryKey) {setCat(c);setQuery("");setVerified(rows.some(r => r.category === c && r.spec));location.hash=c;}
  function toggle(id:string) { setMessage(""); if(selected.includes(id)) setSelected(selected.filter(x=>x!==id)); else if(selected.length<4) setSelected([...selected,id]); else setMessage("한 번에 4개까지 비교할 수 있어요. 선택한 제품을 하나 해제해 주세요."); }
  return <div className="sl-page">
    <div className="sl-breadcrumb"><Link href="/">홈</Link><span> / </span><Link href="/catalog">전체 모델</Link><span> / 제원표</span></div>
    <section className="sl-hero">
      <div><span className="sl-eyebrow">HAPPY CARE · SIZE GUIDE</span><h1>우리 집에 맞는 크기,<br/>한눈에 비교해 보세요.</h1><p>문을 지날 수 있는지, 앉기 편한 높이인지.<br/>구입 전에 치수부터 차근차근 확인하세요.</p><div className="sl-tags"><span>가가온 2026 · 2호</span><span>{rows.filter(r=>r.spec).length}개 몰 등록 모델 제원 확인</span></div></div>
      <figure><img src="/catalog-2026/size-guide.webp" alt="보행기의 가로, 세로, 높이를 확인하는 안내 그림"/><figcaption>AI로 제작한 치수 안내 이미지 · 실제 제품은 아래에서 확인하세요.</figcaption></figure>
    </section>
    <section className="sl-steps" aria-label="치수 확인 순서"><div><b>01</b><span><strong>통로의 폭</strong>현관문과 욕실 문 안쪽을 재세요.</span></div><div><b>02</b><span><strong>사용자의 자세</strong>좌면 높이와 최대하중을 확인하세요.</span></div><div><b>03</b><span><strong>제품의 제원</strong>가로·세로·높이와 여유 공간을 비교하세요.</span></div></section>
    <nav className="sl-categories" aria-label="제원표 품목">{cats.map(c=><button key={c} aria-pressed={cat===c&&!query} className={cat===c&&!query?"active":""} onClick={()=>pick(c)}>{categories[c].emoji} {categories[c].label}<small>{rows.filter(r=>r.category===c&&r.spec).length || "확인 중"}</small></button>)}</nav>
    <div className="sl-toolbar"><label className="sl-search"><span>모델 검색</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="전체 품목에서 모델명·급여코드 검색" type="search"/></label><label className="sl-sort">정렬<select value={sort} onChange={e=>setSort(e.target.value)}><option value="default">제원 확인 순</option><option value="weight">무게 가벼운 순</option><option value="width">가로 좁은 순</option></select></label></div>
    <div className="sl-heading"><div><h2>{query ? "전체 검색 결과" : categories[cat].label} <span>{list.length}</span></h2><p>확인 중: 아직 대조 전 · 원본 미기재: 해당 수치가 원본에 없음 · 해당 없음: 적용하지 않는 항목</p></div><label className="sl-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>제원 확인 모델만</label></div>
    <RatePicker rate={rate} onChange={setRate}/>
    <p className="sl-note">제원은 첨부 카탈로그 원본 기준이며 실제 치수에 차이가 있을 수 있습니다. 가격·재고는 기존 해피케어몰 등록 정보 기준입니다. 주문 전 상세페이지에서 확인하세요.</p>
    <div className="sl-compare-intro"><div><strong>제품을 나란히 비교해 보세요</strong><p>각 제품의 ‘비교 담기’를 누르면 사진·가격·크기를 한 화면에서 볼 수 있어요. (2~4개)</p></div><button disabled={selected.length<2} onClick={()=>comparisonDialog.current?.showModal()}>선택 제품 비교 ({selected.length}/4)</button></div>
    <p role="status" className="sl-status">{message}</p>
    {list.length ? <div className="sl-table-wrap"><table className="sl-table"><caption className="sl-sr-only">복지용구 모델별 제원 비교표</caption><thead><tr><th scope="col">비교</th><th scope="col">제품명 / 모델</th><th scope="col">가격 / 본인부담금</th>{fields.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{list.map(r=>{const listing = r.product?.buy ?? r.product?.rent; return <tr key={r.id}><td><button className={selected.includes(r.id)?"sl-pick selected":"sl-pick"} aria-pressed={selected.includes(r.id)} aria-label={`${r.name} ${selected.includes(r.id)?"비교 해제":"비교 담기"}`} onClick={()=>toggle(r.id)}>{selected.includes(r.id)?"✓ 선택됨":"＋ 비교 담기"}</button></td><th scope="row"><div className="sl-model">{r.product?.img&&<img src={r.product.img} alt="" loading="lazy"/>}<div>{r.product ? <a href={productUrl(r.product)} target="_blank" rel="noopener noreferrer">{r.name} ↗</a> : <strong>{r.name}</strong>}<small>{r.spec?.code ?? r.product?.code ?? "급여코드 미확인"}</small>{!r.spec&&<span className="sl-pending">제원 확인 중</span>}</div></div></th><td>{listing ? <><span>{r.product?.rent&&!r.product.buy ? "월 " : ""}{won(listing.price)}</span><strong className="sl-copay">{won(copay(listing.price,rate))}</strong><small>본인부담 {Math.round(rate*100)}%</small></> : "몰 가격 확인 필요"}</td>{fields.map(([key])=><td key={key}>{specValue(r,key)}</td>)}</tr>})}</tbody></table></div> : <div className="sl-empty"><h3>조건에 맞는 확인 제원이 없어요.</h3><p>모델명을 다시 검색하거나 전체 모델을 확인해 보세요.</p><button onClick={()=>{setVerified(false);setQuery("");}}>전체 모델 보기</button></div>}
    {selected.length>0&&<aside className="sl-compare-bar"><div className="sl-selected-list">{picks.map(r=><button key={r.id} onClick={()=>toggle(r.id)} aria-label={`${r.name} 비교 해제`}>{r.name} ×</button>)}</div><span><strong>{selected.length} / 4</strong>개 선택</span><button disabled={selected.length<2} onClick={()=>comparisonDialog.current?.showModal()}>선택 제품 비교</button><button onClick={()=>{setSelected([]);setMessage("");}}>선택 해제</button>{selected.length<2&&<small>제품을 1개 더 선택해 주세요.</small>}</aside>}
    <dialog ref={comparisonDialog} aria-labelledby="sl-comparison-title" className="sl-dialog sl-comparison-dialog" onClick={e=>{if(e.target===comparisonDialog.current)comparisonDialog.current?.close();}}>
      <div className="sl-dialog-toolbar"><strong id="sl-comparison-title">선택한 제품 비교 · {picks.length}개</strong><button onClick={()=>comparisonDialog.current?.close()}>닫기 ×</button></div>
      <section className="sl-comparison"><div className="sl-comparison-options"><label><input type="checkbox" checked={differencesOnly} onChange={e=>setDifferencesOnly(e.target.checked)}/> 다른 제원만 보기</label><button onClick={()=>window.print()}>비교표 인쇄</button></div><p className="sl-note">‘확인 중’은 아직 수치를 대조하지 않은 제품입니다. ‘원본 미기재’는 확인한 원본에 해당 수치가 없는 항목입니다.</p><div className="sl-table-wrap"><table className="sl-table sl-compare-table"><thead><tr><th scope="col">항목</th>{picks.map(r=><th scope="col" key={r.id}><div className="sl-comparison-product">{r.product.img&&<img src={r.product.img} alt={r.name}/>}<a href={productUrl(r.product)} target="_blank" rel="noopener noreferrer">{r.name} ↗</a><small>{categories[r.category].label}</small></div></th>)}</tr></thead><tbody>
        <tr><th scope="row">가격</th>{picks.map(r=>{const listing=r.product.buy??r.product.rent;return <td key={r.id}>{listing ? `${r.product.buy?"구입":"월 대여"} ${won(listing.price)}`:"몰 가격 확인 필요"}</td>})}</tr>
        <tr><th scope="row">본인부담 {Math.round(rate*100)}%</th>{picks.map(r=>{const listing=r.product.buy??r.product.rent;return <td key={r.id} className="sl-copay-cell">{listing ? won(copay(listing.price,rate)):"몰 가격 확인 필요"}</td>})}</tr>
        {fields.filter(([key])=>!differencesOnly||new Set(picks.map(r=>specValue(r,key))).size>1).map(([key,label])=>{const different=new Set(picks.map(r=>specValue(r,key))).size>1;return <tr key={key} className={different?"sl-different":""}><th scope="row">{label}</th>{picks.map(r=><td key={r.id}>{specValue(r,key)}</td>)}</tr>})}

      </tbody></table></div>{differencesOnly&&fields.every(([key])=>new Set(picks.map(r=>specValue(r,key))).size<=1)&&<p>확인된 제원 값에 차이가 없습니다. 전체 항목을 보려면 ‘다른 제원만 보기’를 해제하세요.</p>}</section>
    </dialog>
    <section className="sl-bottom"><h2>가격과 본인부담금도 함께 살펴보세요.</h2><p>제품별 구입·대여 조건은 전체 모델에서 확인할 수 있어요.</p><Link className="btn primary" href="/catalog">전체 모델 둘러보기 →</Link></section>

  </div>;
}
