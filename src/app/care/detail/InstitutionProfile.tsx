"use client";
import {useEffect,useState} from "react";
type Source={status:"ok"|"empty"|"unavailable";fetchedAt?:string};
type Profile={general:Source&{installed?:string|null;designated?:string|null;phone?:string};workforce:Source&{staff?:{key:string;label:string;count:number|null}[]}};
const problem="공단 정보 연결 문제로 불러오지 못했어요. 기관에 전화로 확인해 주세요.";
export function InstitutionProfile({code}:{code:string}){
 const [data,setData]=useState<Profile|null>(null),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{const abort=new AbortController();setLoading(true);fetch(`/api/ltc/profile?c=${encodeURIComponent(code)}`,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();setData(await r.json());}).catch(()=>{if(!abort.signal.aborted)setData({general:{status:"unavailable"},workforce:{status:"unavailable"}});}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[code,attempt]);
 const unknown=(status:Source["status"])=>status==="unavailable"?problem:"공단 응답에 등록된 값이 없어요.";
 return <><section className="card facility-detail"><h2>기관은 언제 문을 열었나요?</h2>{loading?<p role="status">개설 정보를 불러오는 중이에요…</p>:data&&<><dl><dt>설치신고일</dt><dd>{data.general.installed||unknown(data.general.status)}</dd>{data.general.designated&&<><dt>장기요양기관 지정일</dt><dd>{data.general.designated}</dd></>}{data.general.phone&&<><dt>기관 전화번호</dt><dd><a href={`tel:${data.general.phone.replace(/[^\d+]/g,"")}`}>{data.general.phone}</a></dd></>}</dl><p className="small muted">설치신고일은 시설을 설치해 신고한 날짜이며, 장기요양기관 지정일과 다를 수 있어요. 법인 설립일을 뜻하지는 않습니다.</p></>}</section>
 <section className="card"><h2>어떤 분들이 돌봐주시나요?</h2>{loading?<p role="status">인력 현황을 불러오는 중이에요…</p>:data&&<>{data.workforce.status==="ok"&&data.workforce.staff?.some(x=>x.count!==null)?<><ul className="facility-evaluations">{data.workforce.staff.map(x=><li key={x.key}><strong>{x.label}</strong><span>{x.count===null?"등록된 값 없음":`${x.count}명`}</span></li>)}</ul><p className="small muted">공단에 등록된 기관유형 기준 인력입니다. 지금 근무 중이거나 방문 가능한 인원과는 다를 수 있어요. 조회일: {data.workforce.fetchedAt?.slice(0,10)}</p></>:<p className="muted" role="status">{unknown(data.workforce.status)}</p>}{(data.general.status==="unavailable"||data.workforce.status==="unavailable")&&<button className="btn small" onClick={()=>setAttempt(x=>x+1)}>다시 불러오기</button>}</>}</section></>;
}
