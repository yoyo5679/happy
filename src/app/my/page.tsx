import type { Metadata } from "next";
import { MyLedger } from "./MyLedger";

export const metadata: Metadata = {
  title: "우리 부모님 복지용구 현황",
  description: "올해 남은 복지용구 금액과 이용 중인 품목을 확인하세요.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MyLedger />;
}
