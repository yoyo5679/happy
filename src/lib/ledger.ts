// 고객 장부 계산: 공단 조회 잔액 − 조회일 이후 해피케어 구입·대여분
import { EQUIPMENT_LIMIT } from "@/data/benefits";
import { limits } from "@/data/limits";
import { copay, type CategoryKey } from "@/data/products";

export type Recipient = {
  id?: string;
  token?: string;
  name: string;
  /** 예전 데이터 호환용 (지금은 저장하지 않음) */
  grade?: string;
  rate: number;
  /** 연 한도 적용기간 시작일 (공단 조회 화면 기준) */
  period_start: string;
  /** 조회일 기준 남은 한도 */
  base_remaining: number;
  base_date: string;
  /** 보호자 휴대폰: 입력할 때만 보내고 서버는 대조값으로만 저장 */
  guardian_phone?: string;
  /** 주문에서 등록할 때 서버가 만든 대조값 */
  guardian_hash?: string;
  clear_phone?: boolean;
  has_phone?: boolean;
  /** 등급·잔액 등 확인 필요 */
  needs_check?: boolean;
  updated_at?: string;
};

export type Item = {
  id: string;
  recipient_id?: string;
  kind: "buy" | "rent";
  product_id: string;
  category: string;
  name: string;
  /** 구입: 개당 급여가 / 대여: 월 대여가 */
  price: number;
  qty: number;
  /** 구입일 또는 대여 시작일 */
  date: string;
  end_date: string | null;
  status: "active" | "cancelled";
  note?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
/** 월 더하기 (말일 보정: 1/31 + 1개월 → 2/28) */
export function addMonths(s: string, n: number) {
  const d = parse(s);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return ymd(t);
}
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
export const periodEnd = (start: string) => addDays(addMonths(start, 12), -1);
export const dot = (s: string) => s.replace(/-/g, ".");

/** 대여 품목의 월 청구일 목록 (적용기간·종료일 안에서) */
export function rentCharges(it: Item, pStart: string, pEnd: string) {
  const out: string[] = [];
  const stop = it.end_date && it.end_date < pEnd ? it.end_date : pEnd;
  for (let n = 0; n < 240; n++) {
    const d = addMonths(it.date, n);
    if (d > stop) break;
    if (d >= pStart) out.push(d);
  }
  return out;
}

export type ItemCalc = {
  item: Item;
  /** 조회일 이후 이미 차감된 금액 */
  used: number;
  /** 앞으로 차감될 대여료 (적용기간 안) */
  scheduled: number;
  /** 본인부담 (구입: 합계, 대여: 월) */
  copay: number;
  /** 구입품: 다시 받을 수 있는 날 (내구연한) */
  renewAt?: string;
};

export type Ledger = {
  start: string;
  end: string;
  limit: number;
  /** 지금 남은 금액 */
  remaining: number;
  /** 대여 예정분까지 뺀 금액 */
  afterScheduled: number;
  used: number;
  scheduled: number;
  items: ItemCalc[];
  alerts: { tone: "warn" | "info"; text: string }[];
};

const durabilityYears = (category: string) => {
  const l = limits.find((x) => x.category === (category as CategoryKey));
  const m = l?.durability.match(/^(\d+)년$/);
  return m ? Number(m[1]) : null;
};

export function calcLedger(r: Recipient, items: Item[], at = today()): Ledger {
  const start = r.period_start;
  const end = periodEnd(start);
  const active = items.filter((i) => i.status === "active");
  const calcs: ItemCalc[] = active.map((it) => {
    if (it.kind === "buy") {
      const counted = it.date >= r.base_date && it.date >= start && it.date <= end;
      const y = durabilityYears(it.category);
      return {
        item: it,
        used: counted ? it.price * it.qty : 0,
        scheduled: 0,
        copay: copay(it.price, r.rate) * it.qty,
        renewAt: y ? addMonths(it.date, y * 12) : undefined,
      };
    }
    const charges = rentCharges(it, start, end).filter((d) => d >= r.base_date);
    const done = charges.filter((d) => d <= at).length;
    return {
      item: it,
      used: done * it.price,
      scheduled: (charges.length - done) * it.price,
      copay: copay(it.price, r.rate),
    };
  });
  const used = calcs.reduce((s, c) => s + c.used, 0);
  const scheduled = calcs.reduce((s, c) => s + c.scheduled, 0);
  const remaining = r.base_remaining - used;
  const afterScheduled = remaining - scheduled;

  const alerts: Ledger["alerts"] = [];
  if (afterScheduled < 0) alerts.push({ tone: "warn", text: `대여 예정분까지 합치면 한도를 ${(-afterScheduled).toLocaleString("ko-KR")}원 넘어요. 넘는 금액은 전액 본인 부담이에요.` });
  const left = daysBetween(at, end);
  if (left >= 0 && left <= 60) alerts.push({ tone: "info", text: `${dot(addDays(end, 1))}부터 한도 160만원이 새로 채워져요.` });
  for (const c of calcs) {
    const it = c.item;
    if (it.kind === "rent" && it.end_date) {
      const d = daysBetween(at, it.end_date);
      if (d >= 0 && d <= 45) alerts.push({ tone: "info", text: `${it.name} 대여가 ${dot(it.end_date)}에 끝나요. 연장할지 상담해 드릴게요.` });
    }
    if (c.renewAt) {
      const d = daysBetween(at, c.renewAt);
      if (d >= -365 && d <= 60) alerts.push({ tone: "info", text: `${it.name}은(는) ${dot(c.renewAt)}부터 내구연한이 지나 새로 받을 수 있어요.` });
    }
  }
  return { start, end, limit: EQUIPMENT_LIMIT, remaining, afterScheduled, used, scheduled, items: calcs, alerts };
}
