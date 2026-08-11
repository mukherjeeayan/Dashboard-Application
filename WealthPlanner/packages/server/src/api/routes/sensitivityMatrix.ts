// Read-only Sensitivity Matrix route (docs/10 Phase 4, docs/06 §6.6). Builds
// the plan's two-sleeve input, then varies liquid (x-axis) and locked (y-axis)
// returns over a small grid to report ending-corpus sensitivity.

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { sensitivityMatrix } from "@wealthpath/engine";
import { buildPlanTwoSleeveInput } from "../../projection";
import { notFound } from "../errors";

const LIQUID_RETURNS = [0.08, 0.1, 0.12, 0.14, 0.16];
const LOCKED_RETURNS = [0.05, 0.06, 0.07, 0.08, 0.09];

export function registerSensitivityMatrixRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>(
    "/plans/:planId/sensitivity-matrix",
    async (req, reply) => {
      const base = buildPlanTwoSleeveInput(db, req.params.planId);
      if (!base) return reply.code(404).send(notFound("Plan"));
      const grid = sensitivityMatrix(base, LIQUID_RETURNS, LOCKED_RETURNS);
      return reply.send({ planId: req.params.planId, ...grid });
    },
  );
}
