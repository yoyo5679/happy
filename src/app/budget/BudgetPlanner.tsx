"use client";

import { useEffect, useMemo, useState } from "react";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { categories, categoryGroups, copay, productUrl, won, type CategoryKey } from "@/data/products";
import { buildPlans, EQUIPMENT_LIMIT, groupKeys, groupOfCategory, groupPlan, tiers, type Plan } from "@/lib/budget";
import { withUtm } from "@/lib/utm";

const BUDGETS = [300_000, 500_000, 1_000_000, EQUIPMENT_LIMIT];
const MONTHS = [3, 6, 12];
const orderOf = (c: CategoryKey) => {
  const g = groupOfCategory(c)!;
  const p = groupPlan[g];
  return groupKeys.indexOf(g) * 100 + [...p.core, ...p.extra].indexOf(c);
};

export function BudgetPlanner() {
  const [budget, setBudget] = useState(500_000);
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<CategoryKey[]>([]);
  const [months, setMonths] = useState(3);
  const [rate, setRate] = useState(0.15);

  // ?c=품목,품목 (추천 결과에서 넘어옴) 또는 ?g=묶음
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const cs = (q.get("c") ?? "").split(",").filter((c) => c in categories && groupOfCategory(c as CategoryKey)) as CategoryKey[];
    const gs = (q.get("g") ?? "").split(",").filter((g) => groupKeys.includes(g));
    if (cs.length) setSelected(cs);
    else if (gs.length) setSelected(gs.flatMap((g) => groupPlan[g].core));
    const b = Number(q.get("b"));
    if (b > 0) setBudget(Math.min(EQUIPMENT_LIMIT, b));
  }, []);

  const activeGroups = groupKeys.filter((g) => selected.some((c) => groupOfCategory(c) === g));

  function toggleGroup(g: string) {
    const inGroup = (c: CategoryKey) => groupOfCategory(c) === g;
    setSelected((s) => (s.some(inGroup) ? s.filter((c) => !inGroup(c)) : [...s, ...groupPlan[g].core]));
  }
  function toggleItem(c: CategoryKey) {
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }
  function setCustomBudget(v: string) {
    setCustom(v);
    const n = Number(v.replace(/\D/g, "")) * 10_000;
    if (n > 0) setBudget(Math.min(EQUIPMENT_LIMIT, n));
  }

  const ordered = useMemo(() => [...selected].sort((a, b) => orderOf(a) - orderOf(b)), [selected]);
  const { plans, fit } = useMemo(() => buildPlans(ordered, months, budget), [ordered, months, budget]);
  // 예산 안에 드는 가장 높은 단계를 추천. 하나도 없으면 '예산 맞춤' 세트를 추천
  const best = [...plans].reverse().find((p) => p.total <= budget) ?? (fit && fit.lines.length > 0 ? fit : undefined);

  return (
    <>
      <div className="page-title">
        <h1>💰 예산으로 세트 짜기</h1>
        <p className="muted">복지용구 연 160만원 중 쓸 금액과 필요한 것을 고르면, 금액대별로 세트를 짜 드려요.</p>
      </div>

      <section className="card bp-step">
        <h3>1. 160만원 중 얼마까지 쓸까요?</h3>
        <div className="bp-chips">
          {BUDGETS.map((b) => (
            <button key={b} className={budget === b && !custom ? "chip on" : "chip"} onClick={() => { setCustom(""); setBudget(b); }}>
              {b === EQUIPMENT_LIMIT ? "160만원 전부" : `${b / 10_000}만원`}
            </button>
          ))}
        </div>
        <label className="bp-custom">
          직접 입력
          <input inputMode="numeric" placeholder="예: 80" value={custom} onChange={(e) => setCustomBudget(e.target.value)} />
          만원
        </label>
        <p className="muted small">정상가(급여가) 기준이에요. 실제로 내시는 돈은 아래 본인부담률만큼이에요.</p>
      </section>

      <section className="card bp-step">
        <h3>2. 어떤 게 필요하세요? (여러 개 가능)</h3>
        <div className="cat-groups">
          {categoryGroups.map((g) => (
            <button key={g.key} aria-pressed={activeGroups.includes(g.key)} className={activeGroups.includes(g.key) ? "on" : ""} onClick={() => toggleGroup(g.key)}>
              <span className="ico" aria-hidden>
                {g.emoji}
              </span>
              {g.label}
            </button>
          ))}
        </div>
        {activeGroups.length > 0 && (
          <div className="bp-items">
            <p className="muted small">담을 품목 (눌러서 빼거나 더할 수 있어요)</p>
            {activeGroups.map((g) => (
              <div key={g} className="bp-chips">
                {[...groupPlan[g].core, ...groupPlan[g].extra].map((c) => (
                  <button key={c} aria-pressed={selected.includes(c)} className={selected.includes(c) ? "chip on" : "chip"} onClick={() => toggleItem(c)}>
                    {selected.includes(c) ? "✓ " : "+ "}
                    {categories[c].label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card bp-step">
        <h3>3. 대여 품목은 몇 개월로 계산할까요?</h3>
        <div className="bp-chips">
          {MONTHS.map((m) => (
            <button key={m} className={months === m ? "chip on" : "chip"} onClick={() => setMonths(m)}>
              {m}개월{m === 3 ? " (기본)" : ""}
            </button>
          ))}
        </div>
        <p className="muted small">전동침대·휠체어·매트리스처럼 대여하는 품목은 월 대여료 × 개월 수로 계산해요.</p>
      </section>

      <RatePicker rate={rate} onChange={setRate} />

      {ordered.length === 0 ? (
        <p className="bp-empty muted">2번에서 필요한 것을 골라 주세요.</p>
      ) : (
        <>
          <h2 className="section-title">금액대별 추천 세트</h2>
          {fit &&
            (fit.lines.length > 0 ? (
              <PlanCard plan={fit} budget={budget} rate={rate} months={months} highlight={fit === best} label="예산 맞춤" desc="예산 안에 들어오도록 꼭 필요한 품목부터 담았어요" />
            ) : (
              <p className="card bp-warn">
                고르신 품목은 가장 저렴한 모델 하나도 예산({won(budget)})을 넘어요. 예산을 늘리거나, 대여 기간을 줄이거나, 품목을 빼 보세요.
              </p>
            ))}
          {plans.map((p) => {
            const t = tiers.find((x) => x.key === p.tier)!;
            return <PlanCard key={p.tier} plan={p} budget={budget} rate={rate} months={months} highlight={p === best} label={t.label} desc={t.desc} />;
          })}
          <p className="muted small">
            품목마다 1개씩 담았어요. 이미 받은 품목은 내구연한 동안 다시 받을 수 없으니 빼고 보세요. 가격은 해피케어몰 판매가 기준이에요.
          </p>
        </>
      )}

      <ContactCta campaign="budget" />
    </>
  );
}

function PlanCard({ plan, budget, rate, months, highlight, label, desc }: { plan: Plan; budget: number; rate: number; months: number; highlight?: boolean; label: string; desc: string }) {
  const over = plan.total - budget;
  const pct = Math.round(rate * 100);
  const used = Math.min(100, Math.round((plan.total / EQUIPMENT_LIMIT) * 100));
  const monthlyAfter = plan.lines.filter((l) => l.rental).reduce((s, l) => s + (l.monthly ?? 0), 0);
  return (
    <section className={`card bp-plan${highlight ? " best" : ""}${over > 0 ? " over" : ""}`}>
      <div className="bp-head">
        <div>
          <h3>
            {label} {highlight && <span className="badge">추천</span>}
          </h3>
          <p className="muted small">{desc}</p>
        </div>
        <div className="bp-sum">
          <span className="muted small">본인부담({pct}%)</span>
          <strong>{rate === 0 ? "없음" : won(copay(plan.total, rate))}</strong>
        </div>
      </div>

      <div className="bp-bar" aria-label={`160만원 중 ${used}% 사용`}>
        <div style={{ width: `${used}%` }} />
      </div>
      <p className="bp-barlabel small">
        160만원 중 <strong>{won(plan.total)}</strong> 사용 · 남은 한도 {won(Math.max(0, EQUIPMENT_LIMIT - plan.total))}
        {plan.total > EQUIPMENT_LIMIT ? (
          <span className="over-txt"> · 연 160만원 한도를 {won(plan.total - EQUIPMENT_LIMIT)} 넘어요 (넘는 금액은 전액 본인 부담)</span>
        ) : (
          over > 0 && <span className="over-txt"> · 예산보다 {won(over)} 많아요</span>
        )}
      </p>

      <ul className="bp-lines">
        {plan.lines.map((l) => (
          <li key={l.category}>
            <a href={withUtm(productUrl(l.product), "budget", l.product.code ?? l.product.id)} target="_blank" rel="noopener">
              <img src={l.product.img} alt="" loading="lazy" />
              <span className="bp-name">
                <span className="muted small">{categories[l.category].label}</span>
                <strong>{l.product.name}</strong>
              </span>
              <span className="bp-price">
                {l.rental ? (
                  <>
                    <span className="small muted">월 {won(l.monthly!)} × {months}개월</span>
                    {won(l.cost)}
                  </>
                ) : (
                  won(l.cost)
                )}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {plan.dropped.length > 0 && (
        <p className="small muted">예산 때문에 뺀 품목: {plan.dropped.map((c) => categories[c].label).join(", ")}</p>
      )}
      {monthlyAfter > 0 && (
        <p className="small muted">
          대여 품목을 {months}개월 넘게 쓰시면 매달 {won(monthlyAfter)}
          {rate > 0 ? `(본인부담 ${won(copay(monthlyAfter, rate))})` : ""}씩 더 들어요.
        </p>
      )}
    </section>
  );
}
