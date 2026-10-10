import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAdmissionYear,
  suggestedCohort,
  parseAffiliation,
  affiliationLabel,
} from "../src/community/affiliation.ts";

test("18학번 resolves to 2018 and supports both 93기 and 94기", () => {
  assert.equal(parseAdmissionYear("18", 2027), 2018);
  assert.equal(parseAdmissionYear("2018", 2027), 2018);
  assert.equal(suggestedCohort(2018, 1), 93);
  assert.equal(suggestedCohort(2018, 2), 94);
  assert.equal(suggestedCohort(2017, 2), 92);
  assert.equal(suggestedCohort(2019, 1), 95);
});
test("earlier alumni years and zero-prefixed years retain their century", () => {
  assert.equal(parseAdmissionYear("88", 2027), 1988);
  assert.equal(parseAdmissionYear("00", 2027), 2000);
  assert.equal(parseAdmissionYear("09", 2027), 2009);
  assert.equal(
    affiliationLabel({ admissionYear: 2000, cohort: 57 }),
    "00학번 · 57기",
  );
  assert.equal(suggestedCohort(1971, 2), null);
});
test("admission and club cohort are optional and can differ from the suggestion", () => {
  assert.deepEqual(parseAffiliation("", ""), {
    admissionYear: null,
    cohort: null,
  });
  assert.deepEqual(parseAffiliation("2018", "97"), {
    admissionYear: 2018,
    cohort: 97,
  });
  assert.deepEqual(parseAffiliation("", "94"), {
    admissionYear: null,
    cohort: 94,
  });
  assert.equal(affiliationLabel({ cohort: 94 }), "94기");
  assert.equal(affiliationLabel({}), "");
});
test("full student IDs, future years and invalid cohorts are rejected", () => {
  for (const year of [
    "20181234",
    "18학번",
    "201",
    "-18",
    "18.5",
    "1899",
    "9999",
  ]) {
    assert.throws(() => parseAdmissionYear(year, 2027));
  }
  for (const cohort of ["0", "-1", "93기", "1.5", "1000"]) {
    assert.throws(() => parseAffiliation("2018", cohort));
  }
});
