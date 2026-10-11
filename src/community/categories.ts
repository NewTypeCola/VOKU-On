import { categories } from "../data";

export const categoryOptions = categories.map(id => ({
  id,
  label: id === "일상" ? "자유글" : id,
}));
export const boardCategories = ["전체", "자료 이야기", ...categoryOptions.map(option => option.label), "공지"];
