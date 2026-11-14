import Link from "next/link";
import {site} from "@/config/site";

export function HappycareInfo({headingLevel=2}:{headingLevel?:1|2}) {
 const Heading=headingLevel===1?"h1":"h2";
 return <section className="card happy-care-banner"><p className="eyebrow">해피케어가 직접 운영해요</p><Heading>{site.name}</Heading><h2>전국 어디서나, 부모님 곁으로!</h2><p>멀리 계셔도 괜찮아요.<br/>필요한 복지용구는 <strong>쇼핑몰에서 편하게 주문</strong>하세요.</p><a href={site.storeUrl} className="btn primary wide" target="_blank" rel="noopener noreferrer">해피케어몰 구경하기</a><Link href="/catalog" className="btn wide">복지용구 상품·본인부담금 보기</Link><div className="care-actions"><a href={`tel:${site.phone.replace(/-/g,"")}`} className="btn">📞 {site.phone}</a><a href={site.kakaoUrl} className="btn" target="_blank" rel="noopener noreferrer">💬 카카오톡 상담</a></div><p className="small muted">전국 온라인 주문이 가능합니다. 배송비·배송 일정·설치 가능 여부는 상품별 안내를 확인해 주세요.</p></section>;
}
