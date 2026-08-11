// Best/base/worst scenario analysis (docs/06 §6.6, source §3.9). Runs the
// deterministic two-sleeve projection under three parameter sets — a favorable,
// the current/base, and an unfavorable — and classifies each by its ending
// corpus relative to the base case.

import { projectTwoSleeve, type TwoSleeveProjectionInput } from "../projection/twoSleeve";

export interface ScenarioOutcome {
  label: "best" | "base" | "worst";
  liquidReturn: number;
  lockedReturn: number;
  endingCorpus: number;
  /** Relative to the base-case ending corpus (best/base/worst). */
  deltaVsBase: number;
}

export interface ScenarioSet {
  scenarios: ScenarioOutcome[];
  /** Best minus worst ending corpus — a raw spread measure. */
  spread: number;
}

export interface ScenarioShift {
  /** Multiplier applied to the liquid return for that scenario. */
  liquidReturnMultiple: number;
  /** Multiplier applied to the locked return for that scenario. */
  lockedReturnMultiple: number;
}

const DEFAULT_SHIFTS: Record<"best" | "worst", ScenarioShift> = {
  best: { liquidReturnMultiple: 1.25, lockedReturnMultiple: 1.1 },
  worst: { liquidReturnMultiple: 0.75, lockedReturnMultiple: 0.9 },
};

/**
 * Projects a plan under best, base, and worst return assumptions and returns
 * each scenario's ending corpus plus the best-minus-worst spread.
 */
export function scenarioAnalysis(
  input: TwoSleeveProjectionInput,
  shifts: { best?: ScenarioShift; worst?: ScenarioShift } = {},
): ScenarioSet {
  const bestShift = shifts.best ?? DEFAULT_SHIFTS.best;
  const worstShift = shifts.worst ?? DEFAULT_SHIFTS.worst;

  const base = runScenario(input, { label: "base", liquidReturn: input.liquidReturn, lockedReturn: input.lockedReturn });
  const best = runScenario(input, {
    label: "best",
    liquidReturn: input.liquidReturn * bestShift.liquidReturnMultiple,
    lockedReturn: input.lockedReturn * bestShift.lockedReturnMultiple,
  });
  const worst = runScenario(input, {
    label: "worst",
    liquidReturn: input.liquidReturn * worstShift.liquidReturnMultiple,
    lockedReturn: input.lockedReturn * worstShift.lockedReturnMultiple,
  });

  const withDelta = [best, base, worst].map((s) => ({
    ...s,
    deltaVsBase: s.endingCorpus - base.endingCorpus,
  }));

  return {
    scenarios: withDelta,
    spread: best.endingCorpus - worst.endingCorpus,
  };
}

function runScenario(
  input: TwoSleeveProjectionInput,
  opts: { label: "best" | "base" | "worst"; liquidReturn: number; lockedReturn: number },
): Omit<ScenarioOutcome, "deltaVsBase"> {
  const rows = projectTwoSleeve({ ...input, liquidReturn: opts.liquidReturn, lockedReturn: opts.lockedReturn });
  const last = rows[rows.length - 1];
  return {
    label: opts.label,
    liquidReturn: opts.liquidReturn,
    lockedReturn: opts.lockedReturn,
    endingCorpus: last ? last.totalCorpus : 0,
  };
}
