import { AuthInfoLinks } from "./AuthInfoLinks";
import "./auth.css";
import { Button, Input, Label, Spinner, TextField } from "@heroui/react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { KakaoEntry, ProfileSetup } from "./KakaoAuth";
import { api, authRedirect, emailSignupEnabled, errorText, googleEnabled, kakaoEnabled, signInWithProvider, supabase } from "./client";
import { authScreenPath, emailCooldown, passwordError, pendingExternalAuth, readAuthReturn, readPendingEmail, savePendingEmail, type AuthMode, type PendingEmail } from "./authFlow";
import { oauthReturnKey, safeReturnPath } from "./oauth";
import { ErrorLine, Header, type Base } from "./shared";

// Hide only the entry point while Google brand verification is on hold.
// Keep the provider configuration and callback handling available for later use.
const showGoogleLogin = false;

function PasswordField({ label, value, onChange, fresh, disabled }: {
  label: string; value: string; onChange: (value: string) => void; fresh: boolean; disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <TextField isRequired type={visible ? "text" : "password"} value={value} onChange={onChange} isDisabled={disabled}>
    <Label>{label}</Label>
    <div className="auth-password-input">
      <Input autoComplete={fresh ? "new-password" : "current-password"} minLength={fresh ? 10 : undefined} maxLength={72} placeholder={fresh ? "10자 이상 입력" : "비밀번호 입력"} />
      <button type="button" aria-label={`${label} ${visible ? "숨기기" : "보기"}`} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
    </div>
  </TextField>;
}

export function AuthScreen({ c, go, notify, params }: Base & { params: URLSearchParams }) {
  const context = readAuthReturn();
  const next = safeReturnPath(params.get("next") || context?.next);
  const back = safeReturnPath(params.get("back") || context?.back || next);
  const [pending, setPending] = useState(readPendingEmail);
  const [email, setEmail] = useState(() => readPendingEmail()?.email || "");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [now, setNow] = useState(Date.now);
  const requested = params.get("mode");
  const mode: AuthMode = c.recovery ? "reset" : requested === "confirm" && pending ? "confirm" :
    ["email", "join", "forgot", "reset", "profile"].includes(requested || "") ? requested as AuthMode : "login";
  const cooldown = emailCooldown(pending, now);
  useEffect(() => {
    setPassword(""); setRepeat(""); setCode(""); setError(""); setMessage(""); setNeedsConfirmation(false);
  }, [mode]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  const switchMode = (value: AuthMode) => { if (!busy) { c.clearAuthError(); go(authScreenPath(value, next, back), true); } };
  const returnToContent = () => {
    if (busy) return;
    if (c.recovery) void run("cancel", async () => {
      await c.logout();
      history.replaceState(history.state, "", location.pathname + location.hash);
      go(back, true, false, true);
    });
    else go(back, true, false, true);
  };
  const updatePending = (value: PendingEmail | null) => { savePendingEmail(value); setPending(value); setNow(Date.now()); };
  const finish = async () => {
    const account = await c.refresh() || await api.account();
    if (!account) throw Error("회원정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    updatePending(null);
    go(account.profile.profileComplete ? next : authScreenPath("profile", next, back), true, false, true);
  };
  const run = async (kind: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind); setError(""); setMessage(""); c.clearAuthError();
    try { await action(); } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  const sendAgain = async (value = pending) => {
    if (!supabase || !value) return;
    const result = value.kind === "signup"
      ? await supabase.auth.resend({ type: "signup", email: value.email, options: { emailRedirectTo: authRedirect() } })
      : await supabase.auth.resetPasswordForEmail(value.email, { redirectTo: authRedirect(true) });
    if (result.error) throw result.error;
    updatePending({ ...value, sentAt: Date.now() });
    setCode(""); setMessage("인증 메일을 다시 요청했어요. 가장 최근 메일을 확인해 주세요.");
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run("submit", async () => {
      if (!supabase) return;
      if (mode === "join" || mode === "reset") {
        const problem = passwordError(password, repeat);
        if (problem) throw Error(problem);
      }
      if (mode === "join") {
        if (!emailSignupEnabled) throw Error("이메일 회원가입은 준비 중입니다.");
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect() } });
        if (error) throw error;
        if (data.session) await finish();
        else {
          updatePending({ email: email.trim(), kind: "signup", sentAt: Date.now() });
          go(authScreenPath("confirm", next, back), true);
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true) });
        if (error) throw error;
        updatePending({ email: email.trim(), kind: "recovery", sentAt: Date.now() });
        go(authScreenPath("confirm", next, back), true);
      } else if (mode === "confirm" && pending) {
        if (!/^\d{6,10}$/.test(code.trim())) throw Error("메일에 적힌 인증번호를 입력해 주세요.");
        const { error } = await supabase.auth.verifyOtp({ email: pending.email, token: code.trim(), type: pending.kind === "signup" ? "email" : "recovery" });
        if (error) throw error;
        if (pending.kind === "recovery") {
          updatePending(null); c.setRecovery(true);
          go(authScreenPath("reset", next, back), true);
        } else await finish();
      } else if (mode === "reset") {
        if (!c.recovery) throw Error("비밀번호 재설정 메일에서 다시 시작해 주세요.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        c.setRecovery(false);
        history.replaceState(history.state, "", location.pathname + location.hash);
        notify("비밀번호를 변경했어요.");
        await finish();
      } else if (mode === "email") {
        try { sessionStorage.removeItem(oauthReturnKey); } catch { /* restricted storage */ }
        pendingExternalAuth(null);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setNeedsConfirmation(error.code === "email_not_confirmed");
          throw error;
        }
        await finish();
      }
    });
  };

  if (c.loading) return <main className="community-auth auth-loading" role="status"><Spinner size="sm" /> 로그인 상태를 확인하고 있어요.</main>;
  if (c.profile?.profileComplete === false && mode !== "reset") return <ProfileSetup c={c} go={go} next={next} back={back} />;
  if (c.profile && !["reset", "forgot", "confirm"].includes(mode)) return <main className="community-auth auth-renewed">
    <Header title="로그인" go={go} onBack={returnToContent} backLabel="원래 화면으로 돌아가기" />
    <div className="community-auth-content"><h1>{c.profile.nickname}님, 반가워요.</h1><p>로그인되어 있어요. 보던 이야기를 이어가세요.</p>
      <Button fullWidth onPress={() => go(next, true, false, true)}>이어서 이용하기</Button>
      <button className="auth-text-button" disabled={!!busy} onClick={() => void run("logout", async () => { await c.logout(); go(authScreenPath("login", next, back), true); })}>다른 계정으로 로그인</button><ErrorLine text={error || c.authError} />
    </div></main>;

  const title = mode === "join" ? "이메일 회원가입" : mode === "forgot" ? "비밀번호 찾기" : mode === "reset" ? "비밀번호 재설정" : mode === "confirm" ? "이메일 확인" : mode === "email" ? "이메일 로그인" : "로그인";
  const heading = mode === "join" ? "이메일로 시작하기" : mode === "forgot" ? "비밀번호를 잊으셨나요?" : mode === "reset" ? "새 비밀번호를 정해 주세요." : mode === "confirm" ? "이메일을 확인해 주세요." : mode === "email" ? "다시 만나 반가워요." : "반가워요, VOKU On입니다.";
  const intro = mode === "join" ? "이메일 확인 후, 사용할 닉네임만 정하면 돼요." : mode === "forgot" ? "가입한 이메일로 비밀번호 재설정 안내를 보내드려요." : mode === "reset" ? "앞으로 로그인할 때 사용할 비밀번호입니다." : mode === "confirm" ? "메일의 인증 링크를 누르거나, 인증번호를 입력해 주세요." : mode === "email" ? "가입한 이메일과 비밀번호로 로그인하세요." : "로그인하고 추억과 안부를 나눠 보세요.";
  const disabled = !c.live || !!busy || (mode === "join" && !emailSignupEnabled);
  return <main className="community-auth auth-renewed">
    <Header title={title} go={go} onBack={returnToContent} backLabel="원래 화면으로 돌아가기" />
    <div className="community-auth-content">
      <span className="community-eyebrow">VOKU On</span><h1>{heading}</h1><p>{intro}</p>
      {!c.live && <div className="community-preview-auth"><strong>화면 체험 중입니다</strong><p>실제 계정은 생성되지 않습니다.</p><Button variant="secondary" onPress={() => void run("preview", async () => { await c.previewLogin("member"); go(next, true, false, true); })}>일반 회원으로 체험</Button></div>}
      {(mode === "login" || mode === "profile") && <>
        <div className="auth-provider-buttons">
          {kakaoEnabled && <KakaoEntry busy={!c.live || !!busy} connecting={busy === "kakao"} onPress={() => void run("kakao", () => signInWithProvider("kakao", next))} />}
          {showGoogleLogin && <Button fullWidth className="auth-google-button" isDisabled={!c.live || !googleEnabled || !!busy} onPress={() => void run("google", () => signInWithProvider("google", next))}>
            <img src="/google-g.png" width="20" height="20" alt="" aria-hidden="true" />{busy === "google" ? "연결 중…" : "Google로 로그인"}{!googleEnabled && <small>준비 중</small>}
          </Button>}
        </div>
        <p className="auth-method-help">처음이라면 로그인 후 닉네임을 정해 주세요.<br />이미 가입했다면 기존에 쓰던 방법을 선택해 주세요.</p>
        <div className="auth-divider"><span>또는</span></div>
        <Button fullWidth variant="outline" className="auth-email-button" onPress={() => switchMode("email")}><Mail size={18} />이메일로 로그인</Button>
        <button className="auth-text-button" onClick={() => switchMode("join")}>이메일로 회원가입{!emailSignupEnabled && <small>준비 중</small>}</button>
        <ErrorLine text={error || c.authError || c.error} />
      </>}
      {mode === "join" && !emailSignupEnabled && <p className="auth-availability" role="status">이메일 가입을 준비 중이에요. 지금은 카카오로 시작할 수 있어요.</p>}
      {mode === "reset" && !c.recovery ? <div className="auth-availability"><p>재설정 링크가 만료되었거나 인증이 필요해요. 메일을 다시 받아 주세요.</p><Button fullWidth onPress={() => switchMode("forgot")}>재설정 메일 받기</Button></div> :
        !["login", "profile"].includes(mode) && <form className="community-form" onSubmit={submit}>
          {mode === "confirm" && pending ? <>
            <div className="auth-recipient"><Mail size={21} aria-hidden="true" /><strong>{pending.email}</strong><p>{pending.kind === "signup" ? "인증 메일을 요청했어요. 이미 가입한 이메일이라면 기존 로그인 방법을 이용해 주세요." : "가입된 이메일이라면 재설정 메일이 발송됩니다."}</p></div>
            <TextField isRequired value={code} onChange={setCode} isDisabled={disabled}><Label>인증번호</Label><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} placeholder="메일에 적힌 숫자 입력" /></TextField>
          </> : mode !== "reset" && <TextField isRequired type="email" value={email} onChange={setEmail} isDisabled={disabled}><Label>이메일</Label><Input autoComplete="email" placeholder="name@example.com" maxLength={254} autoCapitalize="none" spellCheck={false} /></TextField>}
          {["email", "join", "reset"].includes(mode) && <PasswordField label={mode === "reset" ? "새 비밀번호" : "비밀번호"} value={password} onChange={setPassword} fresh={mode !== "email"} disabled={disabled} />}
          {["join", "reset"].includes(mode) && <PasswordField label="비밀번호 확인" value={repeat} onChange={setRepeat} fresh disabled={disabled} />}
          <ErrorLine text={error || c.authError} />{message && <p className="community-success" role="status">{message}</p>}
          <Button type="submit" fullWidth isDisabled={disabled}>{busy === "submit" ? "확인 중…" : mode === "join" ? "인증 메일 받기" : mode === "forgot" ? "재설정 메일 받기" : mode === "confirm" ? "인증번호 확인" : mode === "reset" ? "비밀번호 변경" : "로그인"}</Button>
        </form>}
      {mode === "confirm" && pending && <div className="auth-confirm-actions">
        <p>메일이 없다면 스팸함도 확인해 주세요.</p>
        <button disabled={!!busy || cooldown > 0} onClick={() => void run("resend", () => sendAgain())}>{cooldown > 0 ? `${cooldown}초 후 다시 받기` : busy === "resend" ? "요청 중…" : "인증 메일 다시 받기"}</button>
        <button disabled={!!busy} onClick={() => { const kind = pending.kind; updatePending(null); switchMode(kind === "signup" ? "join" : "forgot"); }}>이메일 주소 바꾸기</button>
        <button disabled={!!busy} onClick={() => switchMode("email")}>이미 확인했어요 · 이메일로 로그인</button>
      </div>}
      {mode === "email" && needsConfirmation && <button className="auth-text-button" disabled={!!busy || (pending?.email === email.trim() && cooldown > 0)} onClick={() => void run("resend", async () => { await sendAgain({ email: email.trim(), kind: "signup", sentAt: 0 }); go(authScreenPath("confirm", next, back), true); })}>인증 메일 다시 받기</button>}
      {mode === "email" && <div className="community-auth-links"><button disabled={!!busy} onClick={() => switchMode("forgot")}>비밀번호 찾기</button><button disabled={!!busy} onClick={() => switchMode("join")}>이메일 회원가입</button></div>}
      {!["login", "profile", "reset"].includes(mode) && <button className="auth-text-button" disabled={!!busy} onClick={() => switchMode("login")}>다른 방법으로 로그인</button>}
      <AuthInfoLinks />
      <p className="auth-return-help">로그인을 마치면 이용하던 화면으로 돌아갑니다.</p>
    </div>
  </main>;
}
