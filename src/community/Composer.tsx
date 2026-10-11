import {
  Button,
  Input,
  Label,
  SearchField,
  TextArea,
  TextField,
} from "@heroui/react";
import { ChevronRight, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { categories, normalize, type ArchiveRecord } from "../data";
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
import { staff } from "./types";

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
  const initial = () => {
    const empty = { title: "", body: "", category: "일상", recordId: "" };
    try {
      const value = JSON.parse(localStorage.getItem(draftKey) || "null");
      return value &&
        ["title", "body", "category", "recordId"].every(
          (k) => typeof value[k] === "string",
        )
        ? {
            title: value.title.slice(0, 100),
            body: value.body.slice(0, 10000),
            category: categories.includes(value.category)
              ? value.category
              : "일상",
            recordId: value.recordId,
          }
        : empty;
    } catch {
      return empty;
    }
  };
  const [draft, setDraft] = useState(initial),
    [notice, setNotice] = useState(isNotice && staff(c.profile)),
    [attachOpen, setAttachOpen] = useState(false),
    [query, setQuery] = useState(""),
    [attachmentLimit, setAttachmentLimit] = useState(20),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(!edit),
    [saved, setSaved] = useState(true);
  useEffect(() => {
    if (!edit) return;
    let active = true;
    api
      .thread(edit)
      .then(({ post }) => {
        if (!active) return;
        if (post.authorId !== c.profile?.id)
          throw Error("본인의 글만 수정할 수 있습니다.");
        setDraft({
          title: post.title,
          body: post.body,
          category: post.category,
          recordId: post.recordId || "",
        });
        setNotice(post.pinned);
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [edit]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [draft, draftKey, ready]);
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
    set = (part: Record<string, string>) =>
      setDraft((d: typeof draft) => ({ ...d, ...part }));
  return (
    <>
      <form
        className="community-compose community-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await c.action(
              "post_save",
              {
                ...draft,
                title: draft.title.trim(),
                body: draft.body.trim(),
                ...(edit ? { id: edit } : { notice }),
              },
              edit ? "글을 수정했어요." : "글을 등록했어요.",
            );
            try {
              localStorage.removeItem(draftKey);
            } catch {
              /* The server save already succeeded. */
            }
            go("/post/" + result.postId, true);
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="community-compose-by">
          <strong>{c.profile?.nickname}</strong>
          <span>{saved ? "임시 저장됨" : "임시 저장 공간 부족"}</span>
        </div>
        {!c.live && (
          <p className="community-help">
            체험 글은 이 브라우저에만 저장됩니다.
          </p>
        )}
        <Choice
          label="말머리"
          value={draft.category}
          change={(category) => set({ category })}
          options={categoryOptions}
        />
        {staff(c.profile) && !edit && (
          <CheckField checked={notice} change={setNotice}>
            공지로 등록하고 목록 위에 고정
          </CheckField>
        )}
        <TextField
          isRequired
          value={draft.title}
          onChange={(title) => set({ title })}
        >
          <Label>제목</Label>
          <Input maxLength={100} placeholder="제목을 입력해 주세요" />
        </TextField>
        <TextField
          isRequired
          value={draft.body}
          onChange={(body) => set({ body })}
        >
          <Label>내용</Label>
          <TextArea
            rows={10}
            maxLength={10000}
            placeholder="방송실의 기억, 오늘의 안부를 편하게 남겨주세요."
          />
        </TextField>
        <span className="community-count">
          {draft.body.length.toLocaleString()} / 10,000
        </span>
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
        <Button type="submit" fullWidth isDisabled={busy || !ready}>
          {busy ? "저장 중…" : edit ? "수정 완료" : "등록하기"}
        </Button>
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
