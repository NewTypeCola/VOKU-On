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

## 앱 아이콘

2026-10-10 선택한 **VO / KU 두 줄 타이포 + 마이크(2번)** 이미지를 공통 앱 아이콘으로 사용합니다. 원본은 `assets/branding/voku-on-microphone-source.png`에 보존하고, 시안을 재생성하거나 자르지 않고 크기만 변환했습니다.

- 브라우저 탭: `public/favicon.ico`, `public/icons/voku-on-32.png`, `voku-on-64.png`.
- iOS 홈 화면: `public/icons/voku-on-180.png`와 기본 탐색 경로 `public/apple-touch-icon.png`.
- 웹앱 아이콘: `public/site.webmanifest`에서 192px / 512px PNG를 연결합니다. 실행 방식은 기존처럼 브라우저를 유지합니다.
- 카카오 Developers 업로드용: `public/icons/voku-on-128.png` (권장 128px, 250KB 미만).

아이콘 연결 형식은 [Apple 홈 화면 아이콘 안내](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)와 [웹 앱 manifest icons 문서](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)를 따릅니다.

## 웹 로고와 열람 성능

- 헤더·푸터는 좌우 반전한 마이크 + VOKU 이미지 로고를 공유합니다. 원본은 `assets/branding/voku-wordmark-source.png`, 생성 프롬프트는 `assets/branding/wordmark-generation.json`, 최적화한 투명 WebP는 `public/brand/voku-logo.webp`에 있습니다. 헤더 폭은 102px, 푸터는 98px이며 클릭 영역은 44px 이상 유지합니다. 로고에만 우클릭·드래그·이미지 길게 누르기를 억제하며 큐시트 이미지의 기본 저장 메뉴는 유지합니다.
- 공통 푸터는 로고와 안내 링크를 한 줄로 표시합니다. 원고의 회차 정보와 다른 회차 버튼은 흰 배경, 푸터는 연한 녹색 배경으로 구분합니다. 자료 출처·권리 링크는 안내 창 안에 유지합니다.
- 원격 회차는 [Hugging Face Viewer `/rows`](https://huggingface.co/docs/dataset-viewer/rows)에서 첫 페이지 정보를 먼저 표시한 뒤 나머지를 순서대로 추가합니다. 이미지도 첫 장을 우선하고 다음 장을 차례로 준비하며, 빠른 스크롤·페이지 이동 시 현재 쪽을 먼저 요청합니다. 중간 실패 시 이미 받은 페이지는 유지하고, 취소된 요청은 화면에 반영하지 않습니다. 서명된 이미지 주소의 메모리 캐시는 5분·30회차로 제한합니다.
- 타임링 3D 모듈은 첫 화면 표시 후 미리 준비합니다. 한번 만든 GPU 장면은 화면을 나가면 정지하고 재진입 시 재사용하며, 2분간 사용하지 않으면 해제합니다. WebGL 사용 불가 시 연도 화살표와 목록을 이용할 수 있습니다.

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

내 글·댓글·알림은 20건씩 페이지를 이동해 이전 기록까지 조회합니다. 운영 관리 목록은 최근 100건을 표시합니다. 운영 관리의 글·회원 검색은 서버 전체에서 검색하며 회원 검색에는 학번·기수도 포함됩니다. 운영실 상단 집계는 검색·100건 표시 제한과 무관하게 전체 데이터를 셉니다. 알림은 앱 내 알림이며 푸시·메일 알림은 아닙니다. 쪽지, 실시간 채팅, 회원 탈퇴 UI는 아직 포함하지 않습니다.

## 커뮤니티 1차 개선 (2026-10-11)

기존 React·Supabase와 회원·게시글 데이터를 유지합니다.

- 알림을 열면 해당 알림만 읽음으로 바뀝니다. `모두 읽음`은 모든 페이지의 본인 알림에 적용됩니다. 미확인 수는 최근 50건의 요약과 별도로 전체에서 계산합니다.
- 알림 화면 진입, 창·탭 복귀, 네트워크 재연결 때 최신 내용을 조회합니다. 포커스와 표시 이벤트는 250ms 동안 합쳐 중복 요청을 줄이며, 백그라운드 주기 조회는 하지 않습니다. 일시적인 조회 실패가 기존 로그인 화면을 지우지 않습니다.
- 게시글의 상단 뒤로 가기와 `목록으로`, 브라우저 뒤로 가기는 출발한 게시판·내 활동·알림의 조건과 위치로 복귀합니다. 게시판의 말머리·검색어·정렬·페이지, 내 활동의 탭·페이지를 주소에 보존하고, 비동기 목록이 렌더링된 뒤 스크롤을 복원합니다. 스크롤 위치는 현재 앱 실행 중에 보존합니다.
- 글쓰기 말머리와 게시판 필터가 같은 정의를 사용합니다. `추억`, `음악` 필터를 추가했으며 기존 `일상` 데이터는 계속 `자유글`로 표시합니다. `자료 이야기`와 `공지`는 기존 연결 자료·고정 여부 필터입니다.
- `community_activity`는 본인 글·댓글·알림을 20건씩 조회하고, 같은 작성 시각에도 ID로 순서를 고정합니다. 숨김·삭제 글과 그 글의 댓글은 내 활동에서 제외합니다. `community_account`의 기존 요약 응답은 이전 클라이언트와의 호환을 위해 유지합니다.

`supabase/migrations/20261011025703_community_activity.sql`을 운영 Supabase 프로젝트 `awvnzjdtdcdcjtfinuuy`에 적용했습니다. 서버 마이그레이션 기록은 `20261011031725_community_activity`입니다. 신규 함수는 인증 사용자만 실행할 수 있고, 데이터 소유자는 요청 인자가 아닌 `auth.uid()`로 확인합니다. 웹앱은 GitHub `main` 푸시 후 Cloudflare Pages의 `voku` 프로젝트에서 자동 배포합니다.

검증: 배포할 커밋의 파일만 추출한 환경에서 `npm run check`, `npm test`(59개), `npm run build`, `npm run check:performance` 통과. PGlite에서 실제 마이그레이션을 실행해 105개 글·댓글, 55개 알림의 전체 조회와 안정적인 페이지 경계, 개별·전체 읽음, 타인·비로그인 접근 차단을 확인했습니다. 로컬 체험 브라우저에서 검색한 게시판 2페이지 복귀(스크롤 860px), 내 글·댓글 6페이지, 알림 3페이지 개별 읽음·전체 읽음과 배지 갱신을 확인했습니다. 기존 게시글 → 연결 큐시트 → 게시글 → 자료 이야기 목록 흐름도 확인했습니다. 320px·390px·1280px 화면의 가로 넘침과 콘솔 오류가 없었습니다. 물리 모바일 기기 검증은 아닙니다.

운영 DB에서도 기존 회원의 `authenticated` 역할로 계정 요약과 내 글·댓글·알림 조회 응답을 검사했습니다. 개별 읽음은 존재하지 않는 ID로 호출해 쓰기 권한 경계만 확인했고, 비로그인 호출은 차단되었습니다. 적용 전후 회원 2명·글 1개·댓글 0개·알림 0개를 유지했으며 검증용 글이나 알림은 운영 DB에 추가하지 않았습니다.

## 커뮤니티 2차 개선 (2026-10-11)

기존 React·Supabase, 카카오 로그인, 게시판 주소와 큐시트 연결을 유지하며 글쓰기·공유 경험을 확장합니다.

- **사진:** 글당 최대 6장, 추가·제거·순서 변경, 첫 사진을 대표 이미지로 사용합니다. JPG·PNG·WebP 원본은 한 장당 15MiB까지 선택하고, 브라우저에서 긴 쪽 2,400px·2MiB 이하의 JPEG 사본으로 변환합니다. 원본 파일은 바꾸지 않으며 메타데이터는 업로드 사본에 복사하지 않습니다. 첨부 사진은 본문에서 연속으로 읽고 전체 화면에서 이동·확대할 수 있습니다.
- **편집기:** 굵게·목록·http/https 링크 버튼과 미리보기. 제한된 Markdown만 React 요소로 표시하며 사용자 HTML은 실행하지 않습니다. 기존 글은 `plain` 형식을 유지합니다. 텍스트 임시 저장은 계속 지원하고, 등록 전 새 사진은 화면을 떠나면 다시 선택해야 함을 안내합니다.
- **공유:** 공개 글의 공유 버튼에서 `/share/<글 ID>` 주소를 복사하거나 기기의 공유 창을 엽니다. Cloudflare Pages Function이 제목·설명·대표 사진의 Open Graph HTML을 반환하고, 방문자는 기존 `/#/post/<글 ID>`로 이동합니다. 사진이 없으면 VOKU 아이콘을 사용합니다. 해시 주소를 그대로 복사하는 경우에는 글별 미리보기가 적용되지 않습니다.
- **조회수:** 실제 게시글 열람을 서버에서 집계합니다. 한국 시간 날짜 기준으로 같은 회원 또는 비로그인 브라우저는 하루 1회이며, 로그인한 작성자 자신의 조회와 공유 페이지 수집 요청은 세지 않습니다. 브라우저 식별자를 지우거나 로그인 상태가 바뀌면 별도 방문으로 집계될 수 있어 고유 방문자 통계와는 다릅니다. IP 주소는 저장하지 않습니다.

### 사진 권한과 파일 수명

`community-photos`는 비공개 Storage 버킷입니다. 완료된 회원만 본인에게 예약된 경로에 업로드할 수 있고, 덮어쓰기를 허용하지 않습니다. DB는 저장할 때 실제 업로드, 소유자, JPEG 형식, 용량, 6장 제한을 다시 검사하며 글·서식·사진 순서를 한 트랜잭션으로 저장합니다. 업로드나 글 저장에 실패하면 새 파일만 정리하고 기존 첨부는 유지합니다. 수정에서 빠진 사진은 저장 성공 후 Storage API로 제거합니다.

공개된 글의 사진, 본인 사진, 운영진이 열람하는 첨부만 읽을 수 있습니다. 숨김·삭제한 글의 사진에는 새로운 공개 서명 URL을 발급하지 않습니다. 이미 발급한 URL은 최대 5분까지 유효하며 외부 서비스가 이미 저장한 공유 미리보기는 즉시 회수할 수 없습니다. [Supabase 비공개 버킷](https://supabase.com/docs/guides/storage/buckets/fundamentals), [카카오 공유 메타정보 관리](https://developers.kakao.com/docs/ko/tool/common).

회원당 미완료 사진은 최대 12개로 제한합니다. 중단된 업로드가 24시간 지나면 해당 회원의 다음 업로드 때 정리합니다. 회원이 돌아오지 않는 경우 미완료 파일은 비공개로 남으므로 운영자가 Storage 사용량을 확인할 수 있습니다. 체험 사진은 해당 브라우저의 IndexedDB에만 저장됩니다.

### 배포와 검증

`supabase/migrations/20261011033919_community_publishing.sql`을 운영 Supabase 프로젝트 `awvnzjdtdcdcjtfinuuy`에 적용했습니다. 서버 기록은 `20261011035905_community_publishing`입니다. 기존 글은 변경 없이 텍스트 형식과 조회수 0으로 시작합니다. GitHub `main` 푸시 후 Cloudflare Pages는 루트 `functions/share/[id].js`를 함께 배포하며, `public/_routes.json`은 `/share/*`에만 함수를 적용합니다. 기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` 환경 변수를 함수에서도 사용하고 비밀 키는 필요하지 않습니다.

자동 검사 71개에는 실제 마이그레이션을 실행하는 PGlite 권한 검사, 미완료 업로드 제한, 타인 사진·미업로드·중복 첨부 차단, 사진 순서·제거, 숨김·삭제 사진 비공개, 조회수 중복 제외, 공유 HTML의 콘텐츠 이스케이프와 이미지 전달 검사가 포함됩니다. 로컬 브라우저에서 굵게·목록·링크, 사진 2장 첨부·순서 변경·등록·재로딩·수정 제거·확대를 확인했고, 320px·390px 화면에 가로 넘침과 콘솔 오류가 없었습니다. 카카오톡 실기기로 메시지를 발송하거나 운영 회원 명의로 테스트 글을 게시하는 검증은 하지 않습니다.

운영 DB에서는 실제 `authenticated` 역할로 기존 회원 2명의 사진 예약·정리, 기존 게시글 응답 호환성, 회원·비회원 조회 중복 제외와 비회원 업로드 예약 거부를 확인했습니다. 이 검사는 트랜잭션을 되돌려 기존 회원 2명·게시글 1개·댓글 0개를 보존했고 사진·방문 기록을 남기지 않았습니다. 실제 회원 세션으로 Storage에 사진을 업로드하는 종단 간 검증은 별도입니다.

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

Supabase Security Advisor는 의도적으로 비회원에게 공개한 RPC 3개(목록·글 조회·조회수 집계)와 로그인 후 호출하는 RPC 10개의 `SECURITY DEFINER` 실행 경고를 반환합니다. 사진 예약·정리는 본인 데이터에만 접근하며 비로그인 실행 권한이 없습니다. 이는 각 RPC 내부의 소유자·역할·제재 검사와 비공개 스키마 차단으로 통제하며, 불필요하게 노출된 자동 RLS 트리거 함수의 실행 권한은 회수했습니다. 관련 규칙: [비로그인 함수 실행 경고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [로그인 함수 실행 경고](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

`voku_private.post_viewers`의 [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)는 의도한 전체 차단 상태입니다. 브라우저 역할에는 테이블 접근 권한과 허용 정책이 없고, 조회수 RPC만 내부에서 사용합니다. Performance Advisor에는 기존 테이블의 [외래 키 인덱스 안내 10건](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)과 [RLS 초기화 계획 경고 5건](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)이 남아 있으며, 이번 사진 테이블의 소유자·게시글 외래 키에는 인덱스가 있습니다.

Free 플랜에서는 유출 비밀번호 차단이 제공되지 않아 해당 Auth Advisor 경고가 남습니다. 유료 전환은 진행하지 않았습니다. [Supabase 비밀번호 보호 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

코드 검사, 체험 모드 QA, 실제 카카오 인증, 서버 권한 검증, 외부 배포를 서로 구분합니다. 현재 공개 주소는 Cloudflare Pages이며 로컬 Wi-Fi 주소는 같은 네트워크에서만 사용할 수 있습니다. 이메일 발송·별도 관리자 로그인·추가 운영 정책까지 검증했다는 의미는 아닙니다.


### 프런트엔드 로딩 최적화

- 커뮤니티·로그인·계정 화면은 아카이브 전체 목록을 기다리지 않습니다. 큐시트 관련 화면 또는 자료가 첨부된 글을 열 때 한 번 읽고 재사용합니다.
- 커뮤니티의 각 화면 코드는 처음 방문할 때 불러옵니다. 화면의 마크업과 권한 검사는 기존과 같습니다.
- 중복 게시판 조회는 5초 이내 메모리 캐시로 공유합니다. 로그인 상태 변경 및 모든 수정 요청의 시작·완료 시 캐시를 비웁니다. 계정 정보는 완료된 결과를 캐시하지 않습니다.
- SUIT 원본과 OFL 고지는 `public/fonts`에 보존합니다. 파생 파일의 내부 이름은 VOKU Archive Sans이며, 모든 원본 문자를 `unicode-range`로 나누어 필요할 때 받습니다. `scripts/subset-font.py`는 모든 기본 글자 윤곽·너비와 가변 굵기 표본을 원본과 비교합니다. 재생성에는 `fonttools[woff]==4.60.1`이 필요하며 일반 빌드에는 Python이 필요 없습니다.
- `public/_headers`는 내용 해시가 붙은 `/assets/`의 빌드 파일과 폰트 조각에만 1년 브라우저 캐시를 설정합니다. 재방문 때 재검증 요청을 줄이고, 파일이 바뀌면 URL도 바뀌어 새 버전을 받습니다. HTML·자료 JSON·회원 데이터에는 이 규칙이 적용되지 않습니다. [Cloudflare Pages 캐시 설정](https://developers.cloudflare.com/pages/configuration/headers/#configure-custom-browser-cache-behavior)에 따라 배포 후 적용됩니다.
- `npm run build && npm run check:performance`로 초기 코드·스타일·폰트 크기와 화면별 코드 분리를 확인할 수 있습니다.
