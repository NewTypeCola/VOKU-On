export function ProfileAvatar({ nickname, url, label = "프로필 사진", className = "" }: { nickname: string; url?: string | null; label?: string; className?: string }) {
  return <span className={`community-avatar community-own-avatar ${className}`}>
    <span aria-hidden="true">{nickname[0]}</span>
    {url && <img key={url} src={url} alt={label} referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} />}
  </span>;
}
