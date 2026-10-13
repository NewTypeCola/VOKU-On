import type { CommunityNotification } from "./types";

/** Only enrich from currently readable rows; a notification is not read permission. */
export function notificationDetails(items: CommunityNotification[], posts: { id: string; title: string }[], comments: { id: string; post_id: string; body: string }[]): CommunityNotification[] {
  const titles = new Map(posts.map(post => [post.id, post.title]));
  const replies = new Map(comments.map(comment => [comment.id, comment]));
  return items.map(item => {
    const comment = item.commentId ? replies.get(item.commentId) : undefined;
    const readable = titles.has(item.postId);
    return { ...item, postTitle: titles.get(item.postId), excerpt: readable && comment?.post_id === item.postId ? comment.body.replace(/\s+/g, " ").trim().slice(0, 140) : undefined };
  });
}
