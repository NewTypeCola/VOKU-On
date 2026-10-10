import { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { AffiliationFields } from "./AffiliationFields";
import { parseAffiliation } from "./affiliation";
import { errorText } from "./client";
import { safeReturnPath } from "./oauth";
import type { Community } from "./useCommunity";

export function KakaoEntry({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return <div className="community-kakao-entry">
    <Button fullWidth className="community-kakao-button" isDisabled={busy} onPress={onPress} aria-label="카카오 로그인">
      <img src="/kakao-login.svg" alt="" aria-hidden="true" />
      {busy && <span className="community-kakao-progress" role="status">연결 중…</span>}
    </Button>
    <p>처음이라면 로그인 후 닉네임을 정해 주세요.</p>
  </div>;
}

export function ProfileSetup({ c, go, next }: { c: Community; go: (path:string, replace?:boolean)=>void; next:string }) {
  const [nickname, setNickname] = useState("");
  const [year, setYear] = useState("");
  const [cohort, setCohort] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="community-auth">
    <header className="detail-header">
      <Button variant="ghost" isIconOnly className="icon-button" aria-label="가입 설정을 나가고 로그아웃" isDisabled={busy} onPress={async()=>{await c.logout();go("/board",true);}}><ArrowLeft size={21}/></Button>
      <span>회원정보 설정</span>
    </header>
    <div className="community-auth-content">
      <span className="community-eyebrow">VOKU On</span>
      <h1>어떤 이름으로 만날까요?</h1>
      <p>커뮤니티에서 사용할 닉네임을 정해 주세요.<br/>카카오 이름·사진은 다른 회원에게 공개되지 않습니다.</p>
      <form className="community-form" onSubmit={async(e)=>{
        e.preventDefault();setBusy(true);setError("");
        try {
          if(!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(nickname.trim())) throw Error("닉네임은 한글, 영문, 숫자, 밑줄 2~16자로 입력해 주세요.");
          await c.action("profile",{nickname:nickname.trim(),...parseAffiliation(year,cohort)},"회원정보를 저장했어요.");
          go(safeReturnPath(next),true);
        } catch(e){setError(errorText(e));} finally{setBusy(false);}
      }}>
        <TextField isRequired value={nickname} onChange={setNickname} isDisabled={busy}>
          <Label>닉네임</Label><Input minLength={2} maxLength={16} autoComplete="nickname" placeholder="한글, 영문, 숫자, 밑줄 2~16자" />
        </TextField>
        <AffiliationFields year={year} cohort={cohort} onYearChange={setYear} onCohortChange={setCohort} disabled={busy}/>
        <p className="community-help">학번·기수는 선택 사항이며, 본인과 운영진만 볼 수 있습니다. 나중에 내 설정에서 바꿀 수 있어요.</p>
        {error && <p className="community-error" role="alert">{error}</p>}
        <Button type="submit" fullWidth isDisabled={busy}>{busy ? "저장 중…" : "시작하기"}</Button>
      </form>
    </div>
  </main>;
}
