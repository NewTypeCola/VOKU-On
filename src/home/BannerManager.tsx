import { Button } from "@heroui/react";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorText } from "../community/client";
import { Dialog, Empty, ErrorLine, LoadState, useLoad, type Base } from "../community/shared";
import { setCommunityLeaveGuard } from "../community/navigationGuard";
import { bannerTarget, MAX_HOME_BANNERS, type ResolvedBanner } from "./banner";
import { discardBannerImage, loadBannerAdmin, saveBannerAction, uploadBannerImage } from "./bannerAdminClient";
import { prepareBannerImage } from "./prepareBannerImage";
import "./bannerAdmin.css";

export function BannerManager({ c, notify }: Base) {
  const state = useLoad(() => loadBannerAdmin(), [c.profile?.id, c.profile?.role], c.revision);
  const [editing, setEditing] = useState<ResolvedBanner | "new" | null>(null);
  const [removing, setRemoving] = useState<ResolvedBanner | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const list = state.data || [];
  const blocked = busy || state.loading || state.refreshing;
  async function run(fn: () => Promise<void>, message: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await fn(); notify(message); state.retry(); }
    catch (e) { setError(errorText(e)); state.retry(); }
    finally { pending.current = false; setBusy(false); }
  }
  const move = (index: number, step: number) => {
    const order = [...list]; [order[index], order[index+step]] = [order[index+step], order[index]];
    void run(() => saveBannerAction("reorder", { order: order.map(({id,version}) => ({id,version})) }), "배너 순서를 바꿨어요.");
  };
  return <section className="banner-manager" aria-label="홈 배너 관리">
    <div className="banner-manager-heading"><div><h2>홈 이미지 배너</h2><p>등록 {list.length} / {MAX_HOME_BANNERS}개 · 노출 {list.filter(b => b.enabled).length}개</p></div>
      <Button size="sm" isDisabled={blocked || !!state.error || list.length >= MAX_HOME_BANNERS} onPress={() => setEditing("new")}><Plus size={17} />배너 추가</Button></div>
    <p className="banner-manager-help">위에서부터 홈에 표시됩니다. 노출할 배너가 없으면 기존의 빈 배너 영역을 유지합니다.</p>
    <LoadState state={state} /><ErrorLine text={error} />
    {state.data && !state.error && (list.length ? <ol className="banner-manager-list">{list.map((banner,index) => <li key={banner.id}>
      <div className="banner-manager-image"><img src={banner.src} alt={banner.title} /></div>
      <div className="banner-manager-title"><strong>{index+1}. {banner.title}</strong><span className={banner.enabled ? "is-enabled" : ""}>{banner.enabled ? "노출 중" : "숨김"}</span></div>
      <p className="banner-manager-link">{banner.link || "연결 주소 없음"}</p>
      <div className="banner-manager-actions">
        <Button size="sm" variant="outline" isDisabled={blocked} onPress={() => setEditing(banner)}><Pencil size={15} />수정</Button>
        <Button size="sm" variant="outline" isDisabled={blocked} onPress={() => void run(() => saveBannerAction("save", { ...banner, enabled: !banner.enabled }), banner.enabled ? "홈에서 배너를 숨겼어요." : "홈에 배너를 노출했어요.")}>{banner.enabled ? "숨기기" : "노출하기"}</Button>
        <div className="banner-manager-order"><Button isIconOnly size="sm" variant="ghost" aria-label={`${banner.title} 위로 이동`} isDisabled={blocked || index===0} onPress={() => move(index,-1)}><ArrowUp size={18} /></Button>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`${banner.title} 아래로 이동`} isDisabled={blocked || index===list.length-1} onPress={() => move(index,1)}><ArrowDown size={18} /></Button>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`${banner.title} 삭제`} isDisabled={blocked} onPress={() => setRemoving(banner)}><Trash2 size={17} /></Button></div>
      </div>
    </li>)}</ol> : <Empty title="등록된 배너가 없어요">배너 추가에서 이미지를 선택하고 미리 확인해 보세요.</Empty>)}
    {editing && <BannerEditor key={typeof editing === "string" ? "new" : editing.id} banner={editing === "new" ? undefined : editing} owner={c.profile!.id}
      close={() => setEditing(null)} saved={() => { setEditing(null); setError(""); state.retry(); notify("배너를 저장했어요."); }} />}
    <Dialog title="배너 삭제" open={!!removing} close={() => { if (!busy) setRemoving(null); }}>
      <p>‘{removing?.title}’ 배너를 삭제할까요? 홈에서도 내려가며 다시 사용하려면 새로 등록해야 합니다.</p>
      <ErrorLine text={error} /><div className="community-dialog-actions"><Button variant="outline" isDisabled={busy} onPress={() => setRemoving(null)}>취소</Button>
        <Button isDisabled={busy} onPress={() => { if (removing) void run(async () => {
          await saveBannerAction("remove", { id: removing.id, version: removing.version });
          await discardBannerImage(removing.imagePath).catch(() => {}); setRemoving(null);
        }, "배너를 삭제했어요."); }}>{busy ? "삭제 중…" : "삭제"}</Button></div>
    </Dialog>
  </section>;
}

