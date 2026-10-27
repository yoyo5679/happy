"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Kind = "prompt" | "ios" | "inapp" | null;

/** 홈 화면에 바로가기 추가: 안드로이드 크롬은 설치 창, 아이폰·카톡 브라우저는 방법 안내 */
export function InstallApp({ label = "홈 화면에 바로가기 추가" }: { label?: string }) {
  const [kind, setKind] = useState<Kind>(null);
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    const ua = navigator.userAgent;
    if (/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua)) setKind("inapp");
    else if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) setKind("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
      setKind("prompt");
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (done) return <p className="install-app done">✅ 홈 화면에 추가했어요. 다음부터는 아이콘을 눌러 바로 여세요.</p>;
  if (!kind) return null;

  async function click() {
    if (kind === "prompt" && evt) {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") setDone(true);
      setEvt(null);
      return;
    }
    setOpen((o) => !o);
  }

  return (
    <div className="install-app">
      <button className="btn wide" onClick={click} aria-expanded={kind !== "prompt" ? open : undefined}>
        📲 {label}
      </button>
      {open && kind === "ios" && (
        <ol className="install-steps">
          <li>
            화면 아래(아이패드는 위)의 <b>공유 버튼</b> <span aria-hidden>⬆️</span>을 눌러요
          </li>
          <li>
            목록을 올려 <b>&lsquo;홈 화면에 추가&rsquo;</b>를 눌러요
          </li>
          <li>
            오른쪽 위 <b>&lsquo;추가&rsquo;</b>를 누르면 끝!
          </li>
        </ol>
      )}
      {open && kind === "inapp" && (
        <ol className="install-steps">
          <li>
            오른쪽 위(또는 아래) <b>⋮ 또는 ⋯ 메뉴</b>를 눌러요
          </li>
          <li>
            <b>&lsquo;다른 브라우저로 열기&rsquo;</b>(크롬·사파리)를 눌러요
          </li>
          <li>열린 화면에서 이 버튼을 다시 눌러 주세요</li>
        </ol>
      )}
    </div>
  );
}
