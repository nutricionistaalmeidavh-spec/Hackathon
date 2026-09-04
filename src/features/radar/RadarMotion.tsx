export function RadarMotion({ size = 44 }: { size?: number }) {
  return <span className="radar-motion" style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 48 48" role="img">
      <circle className="radar-motion-ring ring-a" cx="24" cy="24" r="19" />
      <circle className="radar-motion-ring ring-b" cx="24" cy="24" r="12" />
      <circle className="radar-motion-ring ring-c" cx="24" cy="24" r="5" />
      <path className="radar-motion-sweep" d="M24 24 L24 5 A19 19 0 0 1 42 24 Z" />
      <line className="radar-motion-arm" x1="24" y1="24" x2="39" y2="13" />
      <circle className="radar-motion-dot dot-a" cx="34" cy="18" r="2" />
      <circle className="radar-motion-dot dot-b" cx="17" cy="31" r="1.5" />
      <circle className="radar-motion-core" cx="24" cy="24" r="2.1" />
    </svg>
  </span>;
}
