import type {FacilityDetail,FacilityKind} from "./facility";
export type CarePosition={lat:number;lng:number;name:string};
export type CareSort="near"|"grade"|"new";
export type CareItem=FacilityDetail&{shown:FacilityKind[];km:number};
export type CareSearchState={equipment:boolean;pos:CarePosition|null;kinds:FacilityKind[];sort:CareSort;radius:number;q:string;result:{key:string;items:CareItem[];total:number;at:number}|null};
const KEY="hc_care_search_v1",SESSION_MS=3600_000;
let memory:{at:number;value:CareSearchState}|null=null;
export const emptyCareSearch=():CareSearchState=>({equipment:false,pos:null,kinds:[],sort:"near",radius:5,q:"",result:null});
export function careSearchKey(s:Pick<CareSearchState,"pos"|"kinds"|"radius"|"sort">):string {
 return JSON.stringify([s.pos?.lat,s.pos?.lng,s.radius,s.sort,[...s.kinds].sort()]);
}
export function freshCareResult(s:CareSearchState):boolean {
 return !!s.result&&s.result.key===careSearchKey(s)&&Date.now()-s.result.at<300_000;
}
const isNumber=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const isKinds=(v:unknown):v is FacilityKind[]=>Array.isArray(v)&&v.every(k=>["visit","bath","day","short","home"].includes(k));
function isItem(v:CareItem):boolean {
 return !!v&&typeof v.code==="string"&&typeof v.name==="string"&&typeof v.addr==="string"&&typeof v.desig==="string"&&isNumber(v.cap)&&isNumber(v.lat)&&isNumber(v.lng)&&isNumber(v.km)&&isKinds(v.kinds)&&isKinds(v.shown)&&!!v.grades&&typeof v.grades==="object"&&Object.values(v.grades).every(g=>Array.isArray(g)&&typeof g[0]==="string"&&isNumber(g[1]));
}
export function restoreCareSearch():CareSearchState|null {
 try {
  let saved=memory;
  try {const raw=sessionStorage.getItem(KEY);if(raw)saved=JSON.parse(raw);}catch{}
  if(!saved||!isNumber(saved.at)||Date.now()-saved.at>=SESSION_MS||saved.at>Date.now()){
   memory=null;try{sessionStorage.removeItem(KEY);}catch{}return null;
  }
  const s=saved.value;
  if(!s||typeof s.equipment!=="boolean"||typeof s.q!=="string"||s.q.length>500||!isKinds(s.kinds)||!["near","grade","new"].includes(s.sort)||![2,5,10,20].includes(s.radius))return null;
  if(s.pos!==null&&(!s.pos||!isNumber(s.pos.lat)||Math.abs(s.pos.lat)>90||!isNumber(s.pos.lng)||Math.abs(s.pos.lng)>180||typeof s.pos.name!=="string"))return null;
  const r=s.result;
  if(r&&(!isNumber(r.at)||Date.now()-r.at>=SESSION_MS||r.at>Date.now()||typeof r.key!=="string"||!Array.isArray(r.items)||r.items.length>80||!r.items.every(isItem)||!Number.isInteger(r.total)||r.total<r.items.length))return {...s,result:null};
  return s;
 }catch{return null;}
}
export function rememberCareSearch(value:CareSearchState):void {
 // This tab only: never put the visitor's location in a public URL or server storage.
 memory={at:Date.now(),value};
 try{sessionStorage.setItem(KEY,JSON.stringify(memory));}catch{}
}
