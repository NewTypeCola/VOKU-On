import { studyResult } from "../ux/signals";
import { Button, SearchField } from "@heroui/react";
import { studyEnabled } from "../ux/config";
import { Check, ChevronDown, ChevronRight, FileText, Globe, LockKeyhole, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalize, type ArchiveRecord } from "../data";
import { categoryOptions, writingCategory } from "./categories";
import { composerList, composerReturn, listReturnLabel } from "./navigation";
import { api, errorText } from "./client";
import {
  CheckField,
  Dialog,
  Empty,
  ErrorLine,
  Header,
  LoginGate,
  type Base,
} from "./shared";
import { staff, suspended, type PostPhoto } from "./types";
import { POST_TITLE_LIMIT, validatePostText } from "./composerFields";
import {
  emptyPostDraft,
  readDraftText,
  readDraft,
  saveDraft,
  removeDraft,
  type PostDraft,
} from "./drafts";
import { setCommunityLeaveGuard } from "./navigationGuard";
import { Editor } from "./Editor";
import { PhotoPicker } from "./Photos";
import {
  discardPhotos,
  resolvePhotos,
  uploadPhotos,
  releasePhotoUrls,
  type DraftPhoto,
} from "./photoStorage";

export function CommunityComposer({
  c,
  go,
  notify,
  catalog,
  params,
}: Base & { catalog: ArchiveRecord[]; params: URLSearchParams }) {
  const edit = params.get("edit") || "",
    isNotice = params.get("notice") === "1";
  const returnTo = composerReturn(params, history.state?.communityReturn);
  const listPath = composerList(params, history.state?.communityReturn);
  const initialRecordId = !edit && catalog.some(record => record.id === params.get("record")) ? params.get("record")! : "";
  const backLabel = returnTo.startsWith("/read/") ? "큐시트로 돌아가기" : listReturnLabel(returnTo);
  const title = edit ? "글 수정" : isNotice ? "공지 작성" : "글쓰기";
  useEffect(() => { if (studyEnabled) studyResult("write.restricted", 2); }, []);
  if (studyEnabled) return <main className="community-writing">
    <Header title={title} go={go} onBack={() => go(returnTo, false, false, true)} backLabel={backLabel}/>
    <Empty title="UX 테스트에서는 글쓰기가 제한됩니다">
      기존 글과 큐시트는 자유롭게 둘러보실 수 있어요. 글·사진은 실제 서비스에 등록되지 않습니다.
      <Button variant="outline" onPress={() => go(returnTo, false, false, true)}>돌아가기</Button>
    </Empty>
  </main>;
  return (
    <main className="community-writing">
      {(c.loading || !c.profile || suspended(c.profile)) && (
        <Header title={title} go={go} onBack={() => go(returnTo, false, false, true)} backLabel={backLabel} />
      )}
      <LoginGate c={c} go={go}>
        <ComposerForm
          key={`${c.profile?.id}-${edit}-${initialRecordId}`}
          c={c}
          go={go}
          notify={notify}
          catalog={catalog}
          edit={edit}
          isNotice={isNotice}
          returnTo={returnTo}
          listPath={listPath}
          initialRecordId={initialRecordId}
          backLabel={backLabel}
          initialCategory={writingCategory(params.get("category"))}
          title={title}
        />
      </LoginGate>
    </main>
  );
}

