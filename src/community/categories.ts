// Keep legacy stored categories readable without rewriting members' posts.
export const categoryOptions = [
  { id: "일상", label: "자유글" },
  { id: "추억", label: "추억" },
  { id: "질문", label: "질문" },
  { id: "동문소식", label: "동문소식" },
];
export const boardCategories = [
  "전체",
  ...categoryOptions.map((option) => option.label),
  "공지",
];
export const writingCategory = (value?: string | null) =>
  categoryOptions.find(
    (option) => option.id === value || option.label === value,
  )?.id || "일상";
export const boardCategory = (value?: string | null) =>
  value === "음악" || value === "일상"
    ? "자유글"
    : boardCategories.includes(value || "")
      ? value!
      : "전체";
