import type { Metadata } from "next";
import { business } from "@/config/site";
export const metadata: Metadata = { title: "개인정보처리방침" };
export default function Page() { return <article className="card">
<h1>개인정보처리방침</h1>
<p>이 사이트는 복지용구 정보와 계산 도구, 장기요양기관 검색을 제공합니다. 고객 장부, 보호자 전용 조회, 개인정보 동의 입력, 쇼핑몰 주문 가져오기 기능은 제공하지 않습니다.</p>
<h2>입력 정보와 위치 이용</h2>
<p>계산 도구에 입력한 선택값은 결과 계산에 사용하며, 고객 이름·연락처를 등록하는 장부로 저장하지 않습니다. 가까운 기관 검색은 이용자가 허용한 위치 또는 선택한 지역으로 검색하며 검색 서버에 위치가 전달될 수 있습니다.</p>
<h2>기기 저장과 접속 정보</h2>
<p>글자 크기와 유입 경로 등 편의 설정은 브라우저에 저장될 수 있습니다. 서비스 제공 과정에서 호스팅 사업자가 접속 IP·요청 주소 등 접속 기록을 처리할 수 있습니다. 기기의 사이트 데이터 삭제 기능으로 브라우저 저장값을 지울 수 있습니다.</p>
<h2>외부 서비스</h2>
<p>상품 상세페이지·전화·카카오톡 등 외부 서비스로 이동하면 해당 서비스의 개인정보처리방침이 적용됩니다. 문의 과정에서 제공한 정보에 관한 요청은 아래 연락처로 문의해 주세요.</p>
<h2>개인정보 문의</h2><p>{business.company} · {business.privacyOfficer}<br/>{business.privacyContact}</p>
<p>시행일: 2026.11.09</p>
</article>; }
