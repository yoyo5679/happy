import Link from "next/link";
export const metadata = { title: "종료된 서비스", robots: { index: false, follow: false } };
export default function Page() { return <section className="card"><h1>종료된 서비스입니다.</h1><p>이 페이지는 더 이상 이용할 수 없습니다.</p><Link href="/" className="btn">홈으로 이동</Link></section>; }
