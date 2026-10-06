import { site } from "@/config/site";

export function FloatingKakao() {
  if (!site.kakaoUrl) return null;
  return (
    <a className="float-kakao" href={site.kakaoUrl} target="_blank" rel="noopener" aria-label="카카오톡 상담">
      <span aria-hidden>💬</span> 상담
    </a>
  );
}
