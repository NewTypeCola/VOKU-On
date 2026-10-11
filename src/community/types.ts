import type { Post, Comment, Category } from "../data";

export type Role = "member" | "moderator" | "admin";
export type Profile = {
  id: string;
  nickname: string;
  profileComplete: boolean;
  providers: string[];
  admissionYear: number | null;
  cohort: number | null;
  role: Role;
  joinedAt: string;
  suspendedUntil: string | null;
  suspensionReason: string;
};
export type CommunityPost = Post & {
  authorId: string;
  authorRole: Role;
  pinned: boolean;
  locked: boolean;
  status: "published" | "hidden" | "deleted";
  commentCount: number;
  liked: boolean;
  bookmarked: boolean;
  updatedAt?: string;
};
export type CommunityComment = Comment & {
  authorId: string;
  authorRole: Role;
  postId: string;
  status: "published" | "hidden" | "deleted";
};
export type FeedQuery = {
  category?: string;
  sort?: string;
  query?: string;
  page?: number;
};
export type Feed = {
  posts: CommunityPost[];
  notices: CommunityPost[];
  total: number;
};
export type Thread = { post: CommunityPost; comments: CommunityComment[] };
export type CommunityNotification = {
  id: string;
  postId: string;
  text: string;
  date: string;
  read: boolean;
};
export type Report = {
  id: string;
  postId: string;
  commentId?: string;
  targetAuthorId: string;
  title: string;
  body: string;
  reporter: string;
  reason: string;
  detail: string;
  status: "open" | "resolved" | "dismissed";
  date: string;
  resolution?: string;
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  date: string;
};
export type Account = {
  avatarUrl?: string | null;
  profile: Profile;
  posts: CommunityPost[];
  comments: CommunityComment[];
  saved: CommunityPost[];
  notifications: CommunityNotification[];
  unreadNotificationCount: number;
  blocked: { id: string; nickname: string }[];
  reports: Report[];
};
export type ActivityKind = "posts" | "comments" | "notifications";
export type ActivityPage = { total: number; page: number; pageSize: number } & (
  | { kind: "posts"; items: CommunityPost[] }
  | { kind: "comments"; items: CommunityComment[] }
  | { kind: "notifications"; items: CommunityNotification[] }
);
export type AdminData = {
  stats: {
    pendingReports: number;
    pinnedPosts: number;
    suspendedMembers: number;
  };
  reports: Report[];
  members: Profile[];
  posts: CommunityPost[];
  audit: Audit[];
};
export type PostInput = {
  id?: string;
  title: string;
  body: string;
  category: Category;
  recordId?: string;
  notice?: boolean;
};
export type Action =
  | "post_save"
  | "post_delete"
  | "post_pin"
  | "post_lock"
  | "post_visibility"
  | "comment_save"
  | "comment_delete"
  | "like"
  | "bookmark"
  | "report"
  | "resolve_report"
  | "suspend"
  | "restore_member"
  | "set_role"
  | "profile"
  | "read_notifications"
  | "block";
export const reportReasons = [
  "광고·도배",
  "욕설·비방",
  "개인정보 노출",
  "부적절한 내용",
  "기타",
] as const;
export const staff = (profile: Profile | null) =>
  !!profile && ["admin", "moderator"].includes(profile.role);
export const suspended = (profile: Profile | null) =>
  !!profile?.suspendedUntil &&
  new Date(profile.suspendedUntil).getTime() > Date.now();
export const roleLabel = (role: Role) =>
  ({ member: "회원", moderator: "운영진", admin: "관리자" })[role];
export const postLabel = (
  p: Pick<CommunityPost, "pinned" | "recordId" | "category">,
) =>
  p.pinned
    ? "공지"
    : p.recordId
      ? "자료 이야기"
      : p.category === "일상"
        ? "자유글"
        : p.category;
