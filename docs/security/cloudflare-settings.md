# Cloudflare에서 직접 확인할 계정 설정

2026-11-15 보완: 구형 관리 API 폐쇄, Next.js 16.4.6 패치, 해시 기반 CSP·프레임 차단·HSTS·nosniff·referrer·기능 권한 헤더, 위치/주소 검색의 POST 본문 전송. 현재 공개 GET 호환 경로는 기존에 열린 탭을 위해 유지한다. 원문 위치·주소를 앱 로그에 출력하는 코드는 없다.

이 저장소와 GitHub 연결만으로 Cloudflare 계정 설정과 MFA를 읽거나 변경할 수는 없다. 아래는 적용됐다고 가정하면 안 되는 관리자 확인 항목이다.

1. Cloudflare 계정의 MFA를 켜고 복구 코드는 안전한 별도 장소에 보관한다. GitHub 계정도 MFA를 확인한다. MFA 비밀값/복구 코드를 채팅이나 저장소에 넣지 않는다.
2. Pages `happycare → Settings → Variables and Secrets`에서 공단·카카오 키를 Secret으로 보관한다. 코드에서 더 이상 쓰지 않는 `STAFF_PASSWORD`는 삭제한다. 과거 불필요한 IMWEB 키가 있으면 함께 폐기한다.
3. Workers/Pages 로그·Observability·Logpush·외부 로그 수집 설정을 확인한다. 원문 좌표, 상세 주소, 요청 본문, Authorization 및 serviceKey 쿼리 값을 기록하지 않는다. 오류는 상태 코드·단계·비민감 식별자만 남긴다.
4. 접속 로그가 꼭 필요하면 목적과 최소 보관기간을 정한다(예: 7일). 해당 상품에서 보관기간 조절이 불가능하면 원문 위치를 수집하지 않고, 외부 로그 저장소에는 삭제 정책을 설정한다. **7일 보관이 현재 적용됐다는 뜻은 아니다.** 기존 로그·백업·과거 배포의 데이터 보관기간은 별도로 확인한다.
5. 보고서 전용 `ltc-update-reports` 브랜치의 Pages 프리뷰 배포가 불필요하면 Branch deployment controls에서 제외한다. 프리뷰 환경에 운영 Secret/DB 권한이 무분별하게 복제되지 않도록 확인한다.

CSP는 정적 내보내기 후 각 페이지의 실제 인라인 스크립트 SHA-256으로 생성한다. `public/_headers`에 전역 CSP를 임의로 추가하면 Cloudflare의 중복 헤더 결합 때문에 Next.js 스크립트가 차단될 수 있다. 변경 시 `npm run build`와 `node scripts/security/check-headers.cjs`를 실행한다.

호출 제한(보고서 1번)은 이번 변경 대상에서 제외했다. 캐시·보안 헤더가 반복 호출에 따른 API/DB 한도 소모를 막아 주는 것은 아니다.
