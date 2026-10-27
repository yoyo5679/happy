"use client";

import { site } from "@/config/site";
import { withUtm } from "@/lib/utm";

/** 결과 화면 아래 상담 연결: 카드 전체를 누르면 전화·카카오톡으로 바로 연결 */
export function ContactCta({ campaign }: { campaign: string }) {
  return (
    <section className="contact-cta">
      <h3>
        내 <em>본인부담금</em>이 궁금하신가요?
      </h3>
      <p>장기요양등급 신청 및 확인, 해피케어가 쉽고 빠르게 도와드립니다.</p>
      <div className="contact-cards">
        <a className="contact-card tel" href={`tel:${site.phone.replace(/-/g, "")}`} aria-label={`고객센터 전화 ${site.phone}`}>
          <svg className="cc-ico" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"
            />
          </svg>
          <span className="cc-body">
            <span className="cc-label">고객센터</span>
            <strong>{site.phone}</strong>
            <span className="cc-desc">전문 상담사가 친절하게 안내해 드립니다.</span>
          </span>
        </a>
        {site.kakaoUrl && (
          <a className="contact-card kakao" href={site.kakaoUrl} target="_blank" rel="noopener" aria-label="카카오톡 상담 @해피케어복지용구">
            <span className="cc-ico talk" aria-hidden>
              TALK
            </span>
            <span className="cc-body">
              <span className="cc-label">카카오톡</span>
              <strong>@{site.name}</strong>
              <span className="cc-desc">누르시면 카카오톡으로 간편하게 상담할 수 있어요.</span>
            </span>
          </a>
        )}
      </div>
      <a className="cc-store" href={withUtm(site.storeUrl, campaign, "store_home")} target="_blank" rel="noopener">
        🛒 {site.name} 쇼핑몰 바로가기 →
      </a>
    </section>
  );
}
