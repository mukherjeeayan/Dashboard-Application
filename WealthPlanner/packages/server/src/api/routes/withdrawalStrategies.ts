// GET /plans/:planId/withdrawal-strategies — compares the jurisdiction's
// withdrawal waterfall against a simple pooled draw on the same two-sleeve
// projection, exposing how much ending corpus (if any) the ordering rules save.

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { projectWithdrawalStrategies } from "../../projection";
import { notFound } from "../errors";

export function registerWithdrawalStrategyRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>(
    "/plans/:planId/withdrawal-strategies",
    async (request, reply) => {
      const result = projectWithdrawalStrategies(db, request.params.planId);
      if (!result) {
        return reply.code(404).send(notFound("Plan"));
      }
      return reply.send(result);
    },
  );
}
