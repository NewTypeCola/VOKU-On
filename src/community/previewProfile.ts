import { parseAffiliation } from "./affiliation";
import { normalizeIntroduction, profilePhotoUrl } from "./profilePhoto";
import type { Profile } from "./types";

// This adapter is loaded only when editing the isolated preview profile.
export function savePreviewProfile(m: Profile, members: Profile[], d: Record<string, any>, persist: () => void) {
      if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(d.nickname))
        throw Error("닉네임은 한글, 영문, 숫자, 밑줄 2~16자로 입력해 주세요.");
      if (
        members.some(
          (x) =>
            x.id !== m.id &&
            x.nickname.toLowerCase() === d.nickname.toLowerCase(),
        )
      )
        throw Error("이미 사용 중인 닉네임입니다.");
      const affiliation = parseAffiliation(
        String(
          ("admissionYear" in d ? d.admissionYear : m.admissionYear) ?? "",
        ),
        String(("cohort" in d ? d.cohort : m.cohort) ?? ""),
      );
      const introduction = "introduction" in d ? normalizeIntroduction(String(d.introduction ?? "")) : m.introduction || "";
      if (d.avatarPath && !profilePhotoUrl(d.avatarPath, "")) throw Error("프로필 사진을 다시 선택해 주세요.");
      const previous = { ...m };
      Object.assign(m, affiliation, { nickname: d.nickname, introduction }, "avatarPath" in d ? { avatarPath: d.avatarPath, avatarCustomized: true } : {});
      try { persist(); }
      catch { delete m.avatarPath; delete m.avatarCustomized; delete m.introduction; Object.assign(m, previous); throw Error("이 브라우저의 저장 공간이 부족해요. 사진 용량을 줄여 다시 시도해 주세요."); }
}
