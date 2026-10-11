export const POST_TITLE_LIMIT = 100;
export const POST_BODY_LIMIT = 10000;

export function validatePostText(title: string, body: string) {
  return {
    title: !title.trim()
      ? "제목을 입력해 주세요."
      : title.length > POST_TITLE_LIMIT
        ? "제목은 100자까지 입력할 수 있어요."
        : "",
    body: !body.trim()
      ? "내용을 입력해 주세요."
      : body.length > POST_BODY_LIMIT
        ? "내용은 10,000자까지 입력할 수 있어요."
        : "",
  };
}
