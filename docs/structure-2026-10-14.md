# 구조 조사와 이용 분석 연결

2026-10-14 구현 전 `main` / `4e7b483`를 읽기 전용으로 조사했다. 그 뒤 이번 요청에서 허용한 범위의 계측·개인정보 선택·성능 개선을 반영했다. 기존 `content/launch-2026-10-14/`는 사용자의 미추적 작업으로 남겼다.

| 영역 | 현재 구성 / 책임 |
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

GitHub private `NewTypeCola/voku-video`의 main → Cloudflare Pages 프로젝트 `voku` → `https://voku.pages.dev`. Node 24.13.0, build `npm ci && npm test && npm run check && npm run build`, dist. 기존 `voku-on` fallback 및 별도 `voku-ux-study`는 이번 배포 대상이 아니다. 조사 시 Cloudflare Web Analytics는 활성화되어 있지 않았다.

Supabase `awvnzjdtdcdcjtfinuuy`를 계속 공유한다. `public.community_*` / `voku_private`는 회원 기능, `voku_ops`는 별도 운영자 계정, `voku_metrics`는 이용 분석을 담당한다. 서비스 역할 키를 프런트엔드에 넣지 않는다. 운영 통계 SQL·화면·보고서 기준의 소유 저장소는 `voku-operates`이다.

기존 기록 중 게시글 `view_count`와 `post_viewers`는 누적/마지막 조회일 중심이라 일별 과거 방문·회차 열람을 복원할 수 없다. 브라우저의 최근 열람·위치도 중앙 로그가 아니었다. 기존 콘텐츠·저장·운영 기록은 별도 참고 통계로 재사용하고 새 이벤트와 합산하지 않는다.

테스트/시연은 `https://voku.pages.dev/?usage_test=1`로 시작한다. 이 표시는 브라우저에 남으므로 `/privacy/` 설정에서 해제하거나 `?usage_test=0`으로 새 방문을 시작한다. 운영진으로 확인된 브라우저는 서버에서 별도로 제외한다. 로컬 개발에서는 원격 분석을 전송하지 않는다. 운영자 앱의 `?preview=1`은 예시만 표시한다.

수집 단위·제외·보관·외부 제출 기준은 `voku-operates/docs/analytics.md`를 따른다. 원시 90일, 식별값 180일, 식별값 없는 집계·보고서 5년. 브라우저 수를 사람 수로 주장하지 않는다. 기록이 없는 과거 이용을 재구성하지 않는다.
