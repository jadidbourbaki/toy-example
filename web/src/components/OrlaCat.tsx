/** The Orla cat, redrawn from the project's pixel art with one rect per
 *  block on a unit grid, so it stays crisp at any size and the eyes are
 *  their own elements. Regenerate by re-running the grid over the asset. */
export function OrlaCat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 12" className={className} shapeRendering="crispEdges" aria-hidden="true">
      <rect x="9" y="0" width="1" height="1" fill="#5f5f5f" />
      <rect x="13" y="0" width="1" height="1" fill="#5f5f5f" />
      <rect x="8" y="1" width="1" height="1" fill="#5f5f5f" />
      <rect x="9" y="1" width="1" height="1" fill="#875faf" />
      <rect x="10" y="1" width="3" height="1" fill="#5f5f5f" />
      <rect x="13" y="1" width="1" height="1" fill="#875faf" />
      <rect x="14" y="1" width="1" height="1" fill="#5f5f5f" />
      <rect x="8" y="2" width="7" height="1" fill="#5f5f5f" />
      <rect x="8" y="3" width="2" height="1" fill="#5f5f5f" />
      <rect x="11" y="3" width="1" height="1" fill="#5f5f5f" />
      <rect x="13" y="3" width="2" height="1" fill="#5f5f5f" />
      <rect x="0" y="4" width="1" height="1" fill="#5f5f5f" />
      <rect x="9" y="4" width="5" height="1" fill="#5f5f5f" />
      <rect x="0" y="5" width="2" height="1" fill="#5f5f5f" />
      <rect x="10" y="5" width="3" height="1" fill="#5f5f5f" />
      <rect x="1" y="6" width="9" height="1" fill="#5f5f5f" />
      <rect x="10" y="6" width="2" height="1" fill="#870200" />
      <rect x="2" y="7" width="10" height="1" fill="#5f5f5f" />
      <rect x="3" y="8" width="8" height="1" fill="#5f5f5f" />
      <rect x="11" y="8" width="1" height="1" fill="#484848" />
      <rect x="3" y="9" width="1" height="1" fill="#5f5f5f" />
      <rect x="4" y="9" width="1" height="1" fill="#5f5f87" />
      <rect x="5" y="9" width="2" height="1" fill="#484848" />
      <rect x="7" y="9" width="2" height="1" fill="#5f5f5f" />
      <rect x="9" y="9" width="1" height="1" fill="#5f5f87" />
      <rect x="10" y="9" width="2" height="1" fill="#484848" />
      <rect x="3" y="10" width="1" height="1" fill="#5f5f5f" />
      <rect x="4" y="10" width="1" height="1" fill="#5f5f87" />
      <rect x="5" y="10" width="1" height="1" fill="#484848" />
      <rect x="8" y="10" width="1" height="1" fill="#5f5f5f" />
      <rect x="9" y="10" width="1" height="1" fill="#5f5f87" />
      <rect x="10" y="10" width="2" height="1" fill="#484848" />
      <rect x="3" y="11" width="2" height="1" fill="#5f5f5f" />
      <rect x="5" y="11" width="2" height="1" fill="#484848" />
      <rect x="8" y="11" width="2" height="1" fill="#5f5f5f" />
      <rect x="11" y="11" width="2" height="1" fill="#484848" />
      <g className="orla-cat-eyes">
        <rect x="10" y="3" width="1" height="1" />
        <rect x="12" y="3" width="1" height="1" />
      </g>
    </svg>
  );
}
