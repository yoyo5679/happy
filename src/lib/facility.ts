export type FacilityKind = "visit" | "bath" | "day" | "short" | "home";
export type FacilityDetail = {code:string;name:string;addr:string;desig:string;cap:number;kinds:FacilityKind[];grades:Partial<Record<FacilityKind,[string,number]>>;lat:number;lng:number;approx?:boolean;phone?:string};
export const facilityLabels:Record<FacilityKind,string>={visit:"방문요양",bath:"방문목욕",day:"주야간보호",short:"단기보호",home:"요양원"};
export function rememberFacility(value:FacilityDetail) {
 // Only public institution fields; never save the visitor's GPS location or distance.
 const {code,name,addr,desig,cap,kinds,grades,lat,lng,approx}=value;
 try { sessionStorage.setItem(`hc_facility_${code}`,JSON.stringify({at:Date.now(),value:{code,name,addr,desig,cap,kinds,grades,lat,lng,approx}})); } catch {}
}
export function restoreFacility(code:string):FacilityDetail|null {
 try {const saved=JSON.parse(sessionStorage.getItem(`hc_facility_${code}`)??"null");
 if(saved?.value?.code===code&&Date.now()-saved.at<3600_000&&typeof saved.value.name==="string"&&typeof saved.value.addr==="string"&&Array.isArray(saved.value.kinds)&&saved.value.grades&&typeof saved.value.grades==="object")return saved.value;
 }catch{}return null;
}
