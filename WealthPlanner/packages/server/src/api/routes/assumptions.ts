// CRUD routes for plan assumptions (docs/10 Phase 4). Assumptions are keyed by
// planId and replaced wholesale via PUT (upsert) — there is no separate create
// for an already-seeded assumptions row.

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { planAssumptions, plans } from "../../db/schema";
import { UpsertAssumptionSchema } from "../schemas";
import { notFound, validateOrThrow } from "../errors";

export function registerAssumptionRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>("/plans/:planId/assumptions", async (req, reply) => {
    const [row] = db
      .select()
      .from(planAssumptions)
      .where(eq(planAssumptions.planId, req.params.planId))
      .limit(1)
      .all();
    if (!row) return reply.code(404).send(notFound("Assumptions"));
    return reply.send(row);
  });

  app.put<{ Params: { planId: string }; Body: unknown }>("/plans/:planId/assumptions", async (req, reply) => {
    const body = validateOrThrow(UpsertAssumptionSchema, req.body);
    const planId = req.params.planId;

    const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
    if (!plan) return reply.code(404).send(notFound("Plan"));

    const values = { ...body, planId };
    db.insert(planAssumptions)
      .values(values)
      .onConflictDoUpdate({ target: planAssumptions.planId, set: values })
      .run();

    const [row] = db
      .select()
      .from(planAssumptions)
      .where(eq(planAssumptions.planId, planId))
      .limit(1)
      .all();
    return reply.send(row);
  });
}
