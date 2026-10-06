import Link from "next/link";
import { tools } from "@/config/tools";

export function OtherTools({ current }: { current: string }) {
  return (
    <>
      {tools
        .filter((t) => t.href !== current)
        .map((t) => (
          <Link key={t.href} className="btn" href={t.href}>
            {t.emoji} {t.short}
          </Link>
        ))}
    </>
  );
}
