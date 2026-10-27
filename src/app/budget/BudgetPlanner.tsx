"use client";

import { useEffect, useMemo, useState } from "react";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { categories, categoryGroups, copay, isSoldOut, productUrl, products, won, type CategoryKey } from "@/data/products";
import { activePins, buildPlans, EQUIPMENT_LIMIT, groupKeys, groupOfCategory, groupPlan, lineCopay, modelChoices, planCopay, tiers, type Pins, type Plan } from "@/lib/budget";
import { source, withUtm } from "@/lib/utm";
import { cartUrl } from "@/lib/cart";
import { ShareText } from "@/components/ShareText";
import { ResultBar } from "@/components/ResultBar";

const BUDGETS = [300_000, 500_000, 1_000_000, EQUIPMENT_LIMIT];

const MONTHS = [3, 6, 12];
/** 모든 모델이 품절인 품목 */
const soldOutCats = new Set((Object.keys(categories) as CategoryKey[]).filter((c) => !products.some((p) => p.category === c && !isSoldOut(p))));
const inStock = (cs: CategoryKey[]) => cs.filter((c) => !soldOutCats.has(c));
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
  const [withQty, setWithQty] = useState(true);
  const [pins, setPins] = useState<Pins>({});
  /** 모델 바꾸기 목록을 연 줄 (세트·품목) */
  const [swap, setSwap] = useState<{ tier: string; category: CategoryKey } | null>(null);

  // ?c=품목,품목 (추천 결과에서 넘어옴) 또는 ?g=묶음
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const cs = (q.get("c") ?? "").split(",").filter((c) => c in categories && groupOfCategory(c as CategoryKey)) as CategoryKey[];
    const gs = (q.get("g") ?? "").split(",").filter((g) => groupKeys.includes(g));
    if (cs.length) setSelected(cs);
    else if (gs.length) setSelected(gs.flatMap((g) => inStock(groupPlan[g].core)));
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
    if (q.get("q") === "0") setWithQty(false);
    // ?p=품목:상품id,품목:상품id (고객이 고른 모델)
    const ps: Pins = {};
    for (const pair of (q.get("p") ?? "").split(",")) {
      const [c, id] = pair.split(":");
      if (c in categories && id) ps[c as CategoryKey] = id;
    }
    setPins(ps);
  }, []);

  const activeGroups = groupKeys.filter((g) => selected.some((c) => groupOfCategory(c) === g));

  function toggleGroup(g: string) {
    const inGroup = (c: CategoryKey) => groupOfCategory(c) === g;
    setSelected((s) => (s.some(inGroup) ? s.filter((c) => !inGroup(c)) : [...s, ...inStock(groupPlan[g].core)]));
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
  const pinned = useMemo(() => activePins(pins, months), [pins, months]);
  const { plans, missing } = useMemo(() => buildPlans(ordered, months, budget, withQty, pinned), [ordered, months, budget, withQty, pinned]);
  function choose(c: CategoryKey, id: string | null) {
    setPins((p) => {
      const next = { ...p };
      if (id) next[c] = id;
      else delete next[c];
      return next;
    });
    setSwap(null);
  }
  // 추천: 예산 안이면 균형 잡힌 표준형, 아니면 실속형
  const best = plans[1].total <= budget ? plans[1] : plans[0].total <= budget ? plans[0] : undefined;
  const shown = plans[0].total >= budget ? plans.slice(0, 1) : plans;

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
                {[...groupPlan[g].core, ...groupPlan[g].extra].map((c) => {
                  const on = selected.includes(c);
                  const out = soldOutCats.has(c);
                  return (
                    <button key={c} aria-pressed={on} disabled={out && !on} className={on ? "chip on" : "chip"} onClick={() => toggleItem(c)}>
                      {on ? "✓ " : out ? "" : "+ "}
                      {categories[c].label}
                      {out && <span className="chip-out"> 품절</span>}
                    </button>
                  );
                })}
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
              체크하신 품목을 모두 담으면 가장 합리적인 실속형도 {won(plans[0].total)}이라 예산({won(budget)})보다 많아요. 그래서 실속형만
              보여 드려요. 예산을 늘리면 표준형·든든형도 나와요. 대여 기간을 줄이거나 꼭 필요하지 않은 품목의 체크를 빼도 돼요.
            </p>
          )}
          {missing.length > 0 && (
            <p className="card bp-warn">
              지금 품절이라 세트에 넣지 못한 품목: <strong>{missing.map((c) => categories[c].label).join(", ")}</strong> · 입고 일정은 상담으로
              문의해 주세요.
            </p>
          )}
          {Object.keys(pinned).length > 0 && (
            <p className="card bp-pinned">
              📌 직접 고른 모델: <strong>{(Object.keys(pinned) as CategoryKey[]).filter((c) => ordered.includes(c)).map((c) => categories[c].label).join(", ")}</strong>
              <br />
              <span className="muted small">세 세트 모두 이 모델로 담고, 나머지 품목으로 금액을 맞췄어요.</span>{" "}
              <button className="link small" onClick={() => setPins({})}>
                모두 추천 모델로 되돌리기
              </button>
            </p>
          )}
          <div className={shown.length > 1 ? "bp-plans multi" : "bp-plans"}>
          {shown.map((p) => {
            const t = tiers.find((x) => x.key === p.tier)!;
            const desc =
              p.tier !== "premium"
                ? t.desc
                : p.total > budget
                  ? "예산 안에 다 담을 수 없어 가장 합리적인 모델로 담았어요"
                  : p.total < budget - 30_000
                    ? withQty
                      ? "품목별 수량 한도까지 담아도 예산보다 적게 들어요"
                      : "고른 품목을 가장 좋은 모델로 담아도 예산보다 적게 들어요"
                    : t.desc;
            return (
              <PlanCard
                key={p.tier}
                plan={p}
                budget={budget}
                rate={rate}
                months={months}
                highlight={p === best}
                label={t.label}
                desc={desc}
                pins={pinned}
                missing={missing}
                swapping={swap?.tier === p.tier ? swap.category : null}
                onSwap={(c) => setSwap(swap?.tier === p.tier && swap.category === c ? null : { tier: p.tier, category: c })}
                onChoose={choose}
              >
                {p.tier === "premium" && (
                  <label className="bp-toggle">
                    <input type="checkbox" checked={withQty} onChange={(e) => setWithQty(e.target.checked)} />
                    수량까지 늘려서 예산 채우기
                    <span className="muted small"> (품목별 급여 수량 한도 안에서)</span>
                  </label>
                )}
              </PlanCard>
            );
          })}
          </div>
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
                if (!withQty) u.searchParams.set("q", "0");
                const pp = Object.entries(pinned).map(([c, id]) => `${c}:${id}`).join(",");
                if (pp) u.searchParams.set("p", pp);
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
      {ordered.length > 0 && <ResultBar share={<ShareText
              compact
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
                if (!withQty) u.searchParams.set("q", "0");
                const pp = Object.entries(pinned).map(([c, id]) => `${c}:${id}`).join(",");
                if (pp) u.searchParams.set("p", pp);
                const src = source();
                if (src !== "direct") u.searchParams.set("src", src);
                return u.toString();
              }}
            />} />}
    </>
  );
}

