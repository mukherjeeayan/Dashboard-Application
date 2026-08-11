// Read-only Action Items & Deadlines route (docs/10 Phase 4, docs/06 §6.8).

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { buildActionItemsForPlan } from "../../actionItems";
import { notFound } from "../errors";

export function registerActionItemRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>(
    "/plans/:planId/action-items",
    async (req, reply) => {
      const result = buildActionItemsForPlan(db, req.params.planId);
      if (!result) return reply.code(404).send(notFound("Plan"));
      return reply.send(result);
    },
  );
}
