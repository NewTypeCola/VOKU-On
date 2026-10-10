# VOKU On — voku-video

HeroUI v3.2.6 · React 19 · Vite · Supabase 기반의 모바일 방송 아카이브·커뮤니티입니다. 데스크톱에서도 480px 너비를 유지하며 하단 내비게이션은 없습니다.

## 실행과 검사

Node.js **24.13.0**을 사용합니다 (`.node-version`). 테스트가 TypeScript 파일을 직접 읽으므로 같은 버전으로 로컬과 Pages 빌드를 맞춥니다.

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
```

개발 주소는 `http://127.0.0.1:5214/`입니다. 같은 Wi-Fi에서 확인하려면 `npm run dev -- --host 0.0.0.0`으로 실행하고 컴퓨터의 LAN 주소로 접속합니다. `npm run preview`는 개발 서버와 같은 포트를 쓰므로 동시에 실행하지 않습니다. 정적 빌드는 `dist/`에 생성됩니다.

## 화면

- 큐시트 찾기 / 홈 / 커뮤니티 순서의 상단 탭. 기본 진입은 홈.
- 큐시트: 시간의 고리, 전체 연도 → 학기 → 프로그램 → 회차, 현재 경로로 돌아가기.
- 열람: 전체 너비의 연속 세로 스크롤, 페이지 드롭다운, 현재 페이지 회전·핀치 확대, 회차 주소 공유, 읽던 쪽 이어 읽기. 회차 자체에는 댓글이 없습니다.
- 커뮤니티: 제목 중심 목록, 고정 공지와 공지 모아보기, 말머리, 최신·추천 정렬, 제목·내용·닉네임 검색, 20개씩 페이지 이동.
- 회원: 카카오 로그인, 첫 로그인 시 커뮤니티 닉네임 설정, 선택 항목인 학번·방송국 기수 변경. 누구나 가입 가능하며 운영자 승인은 없습니다. 기존 이메일 계정 로그인·비밀번호 재설정도 제공합니다.
- 글·댓글: 작성·수정·삭제, 답글, 임시 저장, 실제 큐시트 연결, 추천, 스크랩, 신고, 작성자 숨기기.
- 내 정보: 내 글·댓글·스크랩·신고 결과·숨긴 회원·계정 설정. 댓글·답글 알림.
- 운영 관리: 공지 고정·해제, 글 숨김·복원, 댓글 잠금·숨김, 신고 검토·처리 사유, 회원 이용 제한·해제, 운영진 지정·해제, 처리 기록.

글과 댓글의 수정·삭제는 작성자에게, 숨김과 공지·제재는 운영진에게, 운영진 권한 변경은 관리자에게만 허용됩니다. 이 규칙은 UI 외에 PostgreSQL 함수와 RLS에서도 검사합니다.

## 현재 연결 상태