function PlanCard({
  plan,
  budget,
  rate,
  months,
  highlight,
  label,
  desc,
  pins,
  missing,
  swapping,
  onSwap,
  onChoose,
  children,
}: {
  pins: Pins;
  /** 모든 모델이 품절이라 담지 못한 품목 */
  missing: CategoryKey[];
  swapping: CategoryKey | null;
  onSwap: (c: CategoryKey) => void;
  onChoose: (c: CategoryKey, id: string | null) => void;
  plan: Plan;
  budget: number;
  rate: number;
  months: number;
  highlight?: boolean;
  label: string;
  desc: string;
  children?: React.ReactNode;
}) {
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
          <strong>{rate === 0 ? "없음" : won(planCopay(plan, rate, months))}</strong>
        </div>
      </div>

      {children}
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
                <strong>
                  {l.product.name}
                  {l.qty > 1 && <span className="bp-qty"> × {l.qty}개</span>}
                </strong>
                <span className="small muted">
                  {l.rental
                    ? `월 ${won(l.monthly!)} × ${months}개월 = ${won(l.cost)}`
                    : l.qty > 1
                      ? `정상가 ${won(l.unit)} × ${l.qty}개 = ${won(l.cost)}`
                      : `정상가 ${won(l.cost)}`}
                </span>
              </span>
              <span className="bp-price">
                <span className="muted small">본인부담</span>
                <span className="bp-copay">{rate === 0 ? "없음" : won(lineCopay(l, rate, months))}</span>
                {l.rental && rate > 0 && <span className="small muted">월 {won(copay(l.monthly!, rate))}</span>}
              </span>
            </a>
            <div className="bp-swap-row">
              {pins[l.category] === l.product.id && <span className="bp-pin">📌 직접 고른 모델</span>}
              <button className="bp-swap" aria-expanded={swapping === l.category} onClick={() => onSwap(l.category)}>
                {swapping === l.category ? "닫기" : "🔄 다른 모델로 바꾸기"}
              </button>
            </div>
            {swapping === l.category && (
              <ModelPicker category={l.category} current={l.product.id} pinned={!!pins[l.category]} rate={rate} months={months} onChoose={onChoose} />
            )}
          </li>
        ))}
        {missing.map((c) => (
          <li key={c} className="bp-out" aria-disabled="true">
            <span className="bp-name">
              <span className="muted small">{categories[c].label}</span>
              <strong>모든 모델이 품절이에요</strong>
            </span>
            <span className="badge out">품절</span>
          </li>
        ))}
      </ul>
      {monthlyAfter > 0 && (
        <p className="small muted">
          대여 품목을 {months}개월 넘게 쓰시면 매달 {won(monthlyAfter)}
          {rate > 0 ? `(본인부담 ${won(copay(monthlyAfter, rate))})` : ""}씩 더 들어요.
        </p>
      )}
      {plan.lines.length > 0 && (
        <div className="bp-cart">
          <a className="btn primary wide" href={cartUrl(plan, rate, months, "budget")} target="_blank" rel="noopener">
            🛒 {label} 세트 장바구니에 담기
          </a>
          <p className="bp-cart-note small muted">
            해피케어몰 장바구니에 {plan.lines.length}개 상품이 본인부담 {pct}%{monthlyAfter > 0 ? ` · 대여 ${months}개월` : ""}로 담겨요. 색상은
            장바구니에서 바꿀 수 있어요.
          </p>
        </div>
      )}
    </section>
  );
}

