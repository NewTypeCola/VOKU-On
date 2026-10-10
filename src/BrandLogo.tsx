export default function BrandLogo({ onHome, small = false }: { onHome: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      className={`brand brand-image ${small ? "brand-image-small" : ""}`}
      aria-label="VOKU On 홈"
      onClick={onHome}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <img src="/brand/voku-logo.webp" width="1973" height="707" alt="VOKU" draggable={false} />
    </button>
  );
}
