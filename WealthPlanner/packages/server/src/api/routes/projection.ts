// Read-only deterministic projection route (docs/10 Phase 4, docs/06 §6.3).
// Returns the year-by-year two-sleeve projection for a plan.

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { projectPlan } from "../../projection";
import { notFound } from "../errors";

export function registerProjectionRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>("/plans/:planId/projection", async (req, reply) => {
    const result = projectPlan(db, req.params.planId);
    if (!result) return reply.code(404).send(notFound("Plan"));
    return reply.send(result);
  });
}
