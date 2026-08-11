// CRUD routes for plans (docs/10 Phase 4). A plan is the top-level aggregate;
// assumptions and accounts hang off it.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { plans } from "../../db/schema";
import { CreatePlanSchema, UpdatePlanSchema, PlanSchema } from "../schemas";
import { notFound, validateOrThrow, HttpError } from "../errors";

export function registerPlanRoutes(app: FastifyInstance, db: Db): void {
  app.get("/plans", async () => {
    return db.select().from(plans).all();
  });

  app.post<{ Body: unknown }>("/plans", async (req, reply) => {
    const body = validateOrThrow(CreatePlanSchema, req.body);
    const row = {
      id: randomUUID(),
      ownerName: body.ownerName ?? null,
      dateOfBirth: body.dateOfBirth,
      targetRetirementDate: body.targetRetirementDate,
      baseCurrency: body.baseCurrency,
      jurisdictionPackId: body.jurisdictionPackId,
      createdAt: new Date().toISOString(),
    };
    db.insert(plans).values(row).run();
    return reply.code(201).send(PlanSchema.parse(row));
  });

  app.get<{ Params: { planId: string } }>("/plans/:planId", async (req, reply) => {
    const [plan] = db.select().from(plans).where(eq(plans.id, req.params.planId)).limit(1).all();
    if (!plan) return reply.code(404).send(notFound("Plan"));
    return reply.send(plan);
  });

  app.put<{ Params: { planId: string }; Body: unknown }>("/plans/:planId", async (req, reply) => {
    const body = validateOrThrow(UpdatePlanSchema, req.body);
    const [plan] = db.select().from(plans).where(eq(plans.id, req.params.planId)).limit(1).all();
    if (!plan) return reply.code(404).send(notFound("Plan"));

    const updates = {
      ...(body.ownerName !== undefined ? { ownerName: body.ownerName } : {}),
      ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth } : {}),
      ...(body.targetRetirementDate !== undefined
        ? { targetRetirementDate: body.targetRetirementDate }
        : {}),
      ...(body.baseCurrency !== undefined ? { baseCurrency: body.baseCurrency } : {}),
      ...(body.jurisdictionPackId !== undefined
        ? { jurisdictionPackId: body.jurisdictionPackId }
        : {}),
    };
    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, "No fields to update", "EMPTY_UPDATE");
    }
    db.update(plans).set(updates).where(eq(plans.id, req.params.planId)).run();
    const [updated] = db
      .select()
      .from(plans)
      .where(eq(plans.id, req.params.planId))
      .limit(1)
      .all();
    return reply.send(updated);
  });

  app.delete<{ Params: { planId: string } }>("/plans/:planId", async (req, reply) => {
    const [plan] = db.select().from(plans).where(eq(plans.id, req.params.planId)).limit(1).all();
    if (!plan) return reply.code(404).send(notFound("Plan"));
    db.delete(plans).where(eq(plans.id, req.params.planId)).run();
    return reply.code(204).send();
  });
}
