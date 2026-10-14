# 회원·인증 1차 개선 — 외부 설정과 확인

현재 구현은 카카오 유지, Google 로그인, 이메일·비밀번호 가입, 이메일 확인·재전송, 비밀번호 재설정, 닉네임 설정과 원래 화면 복귀까지입니다. 패스키·계정 수동 연결·관리자 운영은 이번 범위에서 제외합니다.

2026-10-14 현재 Google 브랜드 인증은 보류하고, 로그인 화면의 Google 버튼만 `src/community/Auth.tsx`의 `showGoogleLogin = false`로 숨깁니다. `VITE_GOOGLE_LOGIN_ENABLED`, GCP·Supabase 제공자 설정, 계정·인증 콜백은 변경하지 않습니다. 다시 도입할 때는 표시 값을 `true`로 바꾸고 이용안내와 서비스 소개를 함께 갱신한 뒤 빌드·배포합니다. 카카오·이메일 로그인과 이메일 가입은 계속 제공합니다.

Google과 신규 이메일 가입의 기본 예시 설정은 `false`입니다. 전용 Gmail SMTP·이메일 가입과 Google 연결·실제 로그인을 확인했고, 로컬에서는 두 기능을 활성화했습니다. 카카오와 기존 이메일 로그인은 유지하며, 로컬에서 실제 외부 인증을 확인한 것과 운영 배포 완료는 구분합니다.

## 1. Google Cloud

사용할 전용 프로젝트는 **`voku-on` (VOKU On)** 입니다. 기존 `imrobo` 프로젝트와 분리합니다.

