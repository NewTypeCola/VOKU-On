export type Affiliation = {
  admissionYear: number | null;
  cohort: number | null;
};

export const latestAdmissionYear = () => new Date().getFullYear() + 1;

// A two-digit 학번 denotes an admission year, never a complete student ID.
export function parseAdmissionYear(
  input: string,
  latest = latestAdmissionYear(),
): number | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^(\d{2}|\d{4})$/.test(value))
    throw Error("학번은 18 또는 2018처럼 입학년도로 입력해 주세요.");
  let year = Number(value);
  if (value.length === 2) year += year <= latest % 100 ? 2000 : 1900;
  if (year < 1900 || year > latest)
    throw Error(`입학년도는 1900~${latest}년으로 입력해 주세요.`);
  return year;
}

export function suggestedCohort(
  year: number | null,
  term: 1 | 2,
): number | null {
  if (year === null) return null;
  const result = 93 + (year - 2018) * 2 + term - 1;
  return result >= 1 && result <= 999 ? result : null;
}

export function parseAffiliation(year: string, cohort: string): Affiliation {
  const admissionYear = parseAdmissionYear(year);
  const value = cohort.trim();
  if (value && (!/^\d{1,3}$/.test(value) || Number(value) < 1)) {
    throw Error("기수는 1~999 사이의 숫자로 입력해 주세요.");
  }
  return { admissionYear, cohort: value ? Number(value) : null };
}

export function affiliationLabel(profile: Partial<Affiliation>): string {
  return [
    profile.admissionYear
      ? `${String(profile.admissionYear).slice(-2)}학번`
      : "",
    profile.cohort ? `${profile.cohort}기` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
