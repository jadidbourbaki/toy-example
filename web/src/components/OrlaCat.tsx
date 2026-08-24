/** The Orla cat, redrawn from docs/orla_cat.png as one rect per pixel
 *  block so the eyes are their own elements and can blink. Regenerate
 *  by re-running the pixel grid over a new asset. */
export function OrlaCat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 247 205" className={className} shapeRendering="crispEdges" aria-hidden="true">
      <rect x="144" y="1" width="16" height="17" fill="#5f5f5f" />
      <rect x="208" y="1" width="16" height="17" fill="#5f5f5f" />
      <rect x="128" y="18" width="16" height="17" fill="#5f5f5f" />
      <rect x="144" y="18" width="16" height="17" fill="#875faf" />
      <rect x="160" y="18" width="48" height="17" fill="#5f5f5f" />
      <rect x="208" y="18" width="16" height="17" fill="#875faf" />
      <rect x="224" y="18" width="16" height="17" fill="#5f5f5f" />
      <rect x="128" y="35" width="112" height="17" fill="#5f5f5f" />
      <rect x="128" y="52" width="32" height="17" fill="#5f5f5f" />
      <rect x="176" y="52" width="16" height="17" fill="#5f5f5f" />
      <rect x="208" y="52" width="32" height="17" fill="#5f5f5f" />
      <rect x="0" y="69" width="16" height="17" fill="#5f5f5f" />
      <rect x="144" y="69" width="80" height="17" fill="#5f5f5f" />
      <rect x="0" y="86" width="32" height="17" fill="#5f5f5f" />
      <rect x="160" y="86" width="48" height="17" fill="#5f5f5f" />
      <rect x="16" y="103" width="144" height="17" fill="#5f5f5f" />
      <rect x="160" y="103" width="32" height="17" fill="#870200" />
      <rect x="32" y="120" width="160" height="17" fill="#5f5f5f" />
      <rect x="48" y="137" width="128" height="17" fill="#5f5f5f" />
      <rect x="176" y="137" width="16" height="17" fill="#484848" />
      <rect x="48" y="154" width="16" height="17" fill="#5f5f5f" />
      <rect x="64" y="154" width="16" height="17" fill="#5f5f87" />
      <rect x="80" y="154" width="32" height="17" fill="#484848" />
      <rect x="112" y="154" width="32" height="17" fill="#5f5f5f" />
      <rect x="144" y="154" width="16" height="17" fill="#5f5f87" />
      <rect x="160" y="154" width="32" height="17" fill="#484848" />
      <rect x="48" y="171" width="16" height="17" fill="#5f5f5f" />
      <rect x="64" y="171" width="16" height="17" fill="#5f5f87" />
      <rect x="80" y="171" width="16" height="17" fill="#484848" />
      <rect x="128" y="171" width="16" height="17" fill="#5f5f5f" />
      <rect x="144" y="171" width="16" height="17" fill="#5f5f87" />
      <rect x="160" y="171" width="32" height="17" fill="#484848" />
      <rect x="48" y="188" width="32" height="17" fill="#5f5f5f" />
      <rect x="80" y="188" width="32" height="17" fill="#484848" />
      <rect x="128" y="188" width="32" height="17" fill="#5f5f5f" />
      <rect x="176" y="188" width="32" height="17" fill="#484848" />
      <g className="orla-cat-eyes">
        <rect x="160" y="52" width="16" height="17" />
        <rect x="192" y="52" width="16" height="17" />
      </g>
    </svg>
  );
}
