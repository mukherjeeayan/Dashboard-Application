// CRUD routes for liabilities (docs/10 Phase 4). Nested under /plans/:planId/liabilities.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "../../db";
import { liabilities } from "../../db/schema";
import { CreateLiabilitySchema, UpdateLiabilitySchema, LiabilitySchema } from "../schemas";
import { notFound, validateOrThrow, HttpError } from "../errors";
import { guardPlan } from "./helpers";

export function registerLiabilityRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>("/plans/:planId/liabilities", async (req, reply) => {
    return reply.send(
      db.select().from(liabilities).where(eq(liabilities.planId, req.params.planId)).all(),
    );
  });

  app.post<{ Params: { planId: string }; Body: unknown }>(
    "/plans/:planId/liabilities",
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      const body = validateOrThrow(CreateLiabilitySchema, req.body);
      const row = { id: randomUUID(), planId: req.params.planId, ...body };
      db.insert(liabilities).values(row).run();
      return reply.code(201).send(LiabilitySchema.parse(row));
    },
  );

  app.get<{ Params: { planId: string; liabilityId: string } }>(
    "/plans/:planId/liabilities/:liabilityId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(liabilities)
        .where(and(eq(liabilities.id, req.params.liabilityId), eq(liabilities.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Liability"));
      return reply.send(row);
    },
  );

  app.put<{ Params: { planId: string; liabilityId: string }; Body: unknown }>(
    "/plans/:planId/liabilities/:liabilityId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(liabilities)
        .where(and(eq(liabilities.id, req.params.liabilityId), eq(liabilities.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Liability"));

      const body = validateOrThrow(UpdateLiabilitySchema, req.body);
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "No fields to update", "EMPTY_UPDATE");
      }
      db.update(liabilities).set(body).where(eq(liabilities.id, req.params.liabilityId)).run();
      const [updated] = db
        .select()
        .from(liabilities)
        .where(eq(liabilities.id, req.params.liabilityId))
        .limit(1)
        .all();
      return reply.send(updated);
    },
  );

  app.delete<{ Params: { planId: string; liabilityId: string } }>(
    "/plans/:planId/liabilities/:liabilityId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(liabilities)
        .where(and(eq(liabilities.id, req.params.liabilityId), eq(liabilities.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Liability"));
      db.delete(liabilities).where(eq(liabilities.id, req.params.liabilityId)).run();
      return reply.code(204).send();
    },
  );
}
