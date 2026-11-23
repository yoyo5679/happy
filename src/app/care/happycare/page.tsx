import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import {HappycareInfo} from "@/components/HappycareInfo";
export const metadata: Metadata = pageMeta({
  path: "/care/happycare",
  title: "해피케어 복지용구 쇼핑몰 · 전국 주문·상담",
  description: "해피케어복지용구는 서울 은평구 갈현동의 복지용구 사업소예요. 장기요양 등급이 있으면 전국 어디서나 쇼핑몰로 주문하고 전화·카카오톡으로 상담받을 수 있어요.",
  keywords: ["해피케어몰", "복지용구 쇼핑몰", "은평구 복지용구", "갈현동 복지용구", "서울 복지용구 사업소"],
});
export default function Page(){return <><Link href="/care" className="btn">← 기관 찾기로</Link><HappycareInfo headingLevel={1}/></>;}
