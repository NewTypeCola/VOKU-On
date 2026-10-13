import type { CommunityPost } from "../community/types";

export type LocalPhotoExample = CommunityPost & { exampleImage: string; imageAlt: string };

// Read-only fixtures requested for local layout review. Never merged into the
// community API, storage, ranking, latest feed, or any production build's UI.
export const localPhotoExamples: LocalPhotoExample[] =
  (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV ? [
  {
    id: "local-home-tapes", title: "오래된 테이프를 꺼내던 오후",
    body: "테이프를 한 개씩 꺼내다 보면 어떤 목소리와 음악이 담겨 있을지 궁금해집니다.\n\n여러분은 예전에 녹음해 둔 테이프를 아직 가지고 계신가요?",
    exampleImage: "/assets/home/examples/tapes.jpg", imageAlt: "카세트 테이프 상자와 녹음기를 그린 AI 생성 예시 사진",
  },
  {
    id: "local-home-microphone", title: "마이크 앞에 앉으면 떠오르는 순간",
    body: "헤드폰을 쓰고 첫 문장을 기다리는 순간을 떠올려 봅니다. 조용한 방송실에서 들리던 작은 소리도 오랫동안 기억에 남는 것 같아요.\n\n처음 마이크 앞에 앉았을 때의 기분은 어땠나요?",
    exampleImage: "/assets/home/examples/microphone.jpg", imageAlt: "마이크와 헤드폰이 놓인 방송실의 AI 생성 예시 사진",
  },
  {
    id: "local-home-campus", title: "방송을 마치고 걷던 가을길",
    body: "방송이 끝난 뒤 천천히 걸어 나오던 길을 떠올리는 예시 이야기입니다. 노란 잎이 쌓인 풍경을 보며 그때 자주 듣던 노래를 생각해 봅니다.",
    exampleImage: "/assets/home/examples/campus.jpg", imageAlt: "은행잎이 쌓인 가상의 대학 산책로를 그린 AI 생성 예시 사진",
  },
].map<LocalPhotoExample>((post) => ({
  ...post, category: "추억", author: "로컬 예시", authorId: "local-home-example",
  authorRole: "member", date: "2026-10-11T12:00:00+09:00", likes: 0, views: 0,
  commentCount: 0, demo: true, bodyFormat: "plain", isSecret: false, readable: true,
  pinned: false, locked: true, status: "published", liked: false, bookmarked: false,
})) : [];
export const localPhotoExample = (id: string) => localPhotoExamples.find((post) => post.id === id);
