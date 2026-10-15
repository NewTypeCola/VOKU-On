# 구조 조사와 이용 분석 연결

2026-10-14 구현 전 `main` / `4e7b483`를 읽기 전용으로 조사했다. 그 뒤 당시 요청에서 허용한 범위의 계측·개인정보 선택·성능 개선을 반영했다. 기존 `content/launch-2026-10-14/`는 사용자의 미추적 작업으로 남겼다. 구조 조사와 검증 설명은 당시 기록이며, 아래 저장소·배포 정보는 2026-10-15에 다시 확인했다.

| 영역 | 조사 당시 구성 / 책임 |
| --- | --- |
| 진입·이동 | `src/App.tsx`: 홈, 아카이브, 통합 검색, 연속 열람. 커뮤니티 화면은 lazy 분리. 해시 경로와 `/p/:code` 공개 주소 연결 |
| 홈 | `src/home`: 실제 게시글 피드, 사진·동문 소식·인기 회차, 배너. 기존 인기 회차는 연결된 공개 글 수이며 회차 조회수 통계가 아님 |
| 자료 | `archiveCatalog`, `cuePages`, `public/data`: 5,330회차/66,010쪽 공개 카탈로그, HF Dataset Viewer, 일부 검증된 캐시 이미지 |
| 열람 | `CuePageSurface`, readerPosition/Geometry, recentReadingHistory: 연속 스크롤, 페이지별 확대·회전, 이어 읽기·최근 5개 로컬 저장 |
| 연도 탐색 | `TimeRing`, timeRingRuntime, ringScene: 선택 연도와 동기화된 선택형 3D 보기. `ringVisitors`는 장면 요소이며 사용자 접속 기록이 아님 |
| 회원·커뮤니티 | `src/community`: Supabase Auth, checked RPC, 게시글·댓글·공감·스크랩·알림·신고·사진·비밀글·선택 프로필. 게시판 관리자는 기존 권한 유지 |
| 서버 경계 | `functions/p/[code].js`, `functions/share/[id].js`, `server/postShare.js`: 공유용 공개 메타데이터와 사진, 정규 주소. 비밀글 원문 노출 방지 |
| 이용 분석(신규) | `src/analytics`: 작은 facade와 지연 로딩 runtime, 명시적 이벤트·활성 시간, Web Vitals. `server/usageCollector.js`, `functions/api/usage*`: 같은 출처 수집·해당 브라우저 상세 기록 삭제 |
| 공개 안내 | `public/about`, `privacy`, `terms`: 독립 HTML. privacy의 별도 JS가 수집 거부·삭제·테스트 설정 제공 |
| 검증 | `scripts/*.test.mjs`, verify-data, check-performance: DB 격리 테스트, 탐색·열람·회원 로직·수집 검증, 원본 무결성·초기 용량 검사 |

## 저장소와 배포 (2026-10-15 확인, KST)

공개 GitHub 저장소 [NewTypeCola/VOKU-On](https://github.com/NewTypeCola/VOKU-On)의 `main` → Cloudflare Pages 프로젝트 `voku` → [voku.pages.dev](https://voku.pages.dev/). 이전 이름 `NewTypeCola/voku-video`의 비공개 저장소를 이름 변경 후 공개한 것이며, 별도의 비공개 배포 저장소를 사용하는 구조가 아니다. Cloudflare Git 연결 화면에는 이전 이름이 남아 있지만 같은 저장소를 가리키며, 이름 변경 후의 커밋도 수신하고 있다.

`main` 자동 배포가 활성화되어 있다. Cloudflare에서 Node 24.13.0으로 `npm ci && npm test && npm run check && npm run build`를 실행하고 `dist`를 배포한다. GitHub Actions 대신 Cloudflare 빌드에서 검증하며, 실행된 빌드 결과는 공개 커밋의 **Cloudflare Pages** check에서 확인할 수 있다.

확인 시점의 운영 배포는 [31ef4d0](https://github.com/NewTypeCola/VOKU-On/commit/31ef4d0c573f686523d90e7f9a5b86e3acdccfef), 배포 URL은 [be7fbc7b.voku.pages.dev](https://be7fbc7b.voku.pages.dev/)이다. 2026-10-15 09:59 KST 배포가 성공했고, 해당 빌드에서 테스트 176개가 통과했다. 이후 문서·스크린샷·라이선스 커밋은 `[CF-Pages-Skip]`으로 배포를 생략했다. 공개 `main`과 운영 배포의 커밋 SHA는 다르지만, 확인 시점의 앱 소스·빌드 설정에는 차이가 없다. 문서 전용 변경을 배포하지 않는 방식과 두 앱의 대응 버전은 [배포·검증 기록](https://github.com/NewTypeCola/VOKU-On-Operations/blob/main/docs/analytics-verification.md)에 정리했다.

기존 Pages 프로젝트 `voku-on` fallback 및 별도 `voku-ux-study`는 이 운영 배포 경로에 포함되지 않는다. Cloudflare Web Analytics가 비활성 상태였다는 기록은 2026-10-14 조사 당시의 관측이다.

Supabase `awvnzjdtdcdcjtfinuuy`를 계속 공유한다. `public.community_*` / `voku_private`는 회원 기능, `voku_ops`는 별도 운영자 계정, `voku_metrics`는 이용 분석을 담당한다. 서비스 역할 키를 프런트엔드에 넣지 않는다. 운영 통계 SQL·화면·보고서 기준의 소유 저장소는 [VOKU-On-Operations](https://github.com/NewTypeCola/VOKU-On-Operations)이다.

기존 기록 중 게시글 `view_count`와 `post_viewers`는 누적/마지막 조회일 중심이라 일별 과거 방문·회차 열람을 복원할 수 없다. 브라우저의 최근 열람·위치도 중앙 로그가 아니었다. 기존 콘텐츠·저장·운영 기록은 별도 참고 통계로 재사용하고 새 이벤트와 합산하지 않는다.

테스트/시연은 `https://voku.pages.dev/?usage_test=1`로 시작한다. 이 표시는 브라우저에 남으므로 `/privacy/` 설정에서 해제하거나 `?usage_test=0`으로 새 방문을 시작한다. 운영진으로 확인된 브라우저는 서버에서 별도로 제외한다. 로컬 개발에서는 원격 분석을 전송하지 않는다. 운영자 앱의 `?preview=1`은 예시만 표시한다.

수집 단위·제외·보관·외부 제출 기준은 [VOKU-On-Operations의 분석 기준](https://github.com/NewTypeCola/VOKU-On-Operations/blob/main/docs/analytics.md)을 따른다. 원시 90일, 식별값 180일, 식별값 없는 집계·보고서 5년. 브라우저 수를 사람 수로 주장하지 않는다. 기록이 없는 과거 이용을 재구성하지 않는다.
