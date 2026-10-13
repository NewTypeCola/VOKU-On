# 계정 스크랩·게시판 관리 폴리싱 검증

2026-10-13. 웹앱 범위에서 큐시트 저장, 가입 안내, 답글 취소 복귀, 게시판 관리 확인·복구·이력·페이지 탐색을 개선했다. 개인 메뉴·설정과 터치 영역 변경, 별도 운영자 대시보드는 제외했다.

## 저장 방식과 복귀

- 큐시트는 회원 계정에 저장한다. 비회원이 큐시트·게시글 저장을 누르면 설명과 `계속 읽기` / `로그인 / 회원가입`을 보여준다. 로그인 선택 전에는 현재 화면을 유지한다.
- 이전 브라우저 스크랩은 자동 귀속시키지 않는다. 로그인한 회원이 대상 계정을 확인하고 이전하며 중복 저장을 제거한다. API 실패 시 이전 목록을 남긴다.
- 열람 진도·글과 댓글 초안의 기기 저장 방식은 유지한다.
- 로그인·가입·첫 프로필 설정에서 공개된 개인정보처리방침·이용약관·문의 링크를 제공한다.
- 답글 또는 댓글 수정 취소 시 원댓글로 스크롤·키보드 포커스를 돌려준다.

## 게시판 관리

- 확인창에 대상 글 제목·작성자·댓글 본문을 표시한다.
- `숨긴 댓글`에서 내용을 확인하고 사유를 남겨 다시 공개한다. 삭제한 댓글·삭제한 글의 댓글은 복구하지 않는다. 숨긴 원글의 공개 상태를 바꾸지 않는다.
- 처리 기록에 글 제목·원댓글 링크·내용 일부를 제공한다.
- 글·공지·숨긴 댓글·신고·이력을 DB에서 필터링한 뒤 20개씩 페이지로 제공한다. 기존 최신 100건 제한 때문에 오래된 공지·기록을 놓치던 문제를 해소했다.

## 검증 결과

- `npm test`: 143개 통과. 새 사례는 회원별 스크랩 분리·중복 이전·해제·비회원 및 불완전/제한 계정 거부, 105건 이상 관리자 페이지의 경계, moderator의 숨긴 댓글 복구와 삭제된 내용 복구 금지를 다룬다.
- `npm run check`, `npm run build`, `npm run check:performance`: 통과. 문서 5,330건 / 원본 66,010쪽과 보존 이미지 해시 유지.
- 격리된 로컬 체험 모드에서 390px 비회원 안내 → 명시적 로그인 선택 → 읽던 큐시트 복귀 → 저장 → 목록·새로고침 유지 확인. 기존 브라우저 목록 이전과 계정 전환 시 목록 분리 확인.
- 댓글 26개인 로컬 글의 첫 댓글 답글 취소: 원댓글 포커스와 화면 중앙 복귀 확인.
- 320px·390px에서 가로 넘침 없음. 관리 대상 확인창, 숨긴 댓글 목록·복구, 처리 이력에서 원댓글로 이동 확인. 브라우저 오류 로그 없음. 실제 휴대폰 키보드/OS 검증과는 구분한다.

## 운영 DB

- CLI 생성 파일: `supabase/migrations/20261013065137_account_archive_and_board_polish.sql`.
- 운영 적용 기록: `20261013071250_account_archive_and_board_polish` (`awvnzjdtdcdcjtfinuuy`).
- 운영 DB에서 인증 역할로 계정 목록·중복 저장·해제와 관리자 4개 목록 RPC를 확인하고 트랜잭션을 롤백했다. 검증용 스크랩 잔여 0건.
- 비회원 저장 RPC 실행 및 회원의 직접 테이블 조회 불가. 신규 공개 RPC는 security invoker이며, 비공개 구현이 인증 정보로 소유자와 게시판 권한을 확인한다.
- 기존 `community_action`, `community_admin`, `voku_ops` 함수 정의 해시가 적용 전후 동일하다. 계정 요약은 기존 구현을 보존하고 스크랩 필드만 추가했다.
- 보안 Advisor 신규 WARN 없음. 기존 공개 읽기 RPC의 [definer 권고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), 회원 RPC의 [definer 권고](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [유출 비밀번호 보호 비활성](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)은 별도 기존 항목이다. `community_account`는 이번에 공개 invoker로 전환되어 해당 WARN 1건 감소.
- 새 비공개 스크랩 테이블의 [RLS 정책 없음 INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)는 직접 접근을 전부 막고 권한 검사 RPC로만 읽고 쓰는 의도된 구성이다. FK는 사용자 ID로 시작하는 기본키 인덱스를 사용한다.

운영 배포는 이 검증본을 포함한 GitHub main 커밋의 Cloudflare Pages 검사·배포 결과를 확인한 후 완료로 보고한다.
