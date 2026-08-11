// Ending-corpus sensitivity grid (docs/06 §6.6, source §3.8). Varies two
// projection parameters (by default liquid-market return on the x-axis and
// locked/FD return on the y-axis) and reports the deterministic ending corpus
// for each combination. The result is a 2-D grid `rows[x-axis value][y-axis
// value]` of ending corpus (or null when a cell is undefined).

import { projectTwoSleeve, type TwoSleeveProjectionInput } from "../projection/twoSleeve";

export interface SensitivityAxis {
  label: string;
  values: number[];
}

export interface SensitivityGrid {
  x: SensitivityAxis;
  y: SensitivityAxis;
  /** rows[yIndex][xIndex] = ending total corpus for that parameter pair. */
  rows: Array<Array<number | null>>;
  /** Base ending corpus at the current parameter values (diagonal anchor). */
  base: number;
}

/**
 * Builds an ending-corpus grid by re-running the deterministic two-sleeve
 * projection across a range of liquid-return (x) and locked-return (y) values.
 * The `base` value is the projection at the midpoint of each axis.
 */
export function sensitivityMatrix(
  input: TwoSleeveProjectionInput,
  xValues: number[],
  yValues: number[],
): SensitivityGrid {
  const midX = xValues[Math.floor((xValues.length - 1) / 2)] ?? input.liquidReturn;
  const midY = yValues[Math.floor((yValues.length - 1) / 2)] ?? input.lockedReturn;
  const base = endingCorpus(input, midX, midY);

  const rows = yValues.map((y) =>
    xValues.map((x) => {
      // Avoid re-evaluating the (mid, mid) anchor; it equals `base`.
      if (x === midX && y === midY) return base;
      return endingCorpus(input, x, y);
    }),
  );

  return {
    x: { label: "Liquid return", values: xValues },
    y: { label: "Locked return", values: yValues },
    rows,
    base,
  };
}

function endingCorpus(input: TwoSleeveProjectionInput, liquidReturn: number, lockedReturn: number): number {
  const rows = projectTwoSleeve({ ...input, liquidReturn, lockedReturn });
  const last = rows[rows.length - 1];
  return last ? last.totalCorpus : 0;
}