1. [Google Auth Platform](https://console.cloud.google.com/auth/overview)에서 프로젝트를 만들고 앱 이름 `VOKU On`, 지원 이메일, 대상 사용자(Audience), 앱 도메인을 설정합니다. 일반 사용자에게 공개할 때는 테스트 사용자 제한과 게시 상태를 확인합니다.
2. Data Access는 `openid`, `userinfo.email`, `userinfo.profile`만 사용합니다. 연락처·전화번호·Drive 접근은 요청하지 않습니다.
3. OAuth Client를 **Web application**으로 생성합니다. 운영 JavaScript origin은 `https://voku.pages.dev`, Redirect URI는 **`https://awvnzjdtdcdcjtfinuuy.supabase.co/auth/v1/callback`** 입니다. 이 주소는 Google → Supabase 복귀용이며 웹앱 홈 주소가 아닙니다.
4. 발급된 Client ID·Client Secret을 Supabase 프로젝트의 **Authentication → Sign In / Providers → Google**에 직접 입력하고 활성화합니다. Secret은 채팅·Git·브라우저 `VITE_` 변수에 넣지 않습니다.
5. 앱의 `VITE_GOOGLE_LOGIN_ENABLED=true`를 설정해 빌드합니다. 카카오의 기존 설정과 scope는 바꾸지 않습니다.

[Supabase Google 설정 문서](https://supabase.com/docs/guides/auth/social-login/auth-google), [Google 로그인 버튼 가이드](https://developers.google.com/identity/branding-guidelines). 버튼 아이콘은 Google의 공식 `g-logo.png`를 로컬 정적 자산으로 사용합니다.

## 2. 이메일 발송

1. SMTP 서비스 계정과 발신 주소를 준비합니다. 공급자를 선택한 뒤 발신자·도메인 인증을 진행하고 발송 한도를 확인합니다.
2. Supabase **Authentication → Email → SMTP Settings**에 SMTP host·port·username·password, 발신 주소와 이름 `VOKU On`을 저장합니다. SMTP 비밀번호도 프런트엔드에 넣지 않습니다.
3. Email provider와 **Confirm email을 켜고**, 최소 비밀번호 길이 10자를 유지합니다. 확인을 끄면 이메일 소유자 검증을 건너뛰므로 끄지 않습니다.
4. 아래 두 메일 템플릿을 적용합니다. 인증번호 `{{ .Token }}`와 링크 `{{ .ConfirmationURL }}`를 함께 넣습니다. 이 앱은 PKCE를 사용하므로 링크는 가입·재설정을 시작한 브라우저에서 여는 것이 필요합니다. 다른 메일 앱에서 링크를 열었다면 원래 브라우저에 인증번호를 입력할 수 있습니다.
5. 발송과 가입·재설정 실동작을 확인한 뒤 `VITE_EMAIL_SIGNUP_ENABLED=true`로 빌드합니다. 기존 이메일 로그인 및 비밀번호 찾기는 이 가입용 flag와 별개입니다.

Supabase 기본 SMTP는 일반 이용자 전체에게 보내는 운영 메일 서비스가 아닙니다. [SMTP 설정 문서](https://supabase.com/docs/guides/auth/auth-smtp), [인증 메일 템플릿 문서](https://supabase.com/docs/guides/auth/auth-email-templates).

2026-10-11 대시보드 확인: 이 프로젝트에서는 custom SMTP를 설정해야 인증 메일의 제목·본문을 수정할 수 있습니다. 먼저 SMTP를 연결한 다음 아래 템플릿을 적용합니다. [Supabase 변경 공지](https://supabase.com/changelog).

### 도메인이 없는 초기 무료 발송 검토

- **전용 Gmail SMTP**: 소규모 초기 운영 후보입니다. 전용 Gmail 주소와 2단계 인증, 앱 비밀번호가 필요합니다. 일반 Gmail의 하루 500통 제한은 보장된 발송량이 아니며 차단·반송 등에 따른 제한도 있습니다. 앱 비밀번호는 사용자가 직접 생성해 Supabase에 입력합니다. 개인 메일과 분리한 전용 계정을 권장합니다. [앱 비밀번호](https://support.google.com/accounts/answer/185833?hl=ko), [Gmail 발송 한도](https://support.google.com/mail/answer/22839?hl=ko).
- **Brevo Free**: 하루 300통이지만, 무료 이메일 주소를 발신자로 쓰면 Brevo가 이를 임시 발신 주소로 대체합니다. 자체 도메인을 대체하는 장기 해법으로 보장하지 않습니다. [무료 플랜](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [발신 주소 대체 안내](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).
- **Resend**: 기본 `resend.dev` 발신 주소는 본인에게만 시험 발송할 수 있습니다. 일반 회원에게 보내려면 보유 도메인 인증이 필요합니다. [제한 안내](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
- **SMTP2GO**: 무료 플랜과 개별 발신자 인증이 있지만, 현재 신규 가입 안내에서는 보유 도메인 또는 업무 이메일을 요구합니다. Gmail만 있는 현재 조건에서는 우선 선택하지 않습니다. [가입 조건](https://support.smtp2go.com/hc/en-gb/articles/12747932085145-Quick-Start-Guide).

서비스별 한도와 조건은 설정 시점의 공식 문서와 실제 계정 상태를 다시 확인합니다.

### 선택한 초기 설정: VOKU 전용 Gmail

전용 주소는 `vokuon@gmail.com`입니다. 사용자가 계정 생성·2단계 인증과 SMTP 앱 비밀번호 입력을 완료했습니다. 인증메일 발신 주소와 Google 로그인 지원 주소를 이 주소로 통일합니다.

| Supabase SMTP 항목 | 값 |
| --- | --- |
| Sender email address | `vokuon@gmail.com` |
| Sender name | `VOKU On` |
| Host | `smtp.gmail.com` |
| Port number | `465` (SSL) |
| Minimum interval per user | `60`초 |
| Username | `vokuon@gmail.com` |
| Password | Google에서 생성한 앱 비밀번호 — 사용자가 직접 입력 |

[Google SMTP 설정 안내](https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app). Supabase 대시보드도 Gmail을 개인용 메일 서비스로 감지해 전달률 경고를 표시합니다. 초기 소량 발송용이며 실제 수신 시험이 필요합니다. 발송 한도는 Authentication → Rate Limits에서 관리하며, 현재 한도를 임의로 늘리지 않았습니다.

Google 로그인 지원 이메일은 단순 텍스트 입력이 아니라 로그인된 Google 계정 또는 관리 중인 Google 그룹 중에서 선택합니다. 전용 Gmail로 GCP에 로그인해 `voku-on` 프로젝트의 OAuth 설정을 관리합니다. **OAuth Config Editor (`roles/oauthconfig.editor`)**는 브랜드·클라이언트 및 키 관리를 포함합니다. 콘솔에서 클라이언트 목록과 사용량 화면을 여는 데 추가로 요구한 **서비스 계정 보기 (`roles/iam.serviceAccountViewer`)**, **서비스 사용량 뷰어 (`roles/serviceusage.serviceUsageViewer`)**도 사용자 승인 후 전용 계정에 저장했습니다. 프로젝트 전체 Owner 권한이나 결제 권한은 추가하지 않았습니다. [Google 지원 이메일 조건](https://support.google.com/cloud/answer/15549049), [OAuth Config Editor 권한](https://docs.cloud.google.com/iam/docs/roles-permissions/oauthconfig), [서비스 계정 역할](https://docs.cloud.google.com/iam/docs/roles-permissions/iam), [서비스 사용량 역할](https://docs.cloud.google.com/iam/docs/roles-permissions/serviceusage).

### Confirm signup

제목: `VOKU On 이메일을 확인해 주세요`

```html
<h2>VOKU On 이메일 확인</h2>
<p>가입 화면에 아래 인증번호를 입력해 주세요.</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p><a href="{{ .ConfirmationURL }}">이메일 확인하고 계속하기</a></p>
<p>가입을 시작한 브라우저에서 링크를 열어 주세요. 직접 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
```

### Reset password

제목: `VOKU On 비밀번호 재설정 안내`

```html
<h2>VOKU On 비밀번호 재설정</h2>
<p>재설정 화면에 아래 인증번호를 입력해 주세요.</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p><a href="{{ .ConfirmationURL }}">새 비밀번호 설정하기</a></p>
<p>재설정을 요청한 브라우저에서 링크를 열어 주세요. 직접 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
```

## 3. Supabase 앱 복귀 URL

Site URL은 `https://voku.pages.dev/`. Redirect URLs에는 앱이 실제 사용하는 다음 주소를 허용합니다.

- `https://voku.pages.dev/`
- `https://voku.pages.dev/?auth=recovery`
- 로컬 검증용: `http://localhost:5214/`, `http://localhost:5214/?auth=recovery`, `http://127.0.0.1:5214/`, `http://127.0.0.1:5214/?auth=recovery`

LAN 기기에서 인증까지 검증할 때는 해당 IP·포트의 정확한 주소도 별도로 등록해야 합니다. 넓은 wildcard로 운영 복귀 주소를 개방하지 않습니다. Google Redirect URI와 이 앱 복귀 URL 목록은 서로 다른 설정입니다.

## 4. 기존 계정과 데이터

기존 회원·게시글 테이블과 권한 함수를 그대로 사용하므로 이번 변경에는 DB 마이그레이션이 없습니다. Google의 확인된 이메일 또는 기존 카카오 identity를 서버가 확인한 뒤 본인이 정한 닉네임으로 가입을 완료합니다. 소셜 이름·사진을 커뮤니티 공개 프로필에 자동 복사하지 않습니다. 학번·기수는 선택 입력입니다.

카카오 계정은 이메일이 없을 수 있으므로 Google이나 이메일로 새로 가입하면 별도 계정이 될 수 있습니다. 이번 작업은 기존 계정의 글·댓글을 자동 병합하지 않습니다. 이미 가입한 사람에게 기존 로그인 방법을 선택하도록 안내합니다.

돌아갈 화면과 목록 필터·스크롤은 같은 탭의 sessionStorage에 1시간의 유효기간을 두고 저장하고 복귀 시 제거합니다. 인증을 기다리는 이메일 주소도 같은 탭에 같은 유효기간으로 저장합니다. 비밀번호·인증번호는 별도로 저장하지 않습니다. 다른 브라우저에서 시작하거나 저장 공간을 사용할 수 없으면 복귀 위치가 기본 목록으로 바뀔 수 있습니다.

## 5. 외부 설정 후 실제 확인할 흐름

- 카카오 기존 회원: 로그인·취소·재로그인, 글·댓글 유지.
- Google 신규 회원: 동의 → 닉네임 설정 → 보던 글·목록 복귀. 기존 회원 재로그인.
- 이메일 신규 가입: 메일 수신 → 링크 또는 번호 확인 → 닉네임 → 원래 화면. 미인증 계정의 회원 동작 차단.
- 이메일 인증 재전송, 틀린 번호·만료 링크, 중복 가입 안내, 비밀번호 찾기·변경·새 비밀번호 로그인.
- 모바일 메일 앱으로 이동했다가 원래 브라우저에서 번호 입력. 게시글·말머리·페이지·스크롤 복귀.

로컬 모의 인증은 UI와 상태 전환을 검증하지만 Google 동의 화면, 실제 SMTP 발송·수신과 세션 교환을 대신하지 않습니다.

## 6. 인증 1차 구현 당시 로컬 검증 결과 (통합 최적화 전)

- `npm test`: **119개 통과**. 실제 SQL 마이그레이션을 실행한 Google·이메일 회원 온보딩/권한 검사, 복귀 URL 검증, 목록·스크롤 보관, 저장소 차단/만료, 재전송 대기, 비밀번호 길이, 재설정 화면 복원을 포함합니다.
- `npm run check`, `npx vite build`: 통과. 빌드는 기존 `prebuild`의 공통 모션 파일 재생성을 피하고 현재 작업 파일을 그대로 검사했습니다.
- 모바일 브라우저 320px·390px: 가로 넘침 없음. 카카오 유지와 Google/이메일 신규 가입 비활성 표시, 이메일 로그인·가입 화면, 비밀번호 표시 버튼과 입력 영역 확인.
- 실제 외부 인증 요청을 대체한 로컬 모의 서버: 가입 → 인증번호 오류/재전송/성공 → 닉네임 → 목록, Google 콜백 → 닉네임 → 원래 말머리의 글쓰기, 비밀번호 찾기 → 인증 → 새로고침 → 비밀번호 변경 확인. 실회원이나 인증 메일은 생성하지 않았습니다.
- 일반 로컬 앱: 로그인 취소 시 목록의 말머리·페이지와 게시글의 읽던 위치 복원, 유효하지 않은 PKCE 링크와 OAuth 취소 후 한국어 복구 안내 확인.
- 전체 작업 폴더의 `check:performance`는 작업 시작 전부터 있던 `src/motion.css` 변경을 포함하면 CSS 용량 기준을 넘습니다. 이 기존 변경을 제외한 임시 빌드에서는 초기 JS 844,171 bytes / CSS 264,467 bytes로 기준 통과했습니다. 인증 전용 CSS는 로그인 화면을 열 때만 불러옵니다. 기존 모션 파일은 변경하지 않았습니다.

아래 외부 설정 단계에서 실제 SMTP 발송·수신과 이메일 가입, Google 계정 로그인·재로그인·말머리 목록 복귀를 추가 확인했습니다. 비밀번호 재설정의 실제 메일 수신·변경·새 비밀번호 재로그인도 아래 단계에서 확인했습니다. 운영 배포는 아직 하지 않았습니다.

## 7. 외부 설정 진행 상태 (2026-10-11~12)

- 사용자가 Google Cloud 전용 프로젝트 `voku-on`을 생성했고, 콘솔에서 `VOKU On` 프로젝트 선택을 확인했습니다. 기존 `imrobo` 프로젝트는 변경하지 않았습니다.
- 사용자 승인 후 OAuth 앱 `VOKU On` 생성이 완료됐습니다. 지원·개발자 연락 이메일은 `vokuon@gmail.com`, 대상은 외부 사용자입니다. 생성 당시 테스트 상태였으며, 2026-10-12 사용자 승인 후 프로덕션으로 전환했습니다(아래 8절).
- Supabase에서 카카오·Google·이메일 제공자와 이메일 확인이 활성화된 상태를 확인했습니다. Site URL과 운영/로컬/현재 LAN 복귀 주소는 이미 등록되어 있었습니다.
- 전용 Gmail `vokuon@gmail.com` 생성·2단계 인증은 사용자가 완료했고, 해당 계정으로 GCP 로그인한 것을 확인했습니다.
- 사용자가 SMTP 앱 비밀번호를 직접 입력하고 저장했습니다. 대시보드에서 custom SMTP 활성화와 저장된 비밀번호 안내, 인증 메일 템플릿 편집 가능 상태를 확인했습니다. 발신 주소·사용자명은 `vokuon@gmail.com`, 이름 `VOKU On`, 호스트 `smtp.gmail.com`, 포트 `465`, 사용자별 간격 `60`초입니다. 앱 비밀번호는 채팅이나 파일에 기록하지 않았습니다.
- 위의 한국어 가입 확인·비밀번호 재설정 템플릿 두 개를 Supabase에 저장했고, 인증번호·확인 링크가 함께 나오는 미리보기를 확인했습니다. 2026-10-12 실제 메일 수신·비밀번호 변경·새 비밀번호 재로그인까지 확인했습니다.
- 로컬 `.env.local`에서만 이메일 가입을 활성화했습니다. 사용자가 직접 가입 비밀번호를 입력하고, `vokuon@gmail.com`으로 메일 수신·인증번호 확인을 완료했다고 확인했습니다. 브라우저에서 `TestOn` 닉네임 설정 후 `#/board`로 돌아온 로그인 상태를 확인했습니다. 비밀번호·인증번호는 채팅이나 파일에 기록하지 않았습니다. 기본 예시 설정과 운영 배포는 변경하지 않았습니다.
- 내장 브라우저의 GCP 콘솔 데이터 로드 오류가 반복되어 사용자 요청에 따라 Chrome으로 전환했습니다. 사용자가 전용 계정에 OAuth Config Editor를 부여한 것을 확인했고, 추가로 승인받은 서비스 계정 보기·서비스 사용량 뷰어를 저장했습니다. 전용 계정의 OAuth 클라이언트 목록 접근도 정상화됐습니다.
- 웹 OAuth 클라이언트 `VOKU On Web`을 사용자가 생성했고, Client ID·Client Secret을 Supabase Google 제공자에 직접 입력·저장했습니다. 콘솔의 클라이언트 생성 결과와 Supabase의 Google `ENABLED` 상태를 확인했습니다. JavaScript 원본은 `https://voku.pages.dev`, 리디렉션 URI는 `https://awvnzjdtdcdcjtfinuuy.supabase.co/auth/v1/callback`입니다. Secret은 읽거나 파일에 기록하지 않았습니다.
- Google 데이터 액세스에 `openid`, `userinfo.email`, `userinfo.profile`만 저장했습니다. 민감한 범위와 제한된 범위는 없습니다. 실제 동의 화면도 이름·프로필 사진·이메일을 요청했습니다.
- 로컬 `.env.local`에서 Google 로그인을 활성화했습니다. Chrome에서 실제 Google 인증 후 이메일 가입 때 정한 `TestOn`으로 로그인됐고, 로그아웃 후 `추억` 말머리의 로그인 버튼 → Google 재로그인 → 동일한 `#/board?category=%EC%B6%94%EC%96%B5` 복귀를 확인했습니다. 로그인 URL을 직접 연 재시험에서도 지정한 말머리 복귀를 확인했습니다.
- 초기 Google 로그인 시험은 테스트 상태에서 진행했습니다. 기본 프로필·이메일·OpenID만 요청하는 로그인은 테스트 사용자 목록 제한의 예외라는 [Google 공식 안내](https://support.google.com/cloud/answer/15549945?hl=en)를 확인했습니다. 이후 앱 게시·브랜드 표시 준비는 아래 8절에서 진행했습니다.
- 초기 실제 Google 동의 화면에는 `VOKU On` 대신 Supabase 프로젝트 주소가 서비스명으로 표시됐습니다. 당시 인증 센터는 테스트 상태이므로 인증이 필요하지 않다고 표시했습니다. 서비스명 표시를 위한 홈페이지·개인정보처리방침·게시 상태와 브랜드 검증은 아래 8절에서 이어서 진행했습니다.
- 인증 UI와 인증 코드의 커밋·푸시·운영 배포는 하지 않았습니다. 아래 8절에서 승인받은 공개 안내 파일만 별도로 배포했습니다.


## 8. 브랜드 표시와 실제 비밀번호 재설정 (2026-10-12)

- 사용자가 VOKU On에서 `vokuon@gmail.com`의 복구 인증번호와 새 비밀번호를 직접 입력·저장했습니다. `#/board`의 `TestOn` 로그인 상태로 복귀한 것을 확인했습니다.
- 이어서 앱에서 로그아웃하고 이메일 로그인 화면을 열었습니다. 사용자가 새 비밀번호로 직접 로그인한 뒤 동일한 `TestOn` 계정과 `#/board` 복귀를 다시 확인했습니다. Google/Gmail 비밀번호는 변경하지 않았습니다.
- Google 브랜딩의 앱 이름 `VOKU On`, 지원·개발자 이메일 `vokuon@gmail.com`은 이미 저장되어 있었습니다. 작업 시작 당시 홈페이지·개인정보처리방침·이용약관이 비어 있었고, 아래와 같이 공개 페이지를 배포한 뒤 주소를 저장했습니다.
- [Google 공식 안내](https://support.google.com/cloud/answer/15549049?hl=en)에 따르면 동의 화면의 앱 이름 표시는 브랜드 인증 및 게시가 필요합니다. 앱 이름 필드를 저장하거나 테스트 상태를 바꾸는 것만으로 표시 완료라고 판단하지 않습니다.
- Search Console에서 전용 계정으로 `https://voku.pages.dev/` URL 접두어 속성의 HTML 파일 확인 방법을 준비했습니다. 공개 확인 파일은 `docs/oauth-branding/googlec48ffcbf40f9282e.html`에 보관했습니다. 사용자의 배포·소유권 확인 승인 후 파일을 운영에 올렸고, 전용 계정에서 HTML 파일 방식의 사이트 소유권 확인 성공을 확인했습니다.
- 서비스 소개·개인정보처리방침·이용약관의 로컬 검토본은 `docs/oauth-branding/`에 있습니다. 사용자 요청대로 운영 표시명은 `VOKU On`, 문의 주소는 `vokuon@gmail.com`입니다. DB 리전 `ap-northeast-2`는 Supabase 프로젝트 메타데이터로 재확인했습니다.
- 개인정보처리방침의 계정·게시물 삭제 요청 이메일 접수와 처리 방식, 소개·약관 공개를 사용자가 승인했습니다. 운영본은 `public/about/index.html`, `public/privacy/index.html`, `public/terms/index.html`이며 2026-10-12 시행으로 공개했습니다. 이는 법률 준수 검토를 완료했다는 의미는 아닙니다.
- 안내 페이지·스타일·Google 확인 파일 5개만 `8dde54ee0aa115db4837a09d975e1468359cc36d`로 커밋·푸시했습니다. Cloudflare Pages 검사 성공과 운영 URL 3개의 내용·시행일을 실제 브라우저에서 확인했습니다. GCP에도 `https://voku.pages.dev/about/`, `/privacy/`, `/terms/`를 저장했습니다. 인증 UI 전체와 기타 기존 작업 파일의 운영 반영은 별도 범위입니다.

- Google 대상 화면의 앱 게시 버튼이 활성화됐습니다. 최초 프로덕션 전환은 자동 승인 검토가 기존 승인 범위를 벗어난다고 거부하여 실행하지 않았습니다. 이후 사용자가 “Google 앱 프로덕션 게시 승인”으로 명시적으로 승인했고, 확인 버튼을 눌러 게시 상태가 **프로덕션 단계**로 바뀐 것을 확인했습니다. 요청 범위는 여전히 기본 로그인 세 가지이며 웹앱의 미배포 인증 UI는 변경하지 않았습니다.
- 프로덕션 전환 후 브랜딩 화면의 **브랜딩 확인**을 눌렀습니다. 자동 검사 결과는 홈페이지 `https://voku.pages.dev/about/`의 소유권이 아직 등록된 것으로 확인되지 않는다는 안내였습니다. Search Console의 HTML 파일 소유권 확인은 성공했지만, Google 인증 화면은 소유권 확인 후 시스템 반영을 위해 **24시간 기다린 뒤 재시도**하라고 명시합니다. 즉시 재시도하거나 오류라고 이의 제기하지 않았습니다. 사이트 소유권 확인 후 24시간이 지난 다음 재인증 → 통과 시 브랜드 게시 → 실제 Google 로그인 화면의 이름·로고 표시 확인이 남아 있습니다.
- 사용자가 지정한 `assets/branding/voku-on-microphone-source.png`는 1254×1254 PNG, 1,470,844 bytes여서 Google의 1MB 업로드 제한을 넘었습니다. 원본을 보존하고 `sips -z 120 120`으로 권장 규격의 `assets/branding/voku-on-google-oauth-120.png`를 만들었습니다. 이 파일을 Google 브랜딩의 앱 로고에 업로드·저장했고, 저장 완료 안내와 **현재 앱 로고** 표시를 확인했습니다. 새 파일은 로컬 미커밋 상태이며 인증 UI나 다른 웹앱 파일을 배포하지 않았습니다.
- 앱의 프로덕션 게시와 로고 저장은 완료했으나, **브랜드 인증과 실제 동의 화면의 VOKU On 이름·로고 노출은 아직 완료되지 않았습니다.** 비밀번호 재설정·새 비밀번호 로그인 검증은 위 기록과 같이 완료됐습니다.

## 9. 통합 릴리스 준비 (2026-10-12)

사용자가 최적화·깜빡임 수정과 이전 미반영 변경의 커밋·푸시·운영 배포를 함께 승인했습니다. 인증 UI·복귀 처리·공통 모션을 이번 웹앱 릴리스에 포함하고 Pages 운영 빌드의 Google·이메일 가입 플래그를 활성화합니다. 새 DB 마이그레이션은 없습니다. 위 6~8절의 미배포·용량 초과 기록은 해당 단계 당시의 결과입니다.

최적화 후 전체 자동 테스트는 122개이며 타입·아카이브 무결성 검사, 운영 빌드, 성능 검사와 홈 빌드 검사를 통과했습니다. 초기 JS 806,258 bytes / CSS 238,237 bytes로 공통 모션을 포함한 상태에서 강화한 용량 기준도 통과했습니다. Google 브랜드 인증과 실제 동의 화면의 이름·로고 표시는 별도 후속 확인 항목으로 유지합니다.
