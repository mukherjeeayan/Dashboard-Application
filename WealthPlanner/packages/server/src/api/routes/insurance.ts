// CRUD routes for insurance policies (docs/10 Phase 4).
// Nested under /plans/:planId/insurance.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "../../db";
import { insurancePolicies } from "../../db/schema";
import { CreateInsurancePolicySchema, UpdateInsurancePolicySchema, InsurancePolicySchema } from "../schemas";
import { notFound, validateOrThrow, HttpError } from "../errors";
import { guardPlan } from "./helpers";

export function registerInsuranceRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Params: { planId: string } }>("/plans/:planId/insurance", async (req, reply) => {
    return reply.send(
      db.select().from(insurancePolicies).where(eq(insurancePolicies.planId, req.params.planId)).all(),
    );
  });

  app.post<{ Params: { planId: string }; Body: unknown }>("/plans/:planId/insurance", async (req, reply) => {
    guardPlan(db, req.params.planId);
    const body = validateOrThrow(CreateInsurancePolicySchema, req.body);
    const row = { id: randomUUID(), planId: req.params.planId, ...body };
    db.insert(insurancePolicies).values(row).run();
    return reply.code(201).send(InsurancePolicySchema.parse(row));
  });

  app.get<{ Params: { planId: string; policyId: string } }>(
    "/plans/:planId/insurance/:policyId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(insurancePolicies)
        .where(and(eq(insurancePolicies.id, req.params.policyId), eq(insurancePolicies.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Insurance policy"));
      return reply.send(row);
    },
  );

  app.put<{ Params: { planId: string; policyId: string }; Body: unknown }>(
    "/plans/:planId/insurance/:policyId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(insurancePolicies)
        .where(and(eq(insurancePolicies.id, req.params.policyId), eq(insurancePolicies.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Insurance policy"));

      const body = validateOrThrow(UpdateInsurancePolicySchema, req.body);
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "No fields to update", "EMPTY_UPDATE");
      }
      db.update(insurancePolicies).set(body).where(eq(insurancePolicies.id, req.params.policyId)).run();
      const [updated] = db
        .select()
        .from(insurancePolicies)
        .where(eq(insurancePolicies.id, req.params.policyId))
        .limit(1)
        .all();
      return reply.send(updated);
    },
  );

  app.delete<{ Params: { planId: string; policyId: string } }>(
    "/plans/:planId/insurance/:policyId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(insurancePolicies)
        .where(and(eq(insurancePolicies.id, req.params.policyId), eq(insurancePolicies.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Insurance policy"));
      db.delete(insurancePolicies).where(eq(insurancePolicies.id, req.params.policyId)).run();
      return reply.code(204).send();
    },
  );
}
