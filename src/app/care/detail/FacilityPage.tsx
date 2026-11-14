"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {InstitutionProfile} from "./InstitutionProfile";
import {facilityLabels,restoreFacility,type FacilityDetail} from "@/lib/facility";
export function FacilityPage(){
 const [facility,setFacility]=useState<FacilityDetail|null>(null),[loading,setLoading]=useState(true),[err,setErr]=useState(""),[phoneError,setPhoneError]=useState(""),[calling,setCalling]=useState(false);
 useEffect(()=>{const code=new URLSearchParams(location.search).get("c")??"";if(!/^\d{8,15}$/.test(code)){setErr("기관 주소를 다시 확인해 주세요.");setLoading(false);return;}
  const saved=restoreFacility(code);if(saved){setFacility(saved);setLoading(false);}const controller=new AbortController();
  fetch(`/api/ltc/detail?c=${encodeURIComponent(code)}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();const j=await r.json();setFacility(j.facility);}).catch(()=>{if(!controller.signal.aborted&&!saved)setErr("기관 정보를 불러오지 못했어요. 목록에서 기관을 다시 선택해 주세요.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[]);
 async function phone(){if(!facility)return;setCalling(true);setPhoneError("");try{let number=facility.phone;if(!number){const r=await fetch(`/api/ltc/phone?c=${facility.code}`);if(!r.ok)throw new Error();number=(await r.json()).phone;}if(!number){setPhoneError("등록된 전화번호를 확인하지 못했어요. 지도에서 기관 정보를 확인해 주세요.");return;}setFacility({...facility,phone:number});location.href=`tel:${number.replace(/[^\d+]/g,"")}`;}catch{setPhoneError("전화번호를 불러오지 못했어요. 지도에서 확인해 주세요.");}finally{setCalling(false);}}
 const map=facility?`https://map.kakao.com/?q=${encodeURIComponent(`${facility.name} ${facility.addr}`)}`:"";
 return <article className="facility-page">
 <Link href="/care" className="facility-back">← 기관 찾기로</Link>
 {loading&&<p role="status">기관 정보를 불러오는 중이에요…</p>}
 {err&&<p className="card form-err" role="alert">{err}</p>}
 {facility&&<>
 <header className="card facility-summary">
 <h1>{facility.name}</h1>
 <div className="care-kinds">{facility.kinds.map(k=><span className="care-kind" key={k}>{facilityLabels[k]}{facility.grades[k]&&<b className={`grade g${facility.grades[k]![0]}`}>{facility.grades[k]![0]}</b>}</span>)}</div>
 <p className="care-addr">📍 {facility.addr||"공개된 주소가 없어요"}</p>
 {facility.cap>0&&<p className="small muted facility-capacity">정원 {facility.cap}명</p>}
 </header>
 <div className="facility-contact" aria-label="기관에 연락하기">
 <button className="btn primary" onClick={phone} disabled={calling}>{calling?"확인 중…":"📞 기관 전화"}</button>
 <a href={map} className="btn" target="_blank" rel="noopener noreferrer">🗺️ 지도·길찾기</a>
 </div>
 {phoneError&&<p role="status" className="small form-err">{phoneError}</p>}
 <InstitutionProfile facility={facility}/>
 <p className="small muted facility-source">공단 공개자료 기준. 운영 현황과 이용 가능 여부는 기관에 직접 확인해 주세요.</p>
 </>}
 </article>;
}
