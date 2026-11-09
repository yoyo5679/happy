import Link from "next/link";

// 첫 화면 세 갈래: 보호자용 · 기관용 · 요양기관 찾기
const TABS = [
  { key: "family", href: "/", label: "보호자용", emoji: "👨‍👩‍👧" },
  { key: "agency", href: "/partner", label: "기관용", emoji: "🏢" },
  { key: "find", href: "/care", label: "기관 찾기", emoji: "📍" },
] as const;

export function AudienceTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="aud-tabs" aria-label="화면 선택">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={current === t.key ? "on" : ""} aria-current={current === t.key ? "page" : undefined}>
          <span aria-hidden>{t.emoji}</span> {t.label}
        </Link>
      ))}
    </nav>
  );
}
