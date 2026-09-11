import rough from "roughjs/bin/rough";
import type { Options } from "roughjs/bin/core";

/** One generator for the whole canvas, so every shape is drawn with the same
 *  hand. The seed keeps a shape's wobble fixed between renders. */
const generator = rough.generator();

export type SketchPath = { d: string; stroke: string; strokeWidth: number; fill: string };

function seedFor(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 1000) + 1;
}

const base: Options = {
  roughness: 1.1,
  bowing: 1,
  strokeWidth: 1.6,
  fillStyle: "solid",
};

export function sketchEllipse(
  key: string,
  width: number,
  height: number,
  stroke: string,
  fill: string,
): SketchPath[] {
  const drawable = generator.ellipse(width / 2, height / 2, width - 8, height - 8, {
    ...base,
    seed: seedFor(key),
    stroke,
    fill,
  });
  return generator.toPaths(drawable).map((p) => ({
    d: p.d,
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    fill: p.fill ?? "none",
  }));
}

export function sketchPath(key: string, d: string, stroke: string): SketchPath[] {
  const drawable = generator.path(d, {
    ...base,
    roughness: 0.8,
    seed: seedFor(key),
    stroke,
    fill: "none",
  });
  return generator.toPaths(drawable).map((p) => ({
    d: p.d,
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    fill: "none",
  }));
}
