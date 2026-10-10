import { Button, Input, Label, TextField } from "@heroui/react";
import { useEffect, useState } from "react";
import { AffiliationFields } from "./AffiliationFields";
import { KakaoEntry, ProfileSetup } from "./KakaoAuth";
import { parseAffiliation } from "./affiliation";
import {
  authRedirect,
  emailSignupEnabled,
  errorText,
  kakaoEnabled,
  signInWithKakao,
  supabase,
} from "./client";
import { safeReturnPath } from "./oauth";
import { ErrorLine, Header, type Base } from "./shared";

export function AuthScreen({
  c,
  go,
  notify,
  params,
}: Base & { params: URLSearchParams }) {
  const [mode, setMode] = useState(
      c.recovery ? "reset" : ["forgot", "reset"].includes(params.get("mode") || "") ? params.get("mode")! : emailSignupEnabled && params.get("mode") === "join" ? "join" : "login",
    ),
    [emailOpen, setEmailOpen] = useState(!kakaoEnabled || ["forgot", "reset"].includes(params.get("mode") || "")),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [nickname, setNickname] = useState(""),
    [admissionYear, setAdmissionYear] = useState(""),
    [cohort, setCohort] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (c.recovery) setMode("reset");
  }, [c.recovery]);
  const next = safeReturnPath(params.get("next"));
  const finish = () =>
    go(
      next?.startsWith("/") &&
        !next.startsWith("//") &&
        !next.startsWith("/auth")
        ? next
        : "/board",
      true,
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "join") {
        if (!emailSignupEnabled) throw Error("이메일 회원가입은 준비 중입니다. 카카오 로그인을 이용해 주세요.");
        if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(nickname))
          throw Error(
            "닉네임은 한글, 영문, 숫자, 밑줄 2~16자로 입력해 주세요.",
          );
        if (password !== repeat) throw Error("비밀번호가 일치하지 않아요.");
        const affiliation = parseAffiliation(admissionYear, cohort);
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nickname,
              admission_year: affiliation.admissionYear,
              cohort: affiliation.cohort,
            },
            emailRedirectTo: authRedirect(),
          },
        });
        if (error) throw error;
        if (data.session) {
          await c.refresh();
          finish();
        } else {
          setMessage(
            "이메일로 보낸 인증 링크를 눌러 가입을 완료해 주세요. 관리자 승인 없이 이용할 수 있습니다.",
          );
          setPassword("");
          setRepeat("");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: authRedirect(true) },
        );
        if (error) throw error;
        setMessage("가입된 이메일이라면 비밀번호 재설정 안내가 발송됩니다.");
      } else if (mode === "reset") {
        if (password !== repeat) throw Error("비밀번호가 일치하지 않아요.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        c.setRecovery(false);
        history.replaceState(
          history.state,
          "",
          location.pathname + location.hash,
        );
        notify("비밀번호를 변경했어요.");
        finish();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await c.refresh();
        finish();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (c.profile?.profileComplete === false) return <ProfileSetup c={c} go={go} next={next} />;
  return (
    <main className="community-auth">
      <Header
        title={
          mode === "join"
            ? "회원가입"
            : mode === "forgot"
              ? "비밀번호 찾기"
              : mode === "reset"
                ? "비밀번호 재설정"
                : "로그인"
        }
        go={go}
      />
      <div className="community-auth-content">
        <span className="community-eyebrow">VOKU On</span>
        <h1>
          {mode === "join"
            ? "반가워요. 함께 이야기해요."
            : mode === "forgot"
              ? "다시 만날 준비를 해요."
              : mode === "reset"
                ? "새 비밀번호를 설정하세요."
                : "우리의 이야기를 이어가요."}
        </h1>
        <p>
          {mode === "join"
            ? "누구나 가입할 수 있어요. 이메일 확인 후 바로 이용하세요."
            : "방송의 기억과 오늘의 안부가 모이는 곳."}
        </p>
        {!c.live && (
          <div className="community-preview-auth">
            <strong>지금은 화면 체험 중입니다</strong>
            <p>
              회원 서버 연결 전으로 실제 계정은 생성되지 않습니다. 아래 예시
              계정으로 일반 회원과 운영자의 기능을 확인할 수 있어요.
            </p>
            <div>
              <Button
                variant="secondary"
                onPress={async () => {
                  await c.previewLogin("member");
                  finish();
                }}
              >
                일반 회원으로 체험
              </Button>
              <Button
                variant="outline"
                onPress={async () => {
                  await c.previewLogin("admin");
                  go("/admin", true);
                }}
              >
                운영자로 체험
              </Button>
            </div>
          </div>
        )}
        {c.profile && mode !== "reset" && (
          <div className="community-signed-in">
            <span>
              {c.profile.nickname}님으로 {c.live ? "로그인" : "체험"} 중
            </span>
            <button onClick={() => void c.logout()}>로그아웃</button>
          </div>
        )}
        {c.live && kakaoEnabled && !c.profile && mode !== "reset" && (
          <KakaoEntry busy={busy} onPress={() => {
            setBusy(true); setError("");
            void signInWithKakao(next).catch((e) => { setError(errorText(e)); setBusy(false); });
          }} />
        )}
        {c.live && kakaoEnabled && !c.profile && !emailOpen && !c.recovery && (
          <button className="community-email-toggle" onClick={() => { setEmailOpen(true); setMode("login"); }}>기존 이메일 계정으로 로그인</button>
        )}
        {(emailOpen || c.recovery) && <>
        <form onSubmit={submit} className="community-form">
          {mode !== "reset" && (
            <TextField
              isRequired
              type="email"
              value={email}
              onChange={setEmail}
              isDisabled={!c.live}
            >
              <Label>이메일</Label>
              <Input
                autoComplete="email"
                placeholder="name@example.com"
                maxLength={254}
              />
            </TextField>
          )}
          {mode === "join" && (
            <TextField
              isRequired
              value={nickname}
              onChange={setNickname}
              isDisabled={!c.live}
            >
              <Label>닉네임</Label>
              <Input
                placeholder="한글, 영문, 숫자, 밑줄 2~16자"
                maxLength={16}
                autoComplete="nickname"
              />
            </TextField>
          )}
          {mode === "join" && (
            <AffiliationFields
              year={admissionYear}
              cohort={cohort}
              onYearChange={setAdmissionYear}
              onCohortChange={setCohort}
              disabled={!c.live || busy}
            />
          )}
          {mode !== "forgot" && (
            <TextField
              isRequired
              type="password"
              value={password}
              onChange={setPassword}
              isDisabled={!c.live}
            >
              <Label>{mode === "reset" ? "새 비밀번호" : "비밀번호"}</Label>
              <Input
                minLength={mode === "login" ? undefined : 10}
                maxLength={72}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "login" ? "비밀번호 입력" : "10자 이상 입력"
                }
              />
            </TextField>
          )}
          {(mode === "join" || mode === "reset") && (
            <TextField
              isRequired
              type="password"
              value={repeat}
              onChange={setRepeat}
              isDisabled={!c.live}
            >
              <Label>비밀번호 확인</Label>
              <Input autoComplete="new-password" maxLength={72} />
            </TextField>
          )}
          {message && (
            <p className="community-success" role="status">
              {message}
            </p>
          )}
          <ErrorLine text={error || c.error} />
          <Button fullWidth type="submit" isDisabled={!c.live || busy}>
            {busy
              ? "처리 중…"
              : mode === "join"
                ? "가입하기"
                : mode === "forgot"
                  ? "재설정 메일 받기"
                  : mode === "reset"
                    ? "비밀번호 변경"
                    : "로그인"}
          </Button>
        </form>
        <div className="community-auth-links">
          {mode !== "login" && (
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              로그인으로
            </button>
          )}
          {mode === "login" && (
            <>
              {emailSignupEnabled && <button
                onClick={() => {
                  setMode("join");
                  setError("");
                }}
              >
                회원가입
              </button>}
              <button
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                비밀번호 찾기
              </button>
            </>
          )}
        </div>
        </>}
        {!emailOpen && <ErrorLine text={error || c.error} />}
      </div>
    </main>
  );
}
