import { Button, Input, Label, TextField } from "@heroui/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { dateLabel } from "../data";
import { AffiliationFields } from "./AffiliationFields";
import { parseAffiliation } from "./affiliation";
import { authScreenPath } from "./authFlow";
import { errorText } from "./client";
import { setCommunityLeaveGuard } from "./navigationGuard";
import { ErrorLine, type Base } from "./shared";
import { suspended } from "./types";

export function ProfileSettings({ c, go, list }: Pick<Base, "c" | "go"> & { list: string }) {
  const profile = c.profile!;
  const original = { nickname: profile.nickname, year: String(profile.admissionYear || ""), cohort: String(profile.cohort || "") };
  const originalRef = useRef(original);
  originalRef.current = original;
  const [values, setValues] = useState(original);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = values.nickname.trim() !== original.nickname || values.year.trim() !== original.year || values.cohort.trim() !== original.cohort;
  const risk = useRef({ dirty, busy });
  useLayoutEffect(() => { risk.current = { dirty, busy }; }, [dirty, busy]);
  // A background refresh must not replace an unfinished edit.
  const baseline = useRef(original);
  useLayoutEffect(() => {
    const previous = baseline.current;
    baseline.current = original;
    setValues(current => current.nickname.trim() === previous.nickname && current.year.trim() === previous.year && current.cohort.trim() === previous.cohort ? original : current);
  }, [original.nickname, original.year, original.cohort]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (risk.current.dirty || risk.current.busy) { event.preventDefault(); event.returnValue = ""; }
    };
    const clear = setCommunityLeaveGuard(() => {
      if (risk.current.busy) return false;
      if (!risk.current.dirty) return true;
      if (!window.confirm("저장하지 않은 회원정보가 있어요. 변경을 취소하고 이동할까요?")) return false;
      risk.current.dirty = false;
      setValues(originalRef.current);
      return true;
    });
    window.addEventListener("beforeunload", unload);
    return () => { clear(); window.removeEventListener("beforeunload", unload); };
  }, []);
  const update = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  return <>
    <form className="community-form community-settings" aria-label="프로필 정보" onSubmit={async event => {
      event.preventDefault();
      if (risk.current.busy || !dirty) return;
      risk.current.busy = true; setBusy(true); setError("");
      try {
        const payload = { nickname: values.nickname.trim(), ...parseAffiliation(values.year, values.cohort) };
        await c.action("profile", payload, "회원정보를 저장했어요.");
        risk.current.dirty = false;
        setValues({ nickname: payload.nickname, year: String(payload.admissionYear || ""), cohort: String(payload.cohort || "") });
      } catch (e) { setError(errorText(e)); }
      finally { risk.current.busy = false; setBusy(false); }
    }}>
      <h2>프로필 정보</h2>
      <TextField isRequired value={values.nickname} onChange={value => update("nickname", value)} isDisabled={busy || suspended(profile)}>
        <Label>닉네임</Label><Input minLength={2} maxLength={16} autoComplete="nickname" />
      </TextField>
      <AffiliationFields year={values.year} cohort={values.cohort} onYearChange={value => update("year", value)} onCohortChange={value => update("cohort", value)} disabled={busy || suspended(profile)} />
      <ErrorLine text={error} />
      <div className="personal-form-actions">
        <Button variant="outline" isDisabled={busy || !dirty} onPress={() => { setValues(original); setError(""); }}>변경 취소</Button>
        <Button type="submit" isDisabled={busy || !dirty || suspended(profile)}>{busy ? "저장 중…" : "회원정보 저장"}</Button>
      </div>
      <p className="community-help" role="status">{dirty ? "아직 저장하지 않은 변경사항이 있어요." : "현재 저장된 회원정보입니다."}</p>
    </form>
    <section className="personal-login-info" aria-labelledby="personal-login-heading">
      <h2 id="personal-login-heading">로그인 정보</h2>
      <dl>
        <div><dt>로그인 방법</dt><dd>{profile.providers.map(provider => ({ kakao: "카카오", google: "Google", email: "이메일" })[provider] || provider).join(" · ") || (c.live ? "연결된 계정" : "체험 계정")}</dd></div>
        {c.account?.email && <div><dt>이메일</dt><dd>{c.account.email}</dd></div>}
        <div><dt>가입일</dt><dd>{dateLabel(profile.joinedAt)}</dd></div>
      </dl>
      {c.live && profile.providers.includes("email") && <Button variant="outline" onPress={() => go(authScreenPath("forgot", list, list))}>비밀번호 재설정</Button>}
    </section>
  </>;
}
