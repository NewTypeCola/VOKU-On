// This policy page does not send analytics. Preferences apply to this browser only.
const keys = {
  browser: "voku-usage-browser-v1",
  session: "voku-usage-session-v1",
  out: "voku-usage-opt-out",
  test: "voku-usage-test",
};
const status = document.getElementById("usage-status"),
  toggle = document.getElementById("usage-enabled"),
  test = document.getElementById("usage-test"),
  erase = document.getElementById("usage-erase");
try {
  const privacySignal =
    navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  toggle.checked = localStorage.getItem(keys.out) !== "1" && !privacySignal;
  toggle.disabled = privacySignal;
  test.checked = localStorage.getItem(keys.test) === "1";
  if (privacySignal)
    status.textContent =
      "브라우저의 추적 차단 요청에 따라 이용 분석 수집을 중지했습니다.";
  toggle.addEventListener("change", () => {
    localStorage.setItem(keys.out, toggle.checked ? "0" : "1");
    status.textContent = toggle.checked
      ? "이 브라우저에서 다음 웹앱 이용부터 분석 수집을 허용합니다."
      : "이 브라우저의 새로운 분석 기록 수집을 중지했습니다. 서비스 기능은 그대로 사용할 수 있습니다.";
  });
  test.addEventListener("change", () => {
    if (test.checked) localStorage.setItem(keys.test, "1");
    else localStorage.removeItem(keys.test);
    sessionStorage.removeItem(keys.session);
    status.textContent = test.checked
      ? "다음 웹앱 이용은 테스트 활동으로 분리합니다."
      : "다음 방문부터 일반 분석 기준을 적용합니다. 이미 분리된 테스트 활동은 실적으로 바꾸지 않습니다.";
  });
  erase.addEventListener("click", async () => {
    erase.disabled = true;
    localStorage.setItem(keys.out, "1");
    toggle.checked = false;
    try {
      const browser = JSON.parse(localStorage.getItem(keys.browser) || "null");
      if (browser?.id) {
        const response = await fetch("/api/usage/erase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor: browser.id }),
        });
        if (!response.ok) throw Error("delivery");
      }
      localStorage.removeItem(keys.browser);
      sessionStorage.removeItem(keys.session);
      status.textContent =
        "이 브라우저의 보관 중인 상세 이용 기록과 분석 식별값을 삭제하고 새 수집을 중지했습니다. 이미 개인 식별값 없이 집계된 통계·보고서는 보관됩니다.";
    } catch {
      status.textContent =
        "새 수집은 중지했지만 서버 기록 삭제를 확인하지 못했습니다. 연결을 확인하고 다시 눌러 주세요. 분석 식별값은 재시도를 위해 남겨 두었습니다.";
    } finally {
      erase.disabled = false;
    }
  });
} catch {
  status.textContent =
    "브라우저 저장소에 접근할 수 없습니다. 브라우저의 사이트 데이터 설정이나 아래 문의처를 이용해 주세요.";
  toggle.disabled = true;
  test.disabled = true;
}
