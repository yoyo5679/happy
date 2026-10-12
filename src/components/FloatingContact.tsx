import { site } from "@/config/site";

// 모든 페이지 오른쪽 아래: 전화 · 카톡 상담 (결과 화면에서는 하단 고정 바가 대신함)
export function FloatingContact() {
  return (
    <div className="float-contact">
      <a className="fc-btn fc-tel" href={`tel:${site.phone.replace(/-/g, "")}`} aria-label={`전화 상담 ${site.phone}`}>
        <span aria-hidden>📞</span>
        <small>전화</small>
      </a>
      {site.kakaoUrl && (
        <a className="fc-btn fc-kakao" href={site.kakaoUrl} target="_blank" rel="noopener" aria-label="카카오톡 상담">
          <span aria-hidden>💬</span>
          <small>카톡</small>
        </a>
      )}
    </div>
  );
}
