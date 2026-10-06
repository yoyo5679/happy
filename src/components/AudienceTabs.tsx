import Link from "next/link";

// 첫 화면과 기관용 화면을 오가는 전환 탭
export function AudienceTabs({ current }: { current: "family" | "agency" }) {
  return (
    <nav className="aud-tabs" aria-label="이용자 선택">
      <Link href="/" className={current === "family" ? "on" : ""} aria-current={current === "family" ? "page" : undefined}>
        👨‍👩‍👧 보호자용
      </Link>
      <Link href="/partner" className={current === "agency" ? "on" : ""} aria-current={current === "agency" ? "page" : undefined}>
        🏥 기관 선생님용
      </Link>
    </nav>
  );
}
