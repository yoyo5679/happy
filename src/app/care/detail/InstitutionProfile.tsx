"use client";
import {useEffect,useId,useState,type KeyboardEvent} from "react";
import {facilityLabels,type FacilityDetail} from "@/lib/facility";

type Source={status:"ok"|"empty"|"unavailable";fetchedAt?:string};
type Staff={key:string;label:string;count:number|null};
type Profile={general:Source&{installed?:string|null;designated?:string|null;phone?:string};workforce:Source&{staff?:Staff[]}};
const problem="공단 정보를 불러오지 못했어요. 잠시 후 다시 시도하거나 기관에 전화해 주세요.";
const tabs=[{key:"staff",label:"인력"},{key:"grades",label:"평가"},{key:"info",label:"기본정보"}] as const;
type Tab=typeof tabs[number]["key"];
const gradeNames:Record<string,string>={A:"최우수",B:"우수",C:"양호",D:"보통",E:"미흡"};

export function StaffOverview({staff}:{staff:Staff[]}) {
 const count=(key:string)=>staff.find(x=>x.key===key)?.count??null;
 const first=count("recuProt_1"),second=count("recuProt_2");
 const main=[{label:"요양보호사",count:first!==null&&second!==null?first+second:null},{label:"사회복지사",count:count("socWel")},{label:"간호사",count:count("nur")},{label:"간호조무사",count:count("nurArticle")}];
 return <><dl className="facility-staff-stats">{main.map(x=><div key={x.label}><dt>{x.label}</dt><dd>{x.count===null?<span>등록값 없음</span>:<><strong>{x.count}</strong>명</>}</dd></div>)}</dl>
 <details className="facility-more"><summary>전체 인력 자세히 보기</summary><dl className="facility-staff-all">{staff.map(x=><div key={x.key}><dt>{x.label}</dt><dd>{x.count===null?"등록값 없음":`${x.count}명`}</dd></div>)}</dl></details></>;
}

export function InstitutionProfile({facility}:{facility:FacilityDetail}){
 const code=facility.code,id=useId();
 const [tab,setTab]=useState<Tab>("staff"),[data,setData]=useState<Profile|null>(null),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{const abort=new AbortController();setData(null);setLoading(true);fetch(`/api/ltc/profile?c=${encodeURIComponent(code)}`,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();const next=await r.json();if(!abort.signal.aborted)setData(next);}).catch(()=>{if(!abort.signal.aborted)setData({general:{status:"unavailable"},workforce:{status:"unavailable"}});}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[code,attempt]);
 const unknown=(status:Source["status"])=>status==="unavailable"?problem:"공단 응답에 등록된 값이 없어요.";
 function keydown(e:KeyboardEvent<HTMLButtonElement>,index:number){let next=index;if(e.key==="ArrowRight")next=(index+1)%tabs.length;else if(e.key==="ArrowLeft")next=(index+tabs.length-1)%tabs.length;else if(e.key==="Home")next=0;else if(e.key==="End")next=tabs.length-1;else return;e.preventDefault();setTab(tabs[next].key);document.getElementById(`${id}-${tabs[next].key}`)?.focus();}
 const retry=<button className="btn small" onClick={()=>setAttempt(x=>x+1)}>다시 불러오기</button>;
 return <section className="card facility-tabs-card">
 <div className="facility-tabs" role="tablist" aria-label="기관 상세정보">{tabs.map((t,i)=><button key={t.key} type="button" id={`${id}-${t.key}`} role="tab" aria-selected={tab===t.key} aria-controls={`${id}-panel-${t.key}`} tabIndex={tab===t.key?0:-1} onKeyDown={e=>keydown(e,i)} onClick={()=>setTab(t.key)}>{t.label}</button>)}</div>
 <div className="facility-tabs-panel" id={`${id}-panel-staff`} role="tabpanel" aria-labelledby={`${id}-staff`} hidden={tab!=="staff"} tabIndex={0}>
 <h2>돌봄 인력 한눈에</h2>{loading?<p role="status" className="muted">인력 현황을 불러오는 중이에요…</p>:data&&<>{data.workforce.status==="ok"&&data.workforce.staff?.some(x=>x.count!==null)?<><StaffOverview staff={data.workforce.staff}/><p className="small muted facility-panel-note">공단 등록 인원으로, 현재 근무·배정 가능한 인원과 다를 수 있어요. 조회 {data.workforce.fetchedAt?.slice(0,10)}</p></>:<><p className="muted" role="status">{unknown(data.workforce.status)}</p>{data.workforce.status==="unavailable"&&retry}</>}</>}
 </div>
 <div className="facility-tabs-panel" id={`${id}-panel-grades`} role="tabpanel" aria-labelledby={`${id}-grades`} hidden={tab!=="grades"} tabIndex={0}>
 <h2>공단 평가결과</h2><ul className="facility-evaluations">{facility.kinds.map(k=>{const g=facility.grades[k];return <li key={k}><strong>{facilityLabels[k]}</strong>{g?<span><b className={`grade g${g[0]}`}>{g[0]} {gradeNames[g[0]]??""}</b> · {g[1]}년</span>:<span className="muted">공개된 평가결과 없음</span>}</li>})}</ul>
 <p className="small muted facility-panel-note">평가자료 기준 2026.6.25. 평가 시점 이후 기관 현황은 달라질 수 있어요.</p>
 </div>
 <div className="facility-tabs-panel facility-compact-info" id={`${id}-panel-info`} role="tabpanel" aria-labelledby={`${id}-info`} hidden={tab!=="info"} tabIndex={0}>
 <h2>기관 기본정보</h2><dl><dt>설치신고일</dt><dd>{loading?"불러오는 중…":data?.general.installed||unknown(data?.general.status??"unavailable")}</dd><dt>지정일</dt><dd>{data?.general.designated||facility.desig||"등록된 값 없음"}</dd><dt>정원</dt><dd>{facility.cap>0?`${facility.cap}명`:"등록된 값 없음"}</dd><dt>기관기호</dt><dd>{facility.code}</dd><dt>전화번호</dt><dd>{data?.general.phone||facility.phone?<a href={`tel:${(data?.general.phone||facility.phone||"").replace(/[^\d+]/g,"")}`}>{data?.general.phone||facility.phone}</a>:"위 전화 버튼에서 확인할 수 있어요"}</dd></dl>
 <p className="small muted facility-panel-note">설치신고일과 장기요양기관 지정일은 다를 수 있으며 법인 설립일을 뜻하지는 않습니다.</p>{!loading&&data?.general.status==="unavailable"&&retry}
 </div></section>;
}
