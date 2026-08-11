// CRUD routes for major expenses (docs/10 Phase 4).
// Nested under /plans/:planId/expenses.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "../../db";
import { majorExpenses } from "../../db/schema";
import { CreateMajorExpenseSchema, UpdateMajorExpenseSchema, MajorExpenseSchema } from "../schemas";
import { notFound, validateOrThrow, HttpError } from "../errors";
import { guardPlan } from "./helpers";

export function registerExpenseRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>("/plans/:planId/expenses", async (req, reply) => {
    return reply.send(
      db.select().from(majorExpenses).where(eq(majorExpenses.planId, req.params.planId)).all(),
    );
  });

  app.post<{ Params: { planId: string }; Body: unknown }>("/plans/:planId/expenses", async (req, reply) => {
    guardPlan(db, req.params.planId);
    const body = validateOrThrow(CreateMajorExpenseSchema, req.body);
    const row = { id: randomUUID(), planId: req.params.planId, ...body };
    db.insert(majorExpenses).values(row).run();
    return reply.code(201).send(MajorExpenseSchema.parse(row));
  });

  app.get<{ Params: { planId: string; expenseId: string } }>(
    "/plans/:planId/expenses/:expenseId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(majorExpenses)
        .where(and(eq(majorExpenses.id, req.params.expenseId), eq(majorExpenses.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Major expense"));
      return reply.send(row);
    },
  );

  app.put<{ Params: { planId: string; expenseId: string }; Body: unknown }>(
    "/plans/:planId/expenses/:expenseId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(majorExpenses)
        .where(and(eq(majorExpenses.id, req.params.expenseId), eq(majorExpenses.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Major expense"));

      const body = validateOrThrow(UpdateMajorExpenseSchema, req.body);
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "No fields to update", "EMPTY_UPDATE");
      }
      db.update(majorExpenses).set(body).where(eq(majorExpenses.id, req.params.expenseId)).run();
      const [updated] = db
        .select()
        .from(majorExpenses)
        .where(eq(majorExpenses.id, req.params.expenseId))
        .limit(1)
        .all();
      return reply.send(updated);
    },
  );

  app.delete<{ Params: { planId: string; expenseId: string } }>(
    "/plans/:planId/expenses/:expenseId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(majorExpenses)
        .where(and(eq(majorExpenses.id, req.params.expenseId), eq(majorExpenses.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Major expense"));
      db.delete(majorExpenses).where(eq(majorExpenses.id, req.params.expenseId)).run();
      return reply.code(204).send();
    },
  );
}
