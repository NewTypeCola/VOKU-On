import { useState } from "react";
import { Button } from "@heroui/react";
import { KakaoEntry } from "../community/KakaoAuth";
import { Header, type Base } from "../community/shared";
import { safeReturnPath } from "../community/oauth";

export function StudyMemberAuth({ c, go, params }: Base & { params: URLSearchParams }) {
  const next = safeReturnPath(params.get("next") || "/board");
  const back = safeReturnPath(params.get("back") || next);
  const [busy, setBusy] = useState(false);
  const login = async () => {
    if (busy) return;
    setBusy(true);
    try { await c.studyLogin(); go(next, true, false, true); } finally { setBusy(false); }
  };
  return <main className="community-auth auth-renewed">
    <Header title="로그인" go={go} onBack={() => go(back, true, false, true)} backLabel="원래 화면으로 돌아가기" />
    <div className="community-auth-content">
      <span className="community-eyebrow">UX 테스트 버전</span>
      <h1>{c.profile ? "체험 회원님, 반가워요." : "가볍게 둘러보세요."}</h1>
      <p>카카오 버튼을 누르면 체험 회원으로 바로 들어갑니다. 실제 카카오 로그인이나 회원가입은 진행하지 않아요.</p>
      {c.profile ? <Button fullWidth onPress={() => go(next, true, false, true)}>이어서 이용하기</Button> :
        <KakaoEntry busy={busy || c.loading} connecting={busy} onPress={() => void login()} />}
      <p className="auth-method-help">글·댓글 등록과 업로드는 제한됩니다.<br />추천·스크랩은 현재 탭에서만 체험할 수 있어요.</p>
    </div>
  </main>;
}
