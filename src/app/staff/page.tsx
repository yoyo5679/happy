import type { Metadata } from "next";
import { StaffApp } from "./StaffApp";

export const metadata: Metadata = {
  title: "고객 장부 (직원용)",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StaffApp />;
}
