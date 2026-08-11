// CRUD routes for goals (docs/10 Phase 4). Nested under /plans/:planId/goals.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "../../db";
import { goals } from "../../db/schema";
import { CreateGoalSchema, UpdateGoalSchema, GoalSchema } from "../schemas";
import { notFound, validateOrThrow, HttpError } from "../errors";
import { guardPlan } from "./helpers";

export function registerGoalRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>("/plans/:planId/goals", async (req, reply) => {
    return reply.send(db.select().from(goals).where(eq(goals.planId, req.params.planId)).all());
  });

  app.post<{ Params: { planId: string }; Body: unknown }>("/plans/:planId/goals", async (req, reply) => {
    guardPlan(db, req.params.planId);
    const body = validateOrThrow(CreateGoalSchema, req.body);
    const row = {
      id: randomUUID(),
      planId: req.params.planId,
      label: body.label,
      costToday: body.costToday,
      costInflationRate: body.costInflationRate,
      expectedRoi: body.expectedRoi,
      currentSavingsEarmarked: body.currentSavingsEarmarked,
      targetYear: body.targetYear ?? null,
      beneficiaryName: body.beneficiaryName ?? null,
      beneficiaryCurrentAge: body.beneficiaryCurrentAge ?? null,
      targetAge: body.targetAge ?? null,
    };
    db.insert(goals).values(row).run();
    return reply.code(201).send(GoalSchema.parse(row));
  });

  app.get<{ Params: { planId: string; goalId: string } }>(
    "/plans/:planId/goals/:goalId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(goals)
        .where(and(eq(goals.id, req.params.goalId), eq(goals.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Goal"));
      return reply.send(row);
    },
  );

  app.put<{ Params: { planId: string; goalId: string }; Body: unknown }>(
    "/plans/:planId/goals/:goalId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(goals)
        .where(and(eq(goals.id, req.params.goalId), eq(goals.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Goal"));

      const body = validateOrThrow(UpdateGoalSchema, req.body);
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "No fields to update", "EMPTY_UPDATE");
      }
      db.update(goals).set(body).where(eq(goals.id, req.params.goalId)).run();
      const [updated] = db
        .select()
        .from(goals)
        .where(eq(goals.id, req.params.goalId))
        .limit(1)
        .all();
      return reply.send(updated);
    },
  );

  app.delete<{ Params: { planId: string; goalId: string } }>(
    "/plans/:planId/goals/:goalId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(goals)
        .where(and(eq(goals.id, req.params.goalId), eq(goals.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Goal"));
      db.delete(goals).where(eq(goals.id, req.params.goalId)).run();
      return reply.code(204).send();
    },
  );
}