function BannerEditor({ banner, owner, close, saved }: { banner?: ResolvedBanner; owner: string; close: () => void; saved: () => void }) {
  const [title, setTitle] = useState(banner?.title || "");
  const [link, setLink] = useState(banner?.link || "");
  const [enabled, setEnabled] = useState(banner?.enabled || false);
  const [photo, setPhoto] = useState<{ file: Blob; width: number; height: number; src: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const input = useRef<HTMLInputElement>(null), pending = useRef(false), mounted = useRef(true);
  const done = useRef(false);
  const dirty = !!photo || title !== (banner?.title || "") || link !== (banner?.link || "") || enabled !== (banner?.enabled || false);
  const confirmLeave = () => done.current || (!pending.current && (!dirty || window.confirm("저장하지 않은 배너 변경을 취소할까요?")));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.src); }, [photo]);
  useEffect(() => {
    if (!dirty && !busy && !preparing) return;
    const unload = (e: BeforeUnloadEvent) => { if (!done.current) { e.preventDefault(); e.returnValue = ""; } };
    const clear = setCommunityLeaveGuard(confirmLeave); window.addEventListener("beforeunload",unload);
    return () => { clear(); window.removeEventListener("beforeunload",unload); };
  }, [dirty,busy,preparing]);
  async function choose(file?: File) {
    if (!file || pending.current) return;
    pending.current = true; setPreparing(true); setError("");
    try { const prepared = await prepareBannerImage(file); if (mounted.current) setPhoto({ ...prepared, src: URL.createObjectURL(prepared.file) }); }
    catch(e) { if (mounted.current) setError(errorText(e)); }
    finally { pending.current = false; if (mounted.current) setPreparing(false); }
  }
  async function submit() {
    if (pending.current) return;
    let uploaded = "", committed = false;
    pending.current = true; setBusy(true); setError("");
    try {
      const name = title.trim();
      if (!name || name.length>80) throw Error("배너 제목은 1~80자로 입력해 주세요.");
      const target = bannerTarget(link, location.origin);
      if (!photo && !banner) throw Error("배너 이미지를 선택해 주세요.");
      if (photo) uploaded = await uploadBannerImage(photo.file,owner);
      await saveBannerAction("save", { id: banner?.id, version: banner?.version, title: name, link: target,
        imagePath: uploaded || banner!.imagePath, width: photo?.width || banner!.width, height: photo?.height || banner!.height, enabled });
      committed = true; done.current = true;
      if (uploaded && banner) await discardBannerImage(banner.imagePath).catch(() => {});
      if (mounted.current) saved();
    } catch(e) {
      if (uploaded && !committed) await discardBannerImage(uploaded).catch(() => {});
      if (mounted.current) setError(errorText(e));
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <Dialog title={banner ? "배너 수정" : "배너 추가"} open close={() => { if (confirmLeave()) close(); }} className="banner-editor-dialog">
    <form className="banner-editor" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div className="banner-editor-preview">{photo || banner ? <img src={photo?.src || banner!.src} alt={title || "배너 미리보기"} /> : <span><ImagePlus size={26} />이미지를 선택해 주세요</span>}</div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy || preparing} onChange={e => { const file=e.target.files?.[0]; e.target.value=""; void choose(file); }} />
      <Button variant="outline" isDisabled={busy || preparing} onPress={() => input.current?.click()}><ImagePlus size={18} />{preparing ? "이미지 준비 중…" : photo || banner ? "이미지 바꾸기" : "이미지 선택"}</Button>
      <p className="banner-manager-help">가로 2:1 권장 · 예: 1600×800px<br />JPG·PNG·WebP, 최대 15MB. 전체 이미지가 보이도록 용량을 줄여 저장합니다.</p>
      <label>배너 제목<input autoComplete="off" required maxLength={80} placeholder="예: VOKU On 이용 안내" value={title} disabled={busy || preparing} onChange={e => setTitle(e.target.value)} /></label>
      <p className="banner-field-help">관리 목록과 화면 읽기 안내에 사용합니다. 이미지 위에 덧붙이지 않습니다.</p>
      <label>연결 주소 <small>선택</small><input type="text" inputMode="url" autoCapitalize="none" autoComplete="off" maxLength={1000} placeholder="게시글 주소 또는 https://…" value={link} disabled={busy || preparing} onChange={e => setLink(e.target.value)} /></label>
      <p className="banner-field-help">비워 두면 이미지로만 표시합니다. 외부 사이트는 새 창으로 열립니다.</p>
      <label className="banner-editor-enabled"><input type="checkbox" checked={enabled} disabled={busy || preparing} onChange={e => setEnabled(e.target.checked)} />홈에 노출하기</label>
      <p className="banner-field-help">{enabled ? "저장하면 모든 방문자의 홈에 표시됩니다." : "숨김 상태로 저장해 두고 나중에 노출할 수 있습니다."}</p>
      <ErrorLine text={error} /><div className="community-dialog-actions"><Button variant="outline" isDisabled={busy || preparing} onPress={() => { if (confirmLeave()) close(); }}>취소</Button>
        <Button type="submit" isDisabled={busy || preparing}>{busy ? "저장 중…" : "저장"}</Button></div>
    </form>
  </Dialog>;
}
