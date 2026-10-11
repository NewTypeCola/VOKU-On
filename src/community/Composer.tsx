import { Button, Input, Label, SearchField, TextField } from "@heroui/react";
import { ChevronRight, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalize, type ArchiveRecord } from "../data";
import { categoryOptions } from "./categories";
import { api, errorText } from "./client";
import {
  CheckField,
  Choice,
  Dialog,
  Empty,
  ErrorLine,
  Header,
  LoginGate,
  type Base,
} from "./shared";
import { staff, type PostPhoto } from "./types";
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
  return (
    <main>
      <Header
        title={edit ? "글 수정" : isNotice ? "공지 작성" : "글쓰기"}
        go={go}
      />
      <LoginGate c={c} go={go}>
        <ComposerForm
          key={`${c.profile?.id}-${edit}`}
          c={c}
          go={go}
          notify={notify}
          catalog={catalog}
          edit={edit}
          isNotice={isNotice}
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
}: Base & { catalog: ArchiveRecord[]; edit: string; isNotice: boolean }) {
  const draftKey = `voku-community-draft:${c.live ? "live" : "preview"}:${c.profile!.id}:${edit || "new"}`;
  const [draft, setDraft] = useState<PostDraft>(() => ({
      ...emptyPostDraft(),
      notice: isNotice && staff(c.profile),
    })),
    [attachOpen, setAttachOpen] = useState(false),
    [query, setQuery] = useState(""),
    [attachmentLimit, setAttachmentLimit] = useState(20),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(true),
    [photoSaved, setPhotoSaved] = useState(true),
    [photoError, setPhotoError] = useState(false),
    [restored, setRestored] = useState(false),
    [photos, setPhotos] = useState<DraftPhoto[]>([]),
    [originalPhotos, setOriginalPhotos] = useState<PostPhoto[]>([]),
    [preparing, setPreparing] = useState(false);
  const committed = useRef(false);
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
      const previous = text || savedDraft?.text;
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
                category: post.category,
                recordId: post.recordId || "",
                bodyFormat: post.bodyFormat || "plain",
                notice: post.pinned,
                isSecret: !!post.isSecret,
                baseUpdatedAt: post.updatedAt,
              }
            : { ...emptyPostDraft(), notice: isNotice && staff(c.profile) },
      );
      setRestored(
        !!previous &&
          (!!previous.title || !!previous.body || loaded.length > 0),
      );
      if (
        post &&
        previous?.baseUpdatedAt &&
        post.updatedAt !== previous.baseUpdatedAt
      )
        setError(
          "다른 곳에서 이 글이 수정됐어요. 임시 내용을 복사해 둔 뒤 ‘임시 내용 버리기’로 최신 글을 불러와 주세요.",
        );
      setReady(true);
    })().catch((e) => {
      if (active) setError(errorText(e));
    });
    return () => {
      active = false;
    };
  }, [draftKey, edit]);
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
    !committed.current && (busy || preparing || !saved || !photoSaved);
  useEffect(() => {
    if (!atRisk) return;
    const unload = (event: BeforeUnloadEvent) => {
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
  const attachmentResults = catalog.filter((r) =>
    query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .every((q) =>
        normalize(
          `${r.title} ${r.en} ${r.year} ${r.term}학기 ${r.issue}회`,
        ).includes(normalize(q)),
      ),
  );
  const attached = catalog.find((r) => r.id === draft.recordId),
    set = (part: Partial<PostDraft>) =>
      setDraft((d: typeof draft) => ({ ...d, ...part }));
  return (
    <>
      <form
        className="community-compose community-form"
        onSubmit={async (e) => {
          e.preventDefault();
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
            go("/post/" + result.postId, true);
          } catch (e) {
            await discardPhotos(uploaded).catch(() => {});
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="community-compose-by">
          <strong>{c.profile?.nickname}</strong>
          <span>
            {!ready
              ? "불러오는 중…"
              : !saved || photoError
                ? "임시 저장 실패"
                : photoSaved
                  ? "글·사진 임시 저장됨"
                  : "임시 저장 확인 중"}
          </span>
        </div>
        {!c.live && (
          <p className="community-help">
            체험 글은 이 브라우저에만 저장됩니다.
          </p>
        )}
        {(!saved || photoError) && (
          <ErrorLine text="브라우저 저장 공간을 사용할 수 없어 최근 내용을 보관하지 못했어요. 이 화면을 닫기 전에 글을 등록하거나 내용을 따로 복사해 주세요." />
        )}
        {restored && (
          <p className="community-draft-restored" role="status">
            작성 중이던 내용을 복원했어요.
          </p>
        )}
        <p className="community-help">
          임시 글과 사진은 이 기기의 브라우저에 저장돼요.
        </p>
        {ready && (
          <button
            type="button"
            className="community-draft-discard"
            onClick={async () => {
              if (
                !window.confirm(
                  "임시 내용을 버리고 다시 시작하시겠어요? 수정 중이라면 원래 글을 불러옵니다.",
                )
              )
                return;
              try {
                await removeDraft(draftKey);
                committed.current = true;
                setCommunityLeaveGuard(null);
                location.reload();
              } catch {
                setError("임시 내용을 지우지 못했어요. 다시 시도해 주세요.");
              }
            }}
          >
            임시 내용 버리기
          </button>
        )}
        <fieldset
          disabled={busy || !ready}
          className="community-compose-fields"
        >
          <Choice
            label="말머리"
            value={draft.category}
            change={(category) => set({ category })}
            options={categoryOptions}
          />
          {staff(c.profile) && !edit && (
            <CheckField
              checked={draft.notice}
              change={(notice) =>
                set({ notice, isSecret: notice ? false : draft.isSecret })
              }
            >
              공지로 등록하고 목록 위에 고정
            </CheckField>
          )}
          {!edit && !draft.notice ? (
            <CheckField
              checked={draft.isSecret}
              change={(isSecret) => set({ isSecret })}
            >
              비밀글 · 작성자와 운영진만 열람
            </CheckField>
          ) : (
            <p className="community-help">
              {draft.isSecret
                ? "비밀글 · 작성자와 운영진만 열람"
                : "공개 글 · 누구나 열람"}
            </p>
          )}
          <p className="community-help">공개 범위는 등록 후 바꿀 수 없어요.</p>
          <TextField
            isRequired
            value={draft.title}
            onChange={(title) => set({ title })}
          >
            <Label>제목</Label>
            <Input maxLength={100} placeholder="제목을 입력해 주세요" />
          </TextField>
          <Editor
            body={draft.body}
            format={draft.bodyFormat}
            change={(body, bodyFormat) => set({ body, bodyFormat })}
            disabled={busy || !ready}
          />
          <PhotoPicker
            photos={photos}
            change={setPhotos}
            disabled={busy || preparing || !ready}
            preparing={setPreparing}
          />
          {preparing && (
            <p role="status" className="community-help">
              사진 준비 중…
            </p>
          )}
          {attached ? (
            <div className="community-attached">
              <FileText size={18} />
              <span>
                {attached.year} · {attached.title} {attached.issue}회
              </span>
              <Button
                variant="ghost"
                isIconOnly
                aria-label="첨부 큐시트 해제"
                onPress={() => set({ recordId: "" })}
              >
                <X size={17} />
              </Button>
            </div>
          ) : (
            <Button variant="outline" onPress={() => setAttachOpen(true)}>
              <FileText size={17} />
              큐시트 연결
            </Button>
          )}
          <ErrorLine text={error} />
          <Button
            type="submit"
            fullWidth
            isDisabled={
              busy ||
              preparing ||
              !ready ||
              !draft.body.trim() ||
              !draft.title.trim()
            }
          >
            {busy ? "사진·글 저장 중…" : edit ? "수정 완료" : "등록하기"}
          </Button>
        </fieldset>
        <p className="community-help">
          다른 사람의 개인정보와 권리를 존중해 주세요.
        </p>
      </form>
      <Dialog
        title="함께 읽을 큐시트"
        open={attachOpen}
        close={() => setAttachOpen(false)}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          aria-label="프로그램 또는 연도 검색"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="프로그램 또는 연도 검색" />
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
          {!attachmentResults.length && <Empty title="검색 결과가 없어요" />}
        </div>
      </Dialog>
    </>
  );
}
