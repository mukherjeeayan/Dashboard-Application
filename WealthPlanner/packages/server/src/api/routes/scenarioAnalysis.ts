// Read-only Scenario Analysis route (docs/10 Phase 4, docs/06 §6.6). Runs the
// plan's deterministic projection under best / base / worst return assumptions.

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { scenarioAnalysis } from "@wealthpath/engine";
import { buildPlanTwoSleeveInput } from "../../projection";
import { notFound } from "../errors";

export function registerScenarioAnalysisRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>(
    "/plans/:planId/scenario-analysis",
    async (req, reply) => {
      const base = buildPlanTwoSleeveInput(db, req.params.planId);
      if (!base) return reply.code(404).send(notFound("Plan"));
      const result = scenarioAnalysis(base);
      return reply.send({ planId: req.params.planId, ...result });
    },
  );
}