function ComposerForm({
  c,
  go,
  notify,
  catalog,
  edit,
  isNotice,
  returnTo,
  listPath,
  initialRecordId,
  backLabel,
  initialCategory,
  title,
}: Base & {
  catalog: ArchiveRecord[];
  edit: string;
  isNotice: boolean;
  returnTo: string;
  listPath: string;
  initialRecordId: string;
  backLabel: string;
  initialCategory: string;
  title: string;
}) {
  const draftKey = `voku-community-draft:${c.live ? "live" : "preview"}:${c.profile!.id}:${edit || "new"}`;
  const [draft, setDraft] = useState<PostDraft>(() => ({
      ...emptyPostDraft(),
      category: initialCategory,
      recordId: initialRecordId,
      notice: isNotice && staff(c.profile),
    })),
    [attachOpen, setAttachOpen] = useState(false),
    [privacyOpen, setPrivacyOpen] = useState(false),
    [resetOpen, setResetOpen] = useState(false),
    [resetting, setResetting] = useState(false),
    [resetVersion, setResetVersion] = useState(0),
    [fieldErrors, setFieldErrors] = useState({ title: "", body: "" }),
    [query, setQuery] = useState(""),
    [attachmentLimit, setAttachmentLimit] = useState(20),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(true),
    [photoSaved, setPhotoSaved] = useState(true),
    [photoError, setPhotoError] = useState(false),
    [restored, setRestored] = useState(false),
    [offerRecord, setOfferRecord] = useState(false),
    [photos, setPhotos] = useState<DraftPhoto[]>([]),
    [originalPhotos, setOriginalPhotos] = useState<PostPhoto[]>([]),
    [preparing, setPreparing] = useState(false);
  const committed = useRef(false);
  const operation = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const submitError = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const text = readDraftText(draftKey);
      let savedDraft;
      try {
        savedDraft = await readDraft(draftKey);
      } catch {
        if (active) {
          setPhotoSaved(false);
          setError(
            "사진 임시 저장소를 열지 못했어요. 사진 첨부 내용을 확인해 주세요.",
          );
        }
      }
      const stored = text || savedDraft?.text;
      const previous =
        stored &&
        (edit ||
          stored.title ||
          stored.body ||
          stored.recordId ||
          stored.isSecret ||
          stored.notice ||
          savedDraft?.photos.length)
          ? stored
          : null;
      const post = edit ? (await api.thread(edit)).post : null;
      if (post && post.authorId !== c.profile?.id)
        throw Error("본인의 글만 수정할 수 있습니다.");
      const toRestore = savedDraft?.photos || post?.photos || [];
      const existing = await resolvePhotos(
        toRestore.filter((p) => !("file" in p && p.file instanceof Blob)),
      );
      const loaded = toRestore.map((p) =>
        "file" in p && p.file instanceof Blob
          ? { ...p, url: URL.createObjectURL(p.file) }
          : existing.find((v) => v.id === p.id)!,
      ) as DraftPhoto[];
      if (!active) {
        releasePhotoUrls(loaded);
        return;
      }
      setPhotos(loaded);
      setOriginalPhotos(post?.photos || []);
      setDraft(
        previous
          ? {
              ...previous,
              category: writingCategory(previous.category),
              ...(post
                ? {
                    isSecret: !!post.isSecret,
                    notice: post.pinned,
                    baseUpdatedAt: previous.baseUpdatedAt || post.updatedAt,
                  }
                : {}),
            }
          : post
            ? {
                title: post.title,
                body: post.body,
                category: writingCategory(post.category),
                recordId: post.recordId || "",
                bodyFormat: post.bodyFormat || "plain",
                notice: post.pinned,
                isSecret: !!post.isSecret,
                baseUpdatedAt: post.updatedAt,
              }
            : {
                ...emptyPostDraft(),
                category: initialCategory,
                recordId: initialRecordId,
                notice: isNotice && staff(c.profile),
              },
      );
      setRestored(
        !!previous &&
          (!!previous.title || !!previous.body || loaded.length > 0),
      );
      // An existing draft wins. Changing its attachment always needs a deliberate choice.
      setOfferRecord(!!previous && !!initialRecordId && previous.recordId !== initialRecordId);
      if (
        post &&
        previous?.baseUpdatedAt &&
        post.updatedAt !== previous.baseUpdatedAt
      )
        setError(
          "다른 곳에서 이 글이 수정됐어요. 임시 내용을 복사해 둔 뒤 ‘새로쓰기’로 최신 글을 불러와 주세요.",
        );
      setReady(true);
    })().catch((e) => {
      if (active) setError(errorText(e));
    }).finally(() => {
      if (active) {
        operation.current = false;
        setResetting(false);
      }
    });
    return () => {
      active = false;
    };
  }, [draftKey, edit, initialRecordId, resetVersion]);
  useEffect(() => {
    if (!ready || committed.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [draft, draftKey, ready]);
  useEffect(() => {
    if (!ready || committed.current) return;
    let active = true;
    setPhotoSaved(false);
    setPhotoError(false);
    void saveDraft(draftKey, draft, photos)
      .then(() => {
        if (active) setPhotoSaved(true);
      })
      .catch(() => {
        if (active) {
          setPhotoSaved(false);
          setPhotoError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [photos, draftKey, ready]);
  const atRisk =
    !committed.current && (busy || resetting || preparing || !saved || !photoSaved);
  useEffect(() => {
    if (!atRisk) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (committed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    const clear = setCommunityLeaveGuard(() =>
      window.confirm(
        busy
          ? "등록이 진행 중입니다. 결과를 확인하기 전에 이동하시겠어요?"
          : "아직 임시 저장을 마치지 못했어요. 지금 이동하면 최근 내용이나 사진이 사라질 수 있어요. 이동하시겠어요?",
      ),
    );
    return () => {
      window.removeEventListener("beforeunload", unload);
      clear();
    };
  }, [atRisk, busy]);
  useEffect(() => setAttachmentLimit(20), [query]);
  const attachmentResults = query.trim() ? catalog.filter((r) =>
    query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .every((q) =>
        normalize(
          `${r.title} ${r.en} ${r.year} ${r.term}학기 ${r.issue}회`,
        ).includes(normalize(q)),
      ),
  ) : [];
  const attached = catalog.find((r) => r.id === draft.recordId),
    set = (part: Partial<PostDraft>) =>
      setDraft((d: typeof draft) => ({ ...d, ...part }));
  const disabled = busy || resetting || !ready;
  const hasContent = !!(draft.title || draft.body || draft.recordId || photos.length);
  return (
    <>
      <Header title={title} go={go} onBack={() => go(returnTo, false, false, true)} backLabel={backLabel}>
        <Button
          variant="ghost"
          className="community-compose-reset"
          isDisabled={disabled || preparing}
          onPress={() => setResetOpen(true)}
        >
          새로쓰기
        </Button>
        <Button
          type="submit"
          form="community-compose-form"
          className="community-compose-submit"
          isDisabled={disabled || preparing}
        >
          {busy ? "등록 중…" : edit ? "수정 완료" : "등록"}
        </Button>
      </Header>
      <form
        id="community-compose-form"
        noValidate
        className="community-compose community-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (operation.current || disabled || preparing) return;
          const validation = validatePostText(draft.title, draft.body);
          setFieldErrors(validation);
          if (validation.title || validation.body) {
            const input = validation.title ? titleInput.current : bodyInput.current;
            input?.focus();
            input?.scrollIntoView({ block: "center" });
            return;
          }
          operation.current = true;
          setBusy(true);
          setError("");
          let uploaded: PostPhoto[] = [];
          try {
            const prepared = await uploadPhotos(photos, c.profile!.id);
            uploaded = prepared.uploaded;
            const result = await c.action(
              "post_save",
              {
                ...draft,
                photoIds: prepared.photos.map((p) => p.id),
                ...(!c.live ? { photos: prepared.photos } : {}),
                title: draft.title.trim(),
                body: draft.body.trim(),
                ...(edit
                  ? { id: edit, expectedUpdatedAt: draft.baseUpdatedAt }
                  : {}),
              },
              edit ? "글을 수정했어요." : "글을 등록했어요.",
            );
            committed.current = true;
            await removeDraft(draftKey).catch(() => {
              try {
                localStorage.removeItem(draftKey);
              } catch {
                /* Publishing succeeded; never roll back attached photos for a local cleanup error. */
              }
            });
            const removed = originalPhotos.filter(
              (p) => !prepared.photos.some((next) => next.id === p.id),
            );
            void discardPhotos(removed).catch(() => {});
            setCommunityLeaveGuard(null);
            go(
              "/post/" +
                result.postId +
                "?list=" +
                encodeURIComponent(listPath),
              true,
            );
          } catch (e) {
            await discardPhotos(uploaded).catch(() => {});
            setError(errorText(e));
            requestAnimationFrame(() => submitError.current?.focus());
          } finally {
            operation.current = false;
            setBusy(false);
          }
        }}
      >
        <div className="community-compose-feedback" ref={submitError} tabIndex={-1}>
          <ErrorLine text={error} />
          {!ready && !resetting && error && (
            <Button variant="outline" onPress={() => { setError(""); setResetVersion((n) => n + 1); }}>다시 불러오기</Button>
          )}
          {(!saved || photoError) && (
            <ErrorLine text="최근 내용을 임시 저장하지 못했어요. 화면을 닫기 전에 글을 등록하거나 내용을 복사해 주세요." />
          )}
        </div>
        <fieldset disabled={disabled} className="community-compose-fields">
          {offerRecord && <div className="community-compose-record-offer" role="status">
            <p>작성 중이던 글을 보관하고 있어요. 방금 읽은 <strong>{catalog.find(record => record.id === initialRecordId)?.title} {catalog.find(record => record.id === initialRecordId)?.issue}회</strong>를 이 글에 연결할까요?</p>
            <div>
              <Button variant="outline" onPress={() => { set({ recordId: initialRecordId }); setOfferRecord(false); }}>이 큐시트 연결</Button>
              <Button variant="ghost" onPress={() => setOfferRecord(false)}>기존 글 계속 쓰기</Button>
            </div>
          </div>}
          <div className="community-compose-context">
            <div className="community-compose-category">
              <select
                aria-label="말머리"
                value={draft.category}
                onChange={(event) => set({ category: event.target.value })}
              >
                {categoryOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </div>
            <Button variant="ghost" className="community-compose-privacy" onPress={() => setPrivacyOpen(true)}>
              {draft.isSecret ? <LockKeyhole size={16} /> : <Globe size={16} />}
              {draft.isSecret ? "비밀글" : draft.notice ? "공개 공지" : "공개글"}
              <ChevronDown size={15} />
            </Button>
          </div>
          {draft.isSecret && <p className="community-compose-secret">작성자와 기존 운영진만 읽을 수 있어요.</p>}
          {restored && (
            <div className="community-compose-restored" role="status">
              <span>작성 중이던 내용을 복원했어요.</span>
              <Button isIconOnly variant="ghost" aria-label="복원 안내 닫기" onPress={() => setRestored(false)}><X size={16} /></Button>
            </div>
          )}
          <div className="community-compose-title">
            <label htmlFor="community-post-title">제목</label>
            <input
              id="community-post-title"
              ref={titleInput}
              required
              value={draft.title}
              onChange={(event) => {
                set({ title: event.target.value });
                setFieldErrors((previous) => ({ ...previous, title: "" }));
              }}
              maxLength={POST_TITLE_LIMIT}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? "community-post-title-error" : undefined}
              placeholder="어떤 이야기를 나눌까요?"
            />
            {fieldErrors.title && <p id="community-post-title-error" className="community-error" role="alert">{fieldErrors.title}</p>}
            {draft.title.length >= POST_TITLE_LIMIT * 0.9 && <p className="community-compose-count">{draft.title.length} / {POST_TITLE_LIMIT}자</p>}
          </div>
          <Editor
            body={draft.body}
            change={(body) => {
              set({ body });
              setFieldErrors((previous) => ({ ...previous, body: "" }));
            }}
            disabled={disabled}
            area={bodyInput}
            error={fieldErrors.body}
          />
          <PhotoPicker
            photos={photos}
            change={setPhotos}
            disabled={disabled || preparing}
            preparing={setPreparing}
          >
            <Button variant="ghost" isDisabled={disabled || preparing} onPress={() => { setQuery(""); setAttachOpen(true); }}>
              <FileText size={17} />
              {attached ? "큐시트 변경" : "큐시트 연결"}
            </Button>
          </PhotoPicker>
          {attached && (
            <div className="community-attached">
              <FileText size={18} />
              <span><strong>{attached.title} {attached.issue}회</strong><small>{attached.year}년 {attached.term}학기 · {attached.pages}쪽</small></span>
              <Button variant="ghost" isIconOnly aria-label="첨부 큐시트 해제" onPress={() => set({ recordId: "" })}><X size={17} /></Button>
            </div>
          )}
        </fieldset>
        {(hasContent || busy || preparing || !ready) && (
          <p className="community-compose-status" role="status">
            {!ready ? "작성 내용을 불러오는 중…" : busy ? "사진과 글을 등록하고 있어요…" : preparing ? "사진을 준비하고 있어요…" : !saved || photoError ? "임시 저장 실패 · 위 안내를 확인해 주세요." : photoSaved ? "이 기기에 자동 저장됨" : "임시 저장 중…"}
          </p>
        )}
        {!c.live && <p className="community-help">체험 글은 이 브라우저에만 저장됩니다.</p>}
      </form>
      <Dialog title="새로쓰기" open={resetOpen} close={() => { if (!resetting) setResetOpen(false); }}>
        <p>{edit ? "수정 중인 내용과 새로 첨부한 사진을 지우고, 등록된 글을 다시 불러올까요?" : "작성 중인 글과 첨부 사진을 지우고 새로 시작할까요?"}</p>
        <p className="community-help">지운 임시 내용은 복구할 수 없어요.</p>
        <div className="community-dialog-actions">
          <Button variant="outline" isDisabled={resetting} onPress={() => setResetOpen(false)}>계속 쓰기</Button>
          <Button isDisabled={resetting || preparing || busy} onPress={async () => {
            if (operation.current || preparing || busy) return;
            operation.current = true;
            setResetting(true);
            setReady(false);
            try {
              await removeDraft(draftKey);
              releasePhotoUrls(photos);
              setPhotos([]);
              setFieldErrors({ title: "", body: "" });
              setError("");
              setRestored(false);
              setResetOpen(false);
              setResetVersion((n) => n + 1);
            } catch {
              operation.current = false;
              setResetting(false);
              setReady(true);
              setResetOpen(false);
              setError("임시 내용을 지우지 못했어요. 다시 시도해 주세요.");
            }
          }}>{resetting ? "준비 중…" : edit ? "등록된 글 불러오기" : "새로 시작"}</Button>
        </div>
      </Dialog>
      <Dialog title="공개 범위" open={privacyOpen} close={() => setPrivacyOpen(false)}>
        <div className="community-compose-visibility">
          {edit ? (
            <p>{draft.isSecret ? "비밀글 · 작성자와 기존 운영진만 열람" : "공개글 · 누구나 열람"}</p>
          ) : (
            <>
              <button type="button" aria-pressed={!draft.isSecret} onClick={() => { set({ isSecret: false }); setPrivacyOpen(false); }}>
                <Globe size={19} /><span><strong>공개글</strong><small>누구나 읽을 수 있어요.</small></span>{!draft.isSecret && <Check size={18} />}
              </button>
              <button type="button" disabled={draft.notice} aria-pressed={draft.isSecret} onClick={() => { set({ isSecret: true }); setPrivacyOpen(false); }}>
                <LockKeyhole size={19} /><span><strong>비밀글</strong><small>{draft.notice ? "공지는 공개글로 등록됩니다." : "작성자와 기존 운영진만 읽을 수 있어요."}</small></span>{draft.isSecret && <Check size={18} />}
              </button>
              {staff(c.profile) && <CheckField checked={draft.notice} change={(notice) => set({ notice, isSecret: notice ? false : draft.isSecret })}>공지로 등록하고 목록 위에 고정</CheckField>}
            </>
          )}
          <p className="community-help">공개 범위는 등록 후 변경할 수 없어요.</p>
        </div>
      </Dialog>
      <Dialog
        title="함께 읽을 큐시트"
        open={attachOpen}
        close={() => setAttachOpen(false)}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          aria-label="연도 또는 프로그램 검색"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input autoFocus placeholder="연도 또는 프로그램 이름" />
            <SearchField.ClearButton aria-label="검색어 지우기" />
          </SearchField.Group>
        </SearchField>
        <div className="community-attachment-results">
          {attachmentResults.slice(0, attachmentLimit).map((r) => (
            <button
              key={r.id}
              onClick={() => {
                set({ recordId: r.id });
                setAttachOpen(false);
              }}
            >
              <span>
                <strong>
                  {r.title} {r.issue}회
                </strong>
                <small>
                  {r.year}년 {r.term}학기 · {r.pages}쪽
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {attachmentResults.length > attachmentLimit && (
            <Button
              variant="ghost"
              fullWidth
              onPress={() => setAttachmentLimit((n) => n + 20)}
            >
              더 보기 ({attachmentLimit} / {attachmentResults.length})
            </Button>
          )}
          {!query.trim() ? (
            <p className="community-attachment-hint">함께 읽을 자료의 연도나 프로그램 이름을 입력해 주세요.</p>
          ) : !attachmentResults.length && <Empty title="검색 결과가 없어요" />}
        </div>
      </Dialog>
    </>
  );
}
