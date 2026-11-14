"use client";
import {useEffect,useState} from "react";
type Update={to:string;added:number;updated:number;unresolved:number;completedAt:string|null};
export function CareUpdateStatus(){
 const [update,setUpdate]=useState<Update|null>(null);
 useEffect(()=>{const c=new AbortController();fetch("/api/ltc/update-status",{signal:c.signal}).then(async r=>{if(r.ok){const data=await r.json();if(!c.signal.aborted)setUpdate(data.lastCompleted??null);}}).catch(()=>{});return()=>c.abort();},[]);
 if(!update?.completedAt)return null;
 return <p className="small muted">신규 지정기관 {update.to}까지 추가 조회 · 반영 {update.completedAt.slice(0,10)}{update.unresolved>0&&<> · 지도 확인 대기 {update.unresolved}곳</>}</p>;
}
