"use client";

import { useEffect, useMemo, useState } from "react";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { categories, categoryGroups, copay, productUrl, won, type CategoryKey } from "@/data/products";
import { buildPlans, EQUIPMENT_LIMIT, groupKeys, groupOfCategory, groupPlan, tiers, type Line, type Plan } from "@/lib/budget";
import { source, withUtm } from "@/lib/utm";
import { ShareText } from "@/components/ShareText";

const BUDGETS = [300_000, 500_000, 1_000_000, EQUIPMENT_LIMIT];

/** 품목 본인부담: 대여는 쇼핑몰처럼 '월 본인부담(10원 미만 절사) × 개월' */
const lineCopay = (l: Line, rate: number, months: number) => (l.rental ? copay(l.monthly!, rate) * months : copay(l.cost, rate));
const planCopay = (p: Plan, rate: number, months: number) => p.lines.reduce((s, l) => s + lineCopay(l, rate, months), 0);
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
    if (b > 0) {
      const v = Math.min(EQUIPMENT_LIMIT, b);
      setBudget(v);
      if (!BUDGETS.includes(v)) setCustom(String(Math.round(v / 10_000)));
    }
    const m = Number(q.get("m"));
    if (MONTHS.includes(m)) setMonths(m);
    const r = Number(q.get("r"));
    if (q.has("r") && [15, 9, 6, 0].includes(r)) setRate(r / 100);
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
  const { plans, missing } = useMemo(() => buildPlans(ordered, months), [ordered, months]);
  // 예산 안에 드는 가장 높은 단계를 추천 (든든형은 160만원 기준이라 예산과 비교하지 않음)
  const best = [...plans].reverse().find((p) => p.tier !== "premium" && p.total <= budget);

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
          {!best && plans[0].lines.length > 0 && (
            <p className="card bp-warn">
              체크하신 품목을 모두 담으면 가장 합리적인 실속형도 {won(plans[0].total)}이라 예산({won(budget)})보다 많아요. 예산을 늘리거나,
              대여 기간을 줄이거나, 꼭 필요하지 않은 품목의 체크를 빼 보세요.
            </p>
          )}
          {missing.length > 0 && (
            <p className="card bp-warn">
              지금 품절이라 세트에 넣지 못한 품목: <strong>{missing.map((c) => categories[c].label).join(", ")}</strong> · 입고 일정은 상담으로
              문의해 주세요.
            </p>
          )}
          {plans.map((p) => {
            const t = tiers.find((x) => x.key === p.tier)!;
            const desc =
              p.tier !== "premium"
                ? t.desc
                : p.total > EQUIPMENT_LIMIT
                  ? "고른 품목이 많아 160만원 안에 다 담을 수 없어요. 가장 합리적인 모델로 담았어요"
                  : p.total < EQUIPMENT_LIMIT - 50_000
                    ? "고른 품목을 가장 좋은 모델로 담은 구성 (160만원보다 적게 들어요)"
                    : t.desc;
            return <PlanCard key={p.tier} plan={p} budget={budget} rate={rate} months={months} highlight={p === best} label={t.label} desc={desc} />;
          })}
          <div className="actions">
            <ShareText
              heading={`복지용구 예산 세트 (160만원 중 ${won(budget)})`}
              lines={[
                `담은 품목: ${ordered.filter((c) => !missing.includes(c)).map((c) => categories[c].label).join(", ")}`,
                "",
                ...plans.map((p) => {
                  const t = tiers.find((x) => x.key === p.tier)!;
                  const pay = rate === 0 ? "본인부담 없음" : `본인부담 ${won(planCopay(p, rate, months))}`;
                  return `${p === best ? "⭐ " : "• "}${t.label}: ${won(p.total)}어치 (${pay})`;
                }),
                ...(plans.some((p) => p.lines.some((l) => l.rental)) ? [`(대여 품목은 ${months}개월 기준)`] : []),
              ]}
              url={() => {
                const u = new URL("/budget", window.location.origin);
                u.searchParams.set("b", String(budget));
                u.searchParams.set("c", ordered.join(","));
                u.searchParams.set("m", String(months));
                u.searchParams.set("r", String(Math.round(rate * 100)));
                const src = source();
                if (src !== "direct") u.searchParams.set("src", src);
                return u.toString();
              }}
            />
          </div>
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
  // 든든형은 예산과 상관없이 160만원 한도를 채우는 세트라 '예산 초과' 표시를 하지 않음
  const over = plan.tier === "premium" ? 0 : plan.total - budget;
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
          <strong>{rate === 0 ? "없음" : won(planCopay(plan, rate, months))}</strong>
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
                <span className="bp-copay">{rate === 0 ? "본인부담 없음" : `본인부담 ${won(lineCopay(l, rate, months))}`}</span>
                <span className="small muted">
                  {l.rental
                    ? rate === 0
                      ? `월 ${won(l.monthly!)} × ${months}개월`
                      : `월 ${won(copay(l.monthly!, rate))} × ${months}개월`
                    : `정상가 ${won(l.cost)}`}
                </span>
                {l.rental && <span className="small muted">정상가 {won(l.cost)}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {monthlyAfter > 0 && (
        <p className="small muted">
          대여 품목을 {months}개월 넘게 쓰시면 매달 {won(monthlyAfter)}
          {rate > 0 ? `(본인부담 ${won(copay(monthlyAfter, rate))})` : ""}씩 더 들어요.
        </p>
      )}
    </section>
  );
}