**2026-10-10: Supabase Free의 `voku-on` 프로젝트(서울)와 [Cloudflare Pages 배포](https://voku.pages.dev/)를 연결했습니다.** 회원·게시글·신고 DB, 권한 검사, 학번·기수와 카카오 온보딩 migration 6개를 적용했습니다. `.env.local`은 Git에서 제외되며 브라우저에는 공개용 publishable key만 사용합니다.

배포 사이트에서 실제 카카오 로그인·닉네임 설정·세션 유지·본인 프로필 사진 표시를 확인했습니다. 별도로 생성한 확인 완료 이메일 계정 하나만 최초 관리자로 지정하고 감사 기록을 남겼습니다. 기존 카카오 회원은 일반회원으로 유지합니다. 관리자 RPC 허용과 일반회원 차단은 서버에서 확인했으며, 별도 관리자의 비밀번호를 이용한 브라우저 로그인은 사용자 확인이 남아 있습니다.

일반 이메일 회원가입 화면은 `VITE_EMAIL_SIGNUP_ENABLED=false`로 숨긴 상태이며, SMTP 연결 작업은 보류했습니다. 카카오 로그인에는 SMTP가 필요하지 않습니다. 이메일 확인을 끄거나 익명 계정을 허용하지 않았습니다. Cloudflare Pages의 `voku` 프로젝트를 GitHub `NewTypeCola/voku-video`의 `main` 브랜치에 연결했습니다. 푸시하면 아래 검사와 빌드를 거쳐 자동 배포됩니다.

환경 설정이 없는 복사본에서만 화면 체험 모드로 동작합니다. 체험 모드 로그인 화면의 일반 회원/운영자 계정은 실제 계정이 아니며 예시 글도 실제 동문 활동을 나타내지 않습니다.

- 체험 커뮤니티: `localStorage`의 `voku-community-preview-v1`. 역할은 해당 탭의 `sessionStorage`에 저장됩니다.
- 임시 글: 모드·회원·게시글별 별도 키. 계정을 바꿔도 서로의 임시 글을 가져오지 않습니다.
- 기존 큐시트 스크랩·열람 진도: 기존 `voku-on14-v1` 유지. 종전 작성 글은 체험 자료로 복사하며 원본 저장값은 삭제하지 않습니다.
- 실제 서버 연결 후 예시 글이나 체험 데이터가 서버로 자동 업로드되지 않습니다.

## GitHub 자동 배포와 운영 주소

운영 주소는 **https://voku.pages.dev/**입니다. Cloudflare Pages의 `voku` 프로젝트에서 다음 설정을 사용합니다.

| 항목 | 값 |
| --- | --- |
| 저장소 / 운영 브랜치 | `NewTypeCola/voku-video` / `main` |
| 루트 폴더 | 저장소 루트 (빈 값) |
| 빌드 명령 | `npm ci && npm test && npm run check && npm run build` |
| 출력 폴더 | `dist` |
| `NODE_VERSION` | `24.13.0` (`.node-version`과 동일) |
| `SKIP_DEPENDENCY_INSTALL` | `1` (빌드 명령의 `npm ci`로 설치) |
| `VITE_SUPABASE_URL` | `https://awvnzjdtdcdcjtfinuuy.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Pages 환경 변수에 저장한 공개용 publishable key |
| `VITE_KAKAO_LOGIN_ENABLED` | `true` |
| `VITE_EMAIL_SIGNUP_ENABLED` | `false` |

위 환경 변수는 빌드에 쓰이며 값을 바꾸면 재배포해야 합니다. DB migration은 정적 사이트 배포에서 자동 실행하지 않습니다. DB 변경이 있을 때만 별도로 검토하고 적용합니다.

- Supabase Site URL: `https://voku.pages.dev/`.
- Supabase Redirect URLs: `https://voku.pages.dev/`, `https://voku.pages.dev/?auth=recovery`와 개발용 주소. 임의의 미리보기 주소를 허용하는 와일드카드는 추가하지 않았습니다.
- 카카오 앱 대표 도메인: `https://voku.pages.dev`.
- 카카오 로그인 Redirect URI: `https://awvnzjdtdcdcjtfinuuy.supabase.co/auth/v1/callback`. 카카오가 Supabase로 돌아오는 주소이므로 웹앱 도메인 변경에도 동일합니다.
- 앱은 현재 접속한 origin을 로그인 복귀 주소로 사용합니다. 새 운영 주소에서 실제 카카오 로그인, 프로필 정보와 새로고침 후 세션 유지까지 확인했습니다.

기존 직접 업로드 프로젝트 `voku-on`과 그 주소는 복귀용으로 유지합니다. 그 프로젝트는 새 GitHub 푸시로 갱신되지 않습니다. 운영에는 `voku.pages.dev`를 사용합니다. 일반 이메일 가입과 SMTP 연결은 계속 보류 상태입니다.

## 무료 서버 선택

2026-10-10 공식 요금표 기준 Supabase Free를 선택했습니다. PostgreSQL의 관계형 데이터와 서버 권한 검사가 공지·신고·회원 제재에 잘 맞습니다. Firebase Spark도 비교했으나 이 구조에서는 Supabase가 간단합니다.

- [Supabase Free](https://supabase.com/pricing): 월 $0, DB 500MB, 월 활성 사용자 50,000명, 파일 저장 1GB, egress 5GB, 활성 프로젝트 2개. 비활성 프로젝트 일시 중지와 무료 한도가 적용됩니다. 유료 전환은 자동으로 진행하지 않습니다.
- [Firebase 요금표](https://firebase.google.com/pricing): Spark 무료 플랜 비교 출처.
- 큐시트 이미지는 기존 Hugging Face 공개 자료를 읽으므로 Supabase Storage로 복사하지 않습니다.

### 실제 연결 순서

1. 본인 Supabase 조직에 Free 프로젝트를 생성합니다. 한국 사용자를 위해 서울 리전을 권장합니다.
2. `supabase/migrations/`의 SQL 파일들을 파일명 순서대로 SQL Editor 또는 Supabase migration 도구로 **한 번씩** 적용합니다. 이미 데이터가 있는 DB에 임의로 초기화하지 않습니다.
3. `.env.example`을 `.env.local`로 복사하고 프로젝트 URL과 **publishable key**를 채웁니다. `service_role`, DB 비밀번호, SMTP 비밀번호를 `VITE_` 변수에 넣지 않습니다. 환경 파일은 Git에서 제외합니다.
4. Auth URL Configuration에 실제 앱 주소와 사용 중인 로컬 주소를 등록합니다. Site URL은 배포 주소, Redirect URLs는 `http://127.0.0.1:5214/`, `http://localhost:5214/`, 실제 LAN 주소와 배포 주소를 각각 등록합니다. 재설정에 쓰는 같은 주소의 `?auth=recovery`도 허용합니다. 외부 운영 주소에는 HTTPS를 사용합니다.
5. 카카오 로그인은 아래 설정을 적용하고 `VITE_KAKAO_LOGIN_ENABLED=true`로 빌드합니다. 이메일 provider와 이메일 확인은 기존 관리자 계정용으로 유지하며 비밀번호 최소 길이는 10자입니다. 일반 이메일 회원가입 화면은 `VITE_EMAIL_SIGNUP_ENABLED=false`를 유지합니다.
6. 개발 서버를 재시작합니다. `.env.local` 값은 빌드 시 포함되므로 배포도 다시 빌드합니다.
7. 별도 관리자는 Supabase Authentication → Users → Add user → Create a new user에서 본인이 이메일·새 비밀번호를 입력해 생성합니다. 닉네임 metadata가 없는 계정은 임시 닉네임과 미완료 일반회원 상태로 생성됩니다. 비밀번호를 코드·채팅·환경 파일에 남기지 않습니다.
8. 사용자가 지정한 정확한 확인 완료 이메일 계정만 서버에서 최초 관리자로 설정합니다. 아래 두 값을 실제 계정으로 바꾸고 검토 후 한 번 실행합니다. 첫 가입자나 이메일 문자열만을 근거로 자동 승격하는 트리거는 없습니다.

```sql
begin;
do $$
declare
  target_id uuid := 'REPLACE_WITH_VERIFIED_USER_UUID';
  target_email text := 'REPLACE_WITH_VERIFIED_USER_EMAIL';
begin
  if not exists (
    select 1 from auth.users u
    join voku_private.members m on m.id = u.id
    where u.id = target_id and lower(u.email) = lower(target_email)
      and u.email_confirmed_at is not null and m.role = 'member'
      and exists (select 1 from auth.identities i
                  where i.user_id = u.id and i.provider = 'email')
  ) then raise exception 'Verified separate administrator account did not match'; end if;
  update public.community_profiles set nickname = 'VOKU운영자' where id = target_id;
  update voku_private.members set role = 'admin', profile_complete = true where id = target_id;
  insert into voku_private.audit(actor_id, action, target, reason)
  values(target_id, 'set_role', target_id::text, '운영자가 지정한 별도 최초 관리자');
end $$;
commit;
```

앱의 로그인 화면 → **기존 이메일 계정으로 로그인**에서 관리자 이메일과 본인이 만든 비밀번호로 로그인합니다. 전체 메뉴 → 운영 관리 또는 `#/admin`으로 진입합니다. 관리자는 운영 관리에서 일반 회원에게 `moderator` 권한을 부여할 수 있습니다. 운영진은 관리자나 다른 운영진의 권한을 변경할 수 없습니다.

### 카카오 로그인 설정

- 카카오 앱의 로그인 기능을 켜고 REST API 키에 `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`을 Redirect URI로 등록합니다. 카카오에서 돌아오는 주소와 앱 자체의 Auth Redirect URL은 서로 다릅니다.
- 카카오의 `profile_nickname`, `profile_image`를 **선택 동의**로 설정합니다. 이메일, 친구 목록, 전화번호는 요청하지 않습니다. 사용자가 사진을 제공하지 않아도 가입할 수 있습니다.
- Supabase Auth의 Kakao provider에 REST API 키와 **카카오 로그인용 Client Secret**을 저장하고 이메일 없이 가입 허용을 켭니다. Client Secret은 Supabase 서버 설정에만 저장하고 프런트엔드·GitHub에 넣지 않습니다.
- 클라이언트의 `queryParams: { scope: "profile_nickname,profile_image" }`는 Supabase Kakao provider가 기본으로 요청하는 이메일 scope를 덮어씁니다. 현재 서버 구현에서 `options.scopes`는 기본 scope에 추가되므로 이메일 권한이 없는 앱에서 `KOE205`가 발생합니다. 이 동작은 실제 로그인으로 확인했습니다. [Supabase Kakao provider 소스](https://github.com/supabase/auth/blob/master/internal/api/provider/kakao.go).
- 카카오 표시 이름을 커뮤니티 닉네임으로 자동 공개하지 않습니다. 첫 로그인 후 본인이 닉네임을 정해야 글·댓글 등 회원 동작을 사용할 수 있습니다. 카카오 사진은 본인 계정 화면에서만 표시하며 공개 프로필 테이블로 복사하지 않습니다.
- 권한은 `auth.identities`의 실제 카카오 identity 또는 확인 완료 이메일과 비공개 회원 테이블을 검사합니다. 사용자가 수정할 수 있는 `user_metadata`의 provider·역할·온보딩 값은 인증 근거로 사용하지 않습니다.
- 로그인 버튼은 [카카오 공식 리소스](https://developers.kakao.com/tool/images/resource/preview/login-complete-ko.svg)를 사용합니다. 사진 URL은 카카오 CDN 호스트만 허용하며 HTTPS로 표시합니다.

### 인증 메일

[Supabase 기본 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)는 프로젝트 운영팀 이메일로만 보낼 수 있습니다. 기본 SMTP만으로 불특정 사용자의 이메일 가입을 운영할 수는 없습니다. 현재 일반 가입은 카카오로 진행하며 SMTP 설정은 사용자의 요청으로 보류했습니다. 이를 피하려고 이메일 확인을 끄지 않습니다.

무료 발송 후보는 [Brevo Free](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)의 하루 300통입니다. 본인 계정과 발신자 확인을 마친 뒤 Supabase의 Auth → SMTP에 연결합니다. SMTP 비밀 값은 Supabase 설정에서만 입력합니다. 발신 도메인·인증 설정과 공급자 정책은 실제 계정에서 확인해야 합니다. 무료 발송 한도를 넘으면 가입·비밀번호 재설정 메일이 지연될 수 있습니다.

## 데이터와 보안 구조

- `src/community/client.ts`: Supabase 연결과 RPC 경계, 서버가 없을 때만 체험 모드.
- `src/community/useCommunity.ts`: 세션, 회원 상태, 알림·활동 갱신.
- `src/community/Community.tsx`: 회원·게시판·운영 화면.
- `src/community/KakaoAuth.tsx`, `oauth.ts`: 카카오 로그인·닉네임 설정, 복귀 주소와 사진 URL 검증.
- `src/community/preview.ts`: 명시적으로 구분된 로컬 체험 데이터.
- `supabase/migrations/`: RLS, 서버 검증 함수, 권한 비공개 스키마, 감사 기록, 학번·기수, 전체 운영 집계, 카카오·별도 이메일 계정 온보딩.
- `scripts/community.test.mjs`: PGlite에서 실제 migration을 실행하는 권한·신고·제재·페이지 이동 테스트. 운영 DB에 검증 데이터를 넣지 않습니다.

학번은 전체 학생번호가 아닌 **입학년도**입니다. `18`과 `2018`을 모두 입력할 수 있고 DB에는 `2018`로 저장합니다. 기수 제안식은 `93 + (입학년도 - 2018) × 2 + (학기 - 1)`입니다. 따라서 2018년 1학기 입국은 93기, 2학기는 94기입니다. 입학년도와 실제 입국 시기가 다를 수 있어 기수는 별도로 직접 수정할 수 있으며, 두 항목 모두 선택입니다. 학번·기수는 비공개 회원 테이블에 두고 본인 정보와 운영진 회원 목록에서만 제공합니다.

공개 프로필에는 이메일을 포함하지 않습니다. 신고와 스크랩은 본인에게만, 전체 신고와 처리 기록은 운영진에게만 노출합니다. 회원 역할과 제재 상태는 브라우저에서 수정할 수 없는 비공개 스키마에 둡니다. 글 30초·댓글 5초·신고 10초의 서버 작성 간격 제한을 적용합니다. 비밀번호는 Supabase Auth로만 전달하며 앱의 체험 저장소에 저장하지 않습니다.

내 글·댓글 및 운영 관리의 각 목록은 최근 100건, 알림은 최근 50건을 표시합니다. 운영 관리의 글·회원 검색은 서버 전체에서 검색하며 회원 검색에는 학번·기수도 포함됩니다. 운영실 상단 집계는 검색·100건 표시 제한과 무관하게 전체 데이터를 셉니다. 알림은 앱 내 알림이며 푸시·메일 알림은 아닙니다. 이미지 업로드, 쪽지, 실시간 채팅, 회원 탈퇴 UI는 이번 구현 범위에 포함하지 않습니다.

## 실제 아카이브 자료

출처: [VOKU Archive on Hugging Face](https://huggingface.co/datasets/NewTypeCola/VOKU-Archive).

- 리비전 `946efb631be114cbbc410fa4bceeed4df0559010`.
- 1988–2019년 5,330문서, 66,010쪽의 카탈로그.
- 실제 문서 7개, 71쪽의 Viewer JPEG 캐시. 문서 순서·개수·이미지 해시는 `npm run check`로 확인합니다.
- 나머지 문서는 공개 Viewer API로 읽고 문서 ID·쪽 번호·개수를 검사합니다. 오류 시 재시도 화면을 제공합니다.
- OCR 열람·검색·내보내기는 없습니다. `/rows`에 OCR 필드가 포함되어도 이미지 관련 값만 사용하며 OCR은 렌더링하거나 캐시하지 않습니다.
- 원고의 제3자 권리와 CC BY 4.0 범위는 [원본 권리 고지](public/licenses/VOKU-Archive-rights.md), SUIT 폰트는 [OFL 고지](public/fonts/OFL.txt)를 따릅니다. 원본 이미지는 수정하지 않았습니다.

## 참고와 검증 경계

한국 커뮤니티의 제목 중심 목록·공지·말머리·댓글 흐름과 [그누보드 운영 관리 구조](https://github.com/gnuboard/gnuboard5/tree/master/adm)를 참고했습니다. 다른 서비스의 글·로고·사용자 정보는 가져오지 않았습니다. 아카라이브의 공지 페이지는 이 작업에서 직접 열리지 않아 관리자 동작을 검증한 출처로 사용하지 않았습니다.

HeroUI v3 MCP에서 quick start, component list, 실제 component docs를 확인했습니다. [HeroUI 문서](https://heroui.com/docs/react/getting-started/quick-start).

자동 검사 39개(학번·기수, 가입 트리거, 권한·신고·제재·전체 집계, 카카오 identity·온보딩·사진 URL·복귀 주소, 닉네임 없는 별도 이메일 계정, 기존 큐시트 회전·확대)가 통과했습니다. `npm run check`와 `npm run build`도 통과했습니다. 기존 체험 화면에서는 글·댓글 작성과 편집, 큐시트 연결·복귀, 신고·운영 처리, 회원 제한을 브라우저로 확인했습니다.

배포 사이트에서는 실제 카카오 가입·재로그인과 본인 프로필 사진 로딩을 확인했습니다. 390×844 브라우저에서 가로 넘침이 없음을 확인했으며, 물리 모바일 기기 시험과는 구분합니다. 최초 관리자·기존 일반회원의 운영 관리 접근 허용/거부는 실제 DB의 `authenticated` 역할로 확인했습니다. 관리자 비밀번호 로그인, 일반 사용자용 SMTP 발송, 실회원 게시글 작성은 이 검증에 포함하지 않습니다. 운영 DB에 테스트 글을 게시하지 않았습니다.

Supabase Security Advisor는 의도적으로 공개한 읽기 RPC 2개와 로그인 후 호출하는 RPC 5개의 `SECURITY DEFINER` 실행 경고를 반환합니다. 이는 각 RPC 내부의 소유자·역할·제재 검사와 비공개 스키마 차단으로 통제하며, 불필요하게 노출된 자동 RLS 트리거 함수의 실행 권한은 회수했습니다. 관련 규칙: [비로그인 함수 실행 경고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [로그인 함수 실행 경고](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Free 플랜에서는 유출 비밀번호 차단이 제공되지 않아 해당 Auth Advisor 경고가 남습니다. 유료 전환은 진행하지 않았습니다. [Supabase 비밀번호 보호 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

코드 검사, 체험 모드 QA, 실제 카카오 인증, 서버 권한 검증, 외부 배포를 서로 구분합니다. 현재 공개 주소는 Cloudflare Pages이며 로컬 Wi-Fi 주소는 같은 네트워크에서만 사용할 수 있습니다. 이메일 발송·별도 관리자 로그인·추가 운영 정책까지 검증했다는 의미는 아닙니다.
