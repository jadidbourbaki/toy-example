/** Join class names, skipping anything falsy. The theme carries styling, so
 *  this is only for the few conditional classes the canvas needs. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
