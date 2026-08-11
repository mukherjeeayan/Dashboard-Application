// Read-only Tax analysis route (docs/09 "Tax"). Post-tax retention ratio for
// SWP vs lump-sum drawdown using the plan's accounts + pack tax rules.

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { projectTaxAnalysis } from "../../taxAnalysis";
import { notFound } from "../errors";

export function registerTaxAnalysisRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>(
    "/plans/:planId/tax-analysis",
    async (req, reply) => {
      const result = projectTaxAnalysis(db, req.params.planId);
      if (!result) return reply.code(404).send(notFound("Plan"));
      return reply.send(result);
    },
  );
}
