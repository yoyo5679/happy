import { site } from "@/config/site";
import type { Plan } from "@/lib/budget";
import { withUtm } from "@/lib/utm";

// 세트를 해피케어몰(아임웹) 장바구니에 한 번에 담는 주소.
// 쇼핑몰 Footer Code의 담기 스크립트(imweb/cart-import.html)가 아래 값을 읽어 상품마다 부담률·대여기간 옵션을 골라 담습니다.
//   hc_cart=1223x2,1331r  쇼핑몰 상품번호(idx) + r(대여) + x수량
//   hc_r=15               본인부담률(%)
//   hc_m=3                대여 개월 수

const idxOf = (url?: string) => url?.match(/[?&]idx=(\d+)/)?.[1];

export function cartUrl(plan: Plan, rate: number, months: number, campaign: string): string {
  const items = plan.lines
    .map((l) => {
      const idx = idxOf((l.rental ? l.product.rent : l.product.buy)?.url);
      return idx && `${idx}${l.rental ? "r" : ""}${l.qty > 1 ? `x${l.qty}` : ""}`;
    })
    .filter(Boolean);
  const u = new URL("/shop_cart", site.storeUrl);
  u.searchParams.set("hc_cart", items.join(","));
  u.searchParams.set("hc_r", String(Math.round(rate * 100)));
  u.searchParams.set("hc_m", String(months));
  return withUtm(u.toString(), campaign, plan.tier);
}
