import { Button, Input, Label, TextArea, TextField } from "@heroui/react";
import { Camera } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { dateLabel } from "../data";
import { AffiliationFields } from "./AffiliationFields";
import { parseAffiliation } from "./affiliation";
import { authScreenPath } from "./authFlow";
import { errorText } from "./client";
import { ProfileAvatar } from "./ProfileAvatar";
import { normalizeIntroduction, PROFILE_INTRODUCTION_LIMIT } from "./profilePhoto";
import { prepareProfilePhoto } from "./prepareProfilePhoto";
import { discardProfilePhoto, uploadProfilePhoto } from "./profilePhotoStorage";
import { setCommunityLeaveGuard } from "./navigationGuard";
import { ErrorLine, type Base } from "./shared";
import { suspended } from "./types";
import "./profile.css";

export function ProfileSettings({ c, go, list }: Pick<Base, "c" | "go"> & { list: string }) {
  const profile = c.profile!;
  const detailsReady = !c.live || typeof profile.introduction === "string";
  const original = { nickname: profile.nickname, year: String(profile.admissionYear || ""), cohort: String(profile.cohort || ""), introduction: profile.introduction || "" };
  const originalRef = useRef(original);
  originalRef.current = original;
  const [values, setValues] = useState(original);
  const [photo, setPhoto] = useState<Blob | null | undefined>();
  const [photoPreview, setPhotoPreview] = useState("");
  const [preparing, setPreparing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploaded = useRef<{ file: Blob; path: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = photo !== undefined || values.nickname.trim() !== original.nickname || values.year.trim() !== original.year || values.cohort.trim() !== original.cohort || values.introduction.trim() !== original.introduction;
  const risk = useRef({ dirty, busy });
  useLayoutEffect(() => { risk.current = { dirty, busy }; }, [dirty, busy]);
  // A background refresh must not replace an unfinished edit.
  const baseline = useRef(original);
  useLayoutEffect(() => {
    const previous = baseline.current;
    baseline.current = original;
    setValues(current => current.nickname.trim() === previous.nickname && current.year.trim() === previous.year && current.cohort.trim() === previous.cohort && current.introduction.trim() === previous.introduction ? original : current);
  }, [original.nickname, original.year, original.cohort, original.introduction]);
  useEffect(() => {
    if (!photo) { setPhotoPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (risk.current.dirty || risk.current.busy) { event.preventDefault(); event.returnValue = ""; }
    };
    const clear = setCommunityLeaveGuard(() => {
      if (risk.current.busy) return false;
      if (!risk.current.dirty) return true;
      if (!window.confirm("저장하지 않은 프로필 변경사항이 있어요. 변경을 취소하고 이동할까요?")) return false;
      risk.current.dirty = false;
      setValues(originalRef.current);
      setPhoto(undefined);
      return true;
    });
    window.addEventListener("beforeunload", unload);
    return () => { clear(); window.removeEventListener("beforeunload", unload); };
  }, []);
  const update = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  const currentPhoto = photo === undefined ? c.account?.avatarUrl : photo ? photoPreview : null;
  return <>
    <form className="community-form community-settings" aria-label="프로필 정보" onSubmit={async event => {
      event.preventDefault();
      if (risk.current.busy || !dirty) return;
      risk.current.busy = true; setBusy(true); setError("");
      try {
        const payload: { nickname: string; introduction?: string; admissionYear: number | null; cohort: number | null; avatarPath?: string | null } = {
          nickname: values.nickname.trim(), ...parseAffiliation(values.year, values.cohort), ...(detailsReady ? { introduction: normalizeIntroduction(values.introduction) } : {}),
        };
        const oldPhoto = profile.avatarPath;
        if (photo === null) payload.avatarPath = null;
        if (photo) {
          if (uploaded.current?.file !== photo) uploaded.current = { file: photo, path: await uploadProfilePhoto(photo, profile.id) };
          payload.avatarPath = uploaded.current.path;
        }
        await c.action("profile", payload, "프로필을 저장했어요.");
        risk.current.dirty = false;
        setValues({ nickname: payload.nickname, year: String(payload.admissionYear || ""), cohort: String(payload.cohort || ""), introduction: payload.introduction || "" });
        setPhoto(undefined); uploaded.current = null;
        if ("avatarPath" in payload && oldPhoto && oldPhoto !== payload.avatarPath) void discardProfilePhoto(oldPhoto).catch(() => {});
      } catch (e) { setError(errorText(e)); }
      finally { risk.current.busy = false; setBusy(false); }
    }}>
      <section className="profile-edit-section" aria-labelledby="profile-photo-heading">
        <h2 id="profile-photo-heading">프로필 사진</h2>
        <div className="profile-photo-field">
          <ProfileAvatar nickname={values.nickname} url={currentPhoto} label="선택한 프로필 사진" className="profile-photo-preview" />
          <div className="profile-photo-actions">
            <Button variant="outline" isDisabled={!detailsReady || busy || suspended(profile)} onPress={() => fileInput.current?.click()}><Camera size={17} aria-hidden="true" />{currentPhoto ? "사진 변경" : "사진 선택"}</Button>
            {currentPhoto && <Button variant="ghost" isDisabled={!detailsReady || busy || suspended(profile)} onPress={() => { setPhoto(null); setError(""); }}>사진 삭제</Button>}
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="프로필 사진 파일" onChange={async event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
            if (!file || risk.current.busy) return;
            risk.current.busy = true; setBusy(true); setPreparing(true); setError("");
            try { setPhoto(await prepareProfilePhoto(file)); }
            catch (e) { setError(errorText(e)); }
            finally { risk.current.busy = false; setBusy(false); setPreparing(false); }
          }} />
        </div>
        <p className="profile-photo-caption">게시글의 작성자 사진으로도 공개돼요.<span>JPG·PNG·WebP · 최대 15MB<br />사진의 가운데 부분이 표시됩니다.</span></p>
        {!detailsReady && <p className="community-help">사진과 소개 설정을 준비 중입니다.</p>}
      </section>
      <section className="profile-edit-section" aria-labelledby="profile-basics-heading">
        <h2 id="profile-basics-heading">기본 정보</h2>
        <TextField isRequired value={values.nickname} onChange={value => update("nickname", value)} isDisabled={busy || suspended(profile)}>
          <Label>닉네임</Label><Input minLength={2} maxLength={16} autoComplete="nickname" />
        </TextField>
        <AffiliationFields year={values.year} cohort={values.cohort} onYearChange={value => update("year", value)} onCohortChange={value => update("cohort", value)} disabled={busy || suspended(profile)} />
      </section>
      <section className="profile-edit-section profile-edit-introduction" aria-label="소개 편집">
        <TextField value={values.introduction} onChange={value => update("introduction", value)} isDisabled={!detailsReady || busy || suspended(profile)}>
          <Label>소개 <span className="profile-field-optional">선택 · 나만 보기</span></Label>
          <TextArea rows={4} maxLength={PROFILE_INTRODUCTION_LIMIT} placeholder="방송국에서 맡았던 일, 기억나는 프로그램이나 요즘 근황을 적어보세요." aria-describedby="profile-introduction-help" />
          <div className="profile-field-help" id="profile-introduction-help"><span>내 프로필에서만 보여요.</span><span>{values.introduction.length}/{PROFILE_INTRODUCTION_LIMIT}자</span></div>
        </TextField>
      </section>
      <div className="profile-edit-save">
        <ErrorLine text={error} />
        <div className="personal-form-actions">
          <Button variant="outline" isDisabled={busy || !dirty} onPress={() => { setValues(original); setPhoto(undefined); setError(""); }}>변경 취소</Button>
          <Button type="submit" isDisabled={busy || !dirty || suspended(profile)}>{busy ? preparing ? "사진 준비 중…" : "저장 중…" : "프로필 저장"}</Button>
        </div>
        <p className="community-help" role="status">{dirty ? "아직 저장하지 않은 변경사항이 있어요." : "현재 저장된 프로필입니다."}</p>
      </div>
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
