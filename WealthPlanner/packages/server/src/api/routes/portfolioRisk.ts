// Read-only Portfolio Risk dashboard route (docs/10 Phase 4, docs/06 §6.5).
// Computed on demand from stored accounts + assumptions — no tables of its own.

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { projectPortfolioRisk } from "../../portfolioRisk";
import { notFound } from "../errors";

export function registerPortfolioRiskRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>("/plans/:planId/portfolio-risk", async (req, reply) => {
    const result = projectPortfolioRisk(db, { planId: req.params.planId });
    if (!result) return reply.code(404).send(notFound("Plan"));
    return reply.send(result);
  });
}
