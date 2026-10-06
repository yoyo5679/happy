"use client";

import { useState } from "react";
import { Quiz } from "@/components/Quiz";
import { CategoryGroup } from "@/components/CategoryGroup";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { ShareButton } from "@/components/ShareButton";
import { OtherTools } from "@/components/OtherTools";
import { ProductPicks } from "@/components/ProductPicks";
import { calcGrade, gradeQuestions, type GradeResult } from "@/lib/grade";

export function GradeTool() {
  const [result, setResult] = useState<GradeResult | null>(null);
  const [rate, setRate] = useState(0.15);

  const quiz = (
    <div hidden={!!result}>
      <div className="page-title">
        <h1>📋 장기요양등급 모의 계산</h1>
        <p className="muted">부모님의 평소 모습을 떠올리며 골라 주세요.</p>
      </div>
      <Quiz questions={gradeQuestions} onComplete={(a) => setResult(calcGrade(a))} onReturn={() => setResult(null)} />
    </div>
  );

  if (!result) return <>{quiz}</>;

  const eligible = result.grade !== "신청 대상 아님" && result.grade !== "등급외 가능성";

  return (
    <>
      {quiz}
      <section className="card result">
        <p className="eyebrow">예상 결과</p>
        <p className="grade">{result.grade}</p>
        <h1>{result.headline}</h1>
        <p>{result.detail}</p>
        {result.grade !== "신청 대상 아님" && (
          <div className="meter" aria-label={`모의 점수 ${result.score}점`}>
            <div style={{ width: `${result.score}%` }} />
            <span>모의 점수 {result.score}점</span>
          </div>
        )}
      </section>

      {eligible && (
        <section className="card">
          <h3>✅ 다음 단계: 등급 신청하기</h3>
          <ol className="steps">
            <li>국민건강보험공단(☎ 1577-1000) 또는 가까운 지사, 홈페이지에서 장기요양인정 신청</li>
            <li>공단 직원 방문조사 (약 1시간)</li>
            <li>의사소견서 제출 → 등급판정위원회 심의 (보통 30일 이내)</li>
            <li>등급 인정 후 복지용구를 본인부담금(일반 15%)으로 대여·구매</li>
          </ol>
        </section>
      )}

      <section>
        <h2 className="section-title">이 단계에서 많이 준비하는 복지용구</h2>
        <RatePicker rate={rate} onChange={setRate} />
        {result.categories.map((c) => (
          <CategoryGroup key={c} category={c} campaign="grade_check" rate={rate} />
        ))}
      </section>

      <ProductPicks campaign="grade_check" exclude={result.categories} />
      <ContactCta campaign="grade_check" />

      <div className="actions">
        <ShareButton title="우리 부모님 장기요양등급 예상해보기" />
        <OtherTools current="/grade" />
        <button
          className="link"
          onClick={() => {
            // 결과 기록에서 첫 질문 기록까지 되돌아가, 이후 뒤로가기가 자연스럽게 페이지를 벗어나도록
            window.history.go(-gradeQuestions.length);
            window.scrollTo(0, 0);
          }}
        >
          다시 해보기
        </button>
      </div>
    </>
  );
}
