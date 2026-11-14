"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {facilityLabels,restoreFacility,type FacilityDetail} from "@/lib/facility";
const gradeNames:Record<string,string>={A:"최우수",B:"우수",C:"양호",D:"보통",E:"미흡"};
export function FacilityPage(){
 const [facility,setFacility]=useState<FacilityDetail|null>(null),[loading,setLoading]=useState(true),[err,setErr]=useState(""),[phoneError,setPhoneError]=useState(""),[calling,setCalling]=useState(false);
 useEffect(()=>{const code=new URLSearchParams(location.search).get("c")??"";if(!/^\d{8,15}$/.test(code)){setErr("기관 주소를 다시 확인해 주세요.");setLoading(false);return;}
  const saved=restoreFacility(code);if(saved){setFacility(saved);setLoading(false);}const controller=new AbortController();
  fetch(`/api/ltc/detail?c=${encodeURIComponent(code)}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();const j=await r.json();setFacility(j.facility);}).catch(()=>{if(!controller.signal.aborted&&!saved)setErr("기관 정보를 불러오지 못했어요. 목록에서 기관을 다시 선택해 주세요.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[]);
 async function phone(){if(!facility)return;setCalling(true);setPhoneError("");try{let number=facility.phone;if(!number){const r=await fetch(`/api/ltc/phone?c=${facility.code}`);if(!r.ok)throw new Error();number=(await r.json()).phone;}if(!number){setPhoneError("등록된 전화번호를 확인하지 못했어요. 지도에서 기관 정보를 확인해 주세요.");return;}setFacility({...facility,phone:number});location.href=`tel:${number.replace(/[^\d+]/g,"")}`;}catch{setPhoneError("전화번호를 불러오지 못했어요. 지도에서 확인해 주세요.");}finally{setCalling(false);}}
 const map=facility?`https://map.kakao.com/?q=${encodeURIComponent(`${facility.name} ${facility.addr}`)}`:"";
 return <><Link href="/care" className="btn">← 기관 찾기로</Link>{loading&&<p role="status">기관 정보를 불러오는 중이에요…</p>}{err&&<p className="card form-err" role="alert">{err}</p>}{facility&&<>
 <section className="card facility-detail"><p className="eyebrow">장기요양기관 상세정보</p><h1>{facility.name}</h1><div className="care-kinds">{facility.kinds.map(k=><span className="care-kind" key={k}>{facilityLabels[k]}</span>)}</div><dl><dt>주소</dt><dd>{facility.addr||"공개된 정보가 없어요"}</dd><dt>지정일</dt><dd>{facility.desig||"공개된 정보가 없어요"}</dd><dt>정원</dt><dd>{facility.cap>0?`${facility.cap}명`:"공개된 정보가 없어요"}</dd><dt>기관기호</dt><dd>{facility.code}</dd><dt>전화번호</dt><dd>{facility.phone||"아래 전화 버튼에서 확인할 수 있어요"}</dd></dl><div className="care-actions"><button className="btn primary" onClick={phone} disabled={calling}>{calling?"확인 중…":"📞 전화하기"}</button><a href={map} className="btn" target="_blank" rel="noopener noreferrer">🗺️ 지도·길찾기</a></div>{phoneError&&<p role="status" className="small muted">{phoneError}</p>}</section>
 <section className="card"><h2>공단 평가결과</h2><ul className="facility-evaluations">{facility.kinds.map(k=>{const g=facility.grades[k];return <li key={k}><strong>{facilityLabels[k]}</strong>{g?<span><b className={`grade g${g[0]}`}>{g[0]} {gradeNames[g[0]]??""}</b> · {g[1]}년 평가</span>:<span className="muted">공개된 평가결과 없음</span>}</li>})}</ul></section><p className="small muted">공단 공개자료 기준: 기관현황 2026.6.10 · 평가결과 2026.6.25. 현재 정원 여유·운영시간·이용 가능 여부는 기관에 직접 확인해 주세요.</p>
 </>}</>;
}
