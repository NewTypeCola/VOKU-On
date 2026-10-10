import { useId } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { parseAdmissionYear, suggestedCohort } from "./affiliation";

type Props = {
  year: string;
  cohort: string;
  onYearChange: (value: string) => void;
  onCohortChange: (value: string) => void;
  disabled?: boolean;
};

function yearOrNull(value: string) {
  try {
    return parseAdmissionYear(value);
  } catch {
    return null;
  }
}

export function AffiliationFields({
  year,
  cohort,
  onYearChange,
  onCohortChange,
  disabled = false,
}: Props) {
  const helpId = useId();
  const admissionYear = yearOrNull(year);
  const first = suggestedCohort(admissionYear, 1);
  const second = suggestedCohort(admissionYear, 2);
  const changeYear = (value: string) => {
    const previousYear = yearOrNull(year);
    const previousFirst = suggestedCohort(previousYear, 1);
    const previousSecond = suggestedCohort(previousYear, 2);
    const autoTerm = cohort && Number(cohort) === previousSecond ? 2 : 1;
    // Keep a manually entered cohort when the admission year is corrected.
    if (
      !cohort ||
      Number(cohort) === previousFirst ||
      Number(cohort) === previousSecond
    ) {
      const suggestion = suggestedCohort(yearOrNull(value), autoTerm);
      onCohortChange(suggestion === null ? "" : String(suggestion));
    }
    onYearChange(value);
  };
  return (
    <fieldset
      className="community-affiliation"
      disabled={disabled}
      aria-describedby={helpId}
    >
      <legend>
        학번·기수 <span>선택</span>
      </legend>
      <div className="community-affiliation-inputs">
        <TextField value={year} onChange={changeYear} isDisabled={disabled}>
          <Label>
            학번 <span>(입학년도)</span>
          </Label>
          <Input
            inputMode="numeric"
            placeholder="예: 18 또는 2018"
            maxLength={4}
            pattern="[0-9]{2}|[0-9]{4}"
            autoComplete="off"
          />
        </TextField>
        <TextField
          value={cohort}
          onChange={onCohortChange}
          isDisabled={disabled}
        >
          <Label>방송국 기수</Label>
          <Input
            inputMode="numeric"
            placeholder="예: 93"
            maxLength={3}
            pattern="[0-9]{1,3}"
            autoComplete="off"
          />
        </TextField>
      </div>
      {first !== null && second !== null && (
        <div
          className="community-cohort-suggestions"
          aria-label={`${admissionYear}년 입국 기준 기수 선택`}
        >
          <span>{admissionYear}년 입국 기준</span>
          <div>
            {(
              [
                [1, first],
                [2, second],
              ] as const
            ).map(([term, value]) => (
              <Button
                key={term}
                variant="ghost"
                size="sm"
                isDisabled={disabled}
                aria-pressed={Number(cohort) === value}
                onPress={() => onCohortChange(String(value))}
              >
                {term}학기 · {value}기
              </Button>
            ))}
          </div>
        </div>
      )}
      <p id={helpId} className="community-help">
        {first !== null
          ? "입국 시기가 다르면 기수를 직접 수정해 주세요."
          : "입학년도를 입력하면 기수를 제안해 드려요. 기수만 입력해도 됩니다."}
      </p>
    </fieldset>
  );
}
