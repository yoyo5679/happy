import Link from "next/link";
import {HappycareInfo} from "@/components/HappycareInfo";
export const metadata={title:"해피케어 복지용구 · 전국 쇼핑몰 주문",description:"해피케어 복지용구 쇼핑몰에서 전국 어디서나 주문하고 상담하세요."};
export default function Page(){return <><Link href="/care" className="btn">← 기관 찾기로</Link><HappycareInfo headingLevel={1}/></>;}
