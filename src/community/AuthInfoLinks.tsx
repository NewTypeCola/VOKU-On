export function AuthInfoLinks() {
  return <nav className="auth-info-links" aria-label="가입·이용 안내">
    <a href="/privacy/" target="_blank" rel="noreferrer">개인정보처리방침<span className="sr-only"> (새 창)</span></a>
    <a href="/terms/" target="_blank" rel="noreferrer">이용약관<span className="sr-only"> (새 창)</span></a>
    <a href="mailto:vokuon@gmail.com">문의하기</a>
  </nav>;
}