function ModelPicker({
  category,
  current,
  pinned,
  rate,
  months,
  onChoose,
}: {
  category: CategoryKey;
  current: string;
  pinned: boolean;
  rate: number;
  months: number;
  onChoose: (c: CategoryKey, id: string | null) => void;
}) {
  const models = modelChoices(category, months);
  const soldOut = products.filter((p) => p.category === category && isSoldOut(p));
  return (
    <div className="bp-picker">
      <p className="small muted">
        {categories[category].label} {models.length}개 모델{soldOut.length > 0 && ` (품절 ${soldOut.length}개는 맨 뒤)`} · 고른 모델은 실속·표준·든든 세트 모두에 들어가요.
      </p>
      {pinned && (
        <button className="link small" onClick={() => onChoose(category, null)}>
          ↩ 추천 모델로 되돌리기
        </button>
      )}
      <ul>
        {models.map((m) => (
          <li key={m.product.id}>
            <button className={m.product.id === current ? "on" : ""} onClick={() => onChoose(category, m.product.id)} aria-pressed={m.product.id === current}>
              <img src={m.product.img} alt="" loading="lazy" />
              <span className="bp-name">
                <strong>{m.product.name}</strong>
                <span className="small muted">{m.rental ? `대여 월 ${won(m.monthly!)}` : `구입 정상가 ${won(m.unit)}`}</span>
              </span>
              <span className="bp-price">
                <span className="small muted">{m.rental ? "월 본인부담" : "본인부담"}</span>
                <span className="bp-copay">{rate === 0 ? "없음" : won(copay(m.rental ? m.monthly! : m.unit, rate))}</span>
                {m.product.id === current && <span className="small bp-cur">담긴 모델</span>}
              </span>
            </button>
          </li>
        ))}
        {soldOut.map((p) => (
          <li key={p.id}>
            <button className="out" disabled aria-disabled="true">
              <img src={p.img} alt="" loading="lazy" />
              <span className="bp-name">
                <strong>{p.name}</strong>
                <span className="small muted">{p.rent ? `대여 월 ${won(p.rent.price)}` : p.buy ? `구입 정상가 ${won(p.buy.price)}` : ""}</span>
              </span>
              <span className="bp-price">
                <span className="badge out">품절</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
