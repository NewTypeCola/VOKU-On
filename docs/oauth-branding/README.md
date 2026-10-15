# Google 브랜드 인증용 안내 페이지

2026-10-12 사용자가 운영 표시명 **VOKU On**, 문의 주소 **vokuon@gmail.com**, 소개·개인정보처리방침·이용약관의 공개를 승인했다. 회원 탈퇴 화면을 새로 만드는 대신 이메일로 탈퇴·완전 삭제 요청을 받고 본인 확인 후 처리하는 초기 운영 방식을 승인했다.

이 폴더의 HTML은 승인 당시의 **로컬 확인본**을 보관한 문서다. 2026-10-15에 개인 프로젝트 소개와 정보 조회 권한 설명을 정리했으며, 최신 운영 안내는 다음 경로에서 관리한다.

| 용도 | 파일 | 운영 URL |
| --- | --- | --- |
| 서비스 소개 / Google 앱 홈페이지 | `public/about/index.html` | `https://voku.pages.dev/about/` |
| 개인정보처리방침 | `public/privacy/index.html` | `https://voku.pages.dev/privacy/` |
| 이용약관 | `public/terms/index.html` | `https://voku.pages.dev/terms/` |
| 공통 스타일 | `public/service-info.css` | `https://voku.pages.dev/service-info.css` |
| Search Console 소유권 확인 | `public/googlec48ffcbf40f9282e.html` | `https://voku.pages.dev/googlec48ffcbf40f9282e.html` |

당시 승인 범위는 안내 페이지와 확인 파일의 GitHub 커밋·푸시·운영 배포, 전용 계정의 사이트 소유권 확인, Google 브랜드 인증이다. 당시에는 로컬에 있던 로그인 화면·인증 코드·공통 모션 변경 전체의 배포 승인이 아니었다. 이후 통합 배포 승인은 `docs/auth-setup.md` 9절에 기록한다.

운영 안내 파일 5개만 `8dde54ee0aa115db4837a09d975e1468359cc36d`로 커밋하고 `main`에 푸시했다. 기존 운영 커밋에 이 파일들만 더한 별도 검증 사본에서 테스트 110개, `npm run check`, `npm run build`를 통과했다. 빌드된 정적 사이트에서 세 문서의 제목·탐색·공개 전 문구 제거와 가로 넘침 없음을 확인했다. Vite 개발 서버는 `public` 하위 디렉터리의 `index.html` 경로를 자동 탐색하지 않으므로 운영 경로 QA는 빌드 결과를 제공하는 정적 서버에서 진행했다.

Google은 홈페이지·개인정보처리방침의 실제 공개와 소유권을 검증한다. 테스트 상태나 앱 이름 필드 저장만으로 동의 화면의 앱 이름 표시 완료라고 기록하지 않는다. 실제 인증·게시 결과는 `docs/auth-setup.md`에서 이어서 관리한다.

2026-10-12 사용자의 별도 승인 후 OAuth 앱의 게시 상태를 **프로덕션 단계**로 전환했다. 사용자 지정 마이크 로고의 원본은 보존하고 Google 권장 규격인 120×120 파생 PNG(`assets/branding/voku-on-google-oauth-120.png`)를 앱 로고로 저장했다. Search Console 소유권 확인은 성공했지만, Google 브랜드 자동 검사는 홈페이지 소유권 정보 반영을 위해 **24시간 후 재시도**하라고 안내했다. 브랜드 인증·게시와 실제 로그인 화면의 이름·로고 노출 확인은 대기 중이다.

참고: [Google 브랜드 관리](https://support.google.com/cloud/answer/15549049?hl=en), [홈페이지 요건](https://support.google.com/cloud/answer/13807376?hl=en), [개인정보처리방침 요건](https://support.google.com/cloud/answer/13806988?hl=en-uk), [개인정보 정정·삭제 요청](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029335317).
