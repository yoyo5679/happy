"use client";

import { useEffect, useState } from "react";
import { CategoryGroup } from "@/components/CategoryGroup";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { ProductPicks } from "@/components/ProductPicks";
import { ShareResult } from "@/components/ShareResult";
import { SharedBanner } from "@/components/SharedBanner";
import { OtherTools } from "@/components/OtherTools";
import { categorySummary } from "@/data/products";
import { checkAreas, checkItems, evaluateCheck, type CheckResult } from "@/lib/check";
import type { Answers } from "@/lib/quiz";
import { clearSharedParams, readSharedResult } from "@/lib/share";

const LEVEL_TEXT = {
  높음: "낙상 위험이 높아요. 아래 1~2순위 용품은 바로 준비하시길 권해요.",
  주의: "위험 요인이 있어요. 해당 구간부터 하나씩 정비해 주세요.",
  낮음: "비교적 안전한 환경이에요. 미리 대비해 두면 더 좋아요.",
};

export function CheckTool() {
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [rate, setRate] = useState(0.15);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const s = readSharedResult(checkItems);
    if (s) {
      setAnswers(s.answers);
      if (s.rate !== null) setRate(s.rate);
      setResult(evaluateCheck(s.answers));
      setShared(true);
    }
    // 결과 화면에서 휴대폰 뒤로가기 → 점검표로
    const onPop = () => setResult(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function toggle(id: string) {
    setAnswers((a) => ({ ...a, [id]: a[id] === 1 ? 0 : 1 }));
  }

  function showResult() {
    window.history.pushState({ ...window.history.state, hcCheck: "result" }, "");
    setResult(evaluateCheck(answers));
    window.scrollTo(0, 0);
  }

  function retry() {
    if (shared) {
      clearSharedParams();
      setShared(false);
      setResult(null);
    } else {
      window.history.back();
    }
    window.scrollTo(0, 0);
  }

  const checked = checkItems.filter((i) => answers[i.id] === 1).length;

  if (!result) {
    return (
      <>
        <div className="page-title">
          <h1>🔍 가정 낙상 위험 점검표</h1>
          <p className="muted">집을 둘러보며 해당하는 항목을 눌러 주세요. 첫 방문 때 함께 점검하기 좋아요.</p>
        </div>
        {checkAreas.map((area) => (
          <section key={area} className="card check-area">
            <h3>{area}</h3>
            {checkItems
              .filter((i) => i.area === area)
              .map((i) => (
                <button
                  key={i.id}
                  role="checkbox"
                  aria-checked={answers[i.id] === 1}
                  className={answers[i.id] === 1 ? "check-item on" : "check-item"}
                  onClick={() => toggle(i.id)}
                >
                  <span className="box" aria-hidden>
                    {answers[i.id] === 1 ? "✓" : ""}
                  </span>
                  {i.title}
                </button>
              ))}
          </section>
        ))}
        <div className="check-submit">
          <button className="btn primary" onClick={showResult}>
            점검 결과 보기 ({checked}개 해당)
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {shared && <SharedBanner onRetry={retry} />}
      <section className={`card result risk-${result.level}`}>
        <p className="eyebrow">점검 결과</p>
        <p className="grade">낙상 위험 {result.level}</p>
        <h1>
          {checkItems.length}개 항목 중 {result.count}개 해당
        </h1>
        <p className="muted">{LEVEL_TEXT[result.level]}</p>
      </section>

      {result.recs.length > 0 && (
        <>
          <RatePicker rate={rate} onChange={setRate} />
          {result.recs.map((r, i) => (
            <CategoryGroup key={r.category} category={r.category} campaign="fall_check" rate={rate} rank={i + 1} reason={r.reason} />
          ))}
        </>
      )}

      <ProductPicks campaign="fall_check" exclude={result.recs.map((r) => r.category)} />
      <ContactCta campaign="fall_check" />

      <div className="actions">
        <ShareResult
          path="/check"
          heading={`가정 낙상 위험 점검 결과: 위험 ${result.level} (${result.count}개 해당)`}
          lines={result.recs.map((r, i) => `${i + 1}. ${categorySummary(r.category, rate)}`)}
          questions={checkItems}
          answers={answers}
          rate={rate}
        />
        <OtherTools current="/check" />
        <button className="link" onClick={retry}>
          점검표로 돌아가기
        </button>
      </div>
    </>
  );
}
