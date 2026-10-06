"use client";

import { site } from "@/config/site";
import { withUtm } from "@/lib/utm";

export function ContactCta({ campaign }: { campaign: string }) {
  return (
    <section className="card cta">
      <h3>어떤 제품이 맞을지 고민되시나요?</h3>
      <p className="muted">
        장기요양 등급이 있으면 복지용구를 본인부담금 15% 이하로 이용할 수 있어요. 등급 신청부터 제품 선택까지 무료로
        안내해 드려요.
      </p>
      <div className="cta-buttons">
        <a className="btn primary" href={withUtm(site.storeUrl, campaign, "store_home")} target="_blank" rel="noopener">
          🛒 {site.name} 쇼핑몰 바로가기
        </a>
        <a className="btn" href={`tel:${site.phone.replace(/-/g, "")}`}>
          📞 무료 상담 {site.phone}
        </a>
        {site.kakaoUrl && (
          <a className="btn kakao" href={site.kakaoUrl} target="_blank" rel="noopener">
            💬 카카오톡 상담
          </a>
        )}
      </div>
    </section>
  );
}
