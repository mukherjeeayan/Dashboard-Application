// CRUD routes for accounts (docs/10 Phase 4). Accounts belong to a plan and are
// always addressed under /plans/:planId/accounts.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "../../db";
import { accounts, plans } from "../../db/schema";
import { CreateAccountSchema, UpdateAccountSchema, AccountSchema } from "../schemas";
import { notFound, validateOrThrow, HttpError } from "../errors";

export function registerAccountRoutes(app: FastifyInstance, db: Db): void {
  const assertPlan = (planId: string) => {
    const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
    if (!plan) throw notFound("Plan");
  };

  app.get<{ Params: { planId: string } }>("/plans/:planId/accounts", async (req, reply) => {
    const rows = db
      .select()
      .from(accounts)
      .where(eq(accounts.planId, req.params.planId))
      .all();
    return reply.send(rows);
  });

  app.post<{ Params: { planId: string }; Body: unknown }>("/plans/:planId/accounts", async (req, reply) => {
    assertPlan(req.params.planId);
    const body = validateOrThrow(CreateAccountSchema, req.body);
    const row = {
      id: randomUUID(),
      planId: req.params.planId,
      label: body.label,
      instrumentType: body.instrumentType,
      positionStructure: body.positionStructure,
      liquidity: body.liquidity,
      jurisdictionRuleRef: body.jurisdictionRuleRef,
      currency: body.currency,
      openedDate: body.openedDate ?? null,
      contributionRuleJson: body.contributionRuleJson,
      roiRuleJson: body.roiRuleJson,
      currentBalance: body.currentBalance,
      bucketSplitJson: body.bucketSplitJson ?? null,
      lastUpdated: new Date().toISOString(),
    };
    db.insert(accounts).values(row).run();
    return reply.code(201).send(AccountSchema.parse(row));
  });

  app.get<{ Params: { planId: string; accountId: string } }>(
    "/plans/:planId/accounts/:accountId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, req.params.accountId), eq(accounts.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Account"));
      return reply.send(row);
    },
  );

  app.put<{ Params: { planId: string; accountId: string }; Body: unknown }>(
    "/plans/:planId/accounts/:accountId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, req.params.accountId), eq(accounts.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Account"));

      const body = validateOrThrow(UpdateAccountSchema, req.body);
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "No fields to update", "EMPTY_UPDATE");
      }
      const updates = { ...body, lastUpdated: new Date().toISOString() };
      db.update(accounts).set(updates).where(eq(accounts.id, req.params.accountId)).run();

      const [updated] = db
        .select()
        .from(accounts)
        .where(eq(accounts.id, req.params.accountId))
        .limit(1)
        .all();
      return reply.send(updated);
    },
  );

  app.delete<{ Params: { planId: string; accountId: string } }>(
    "/plans/:planId/accounts/:accountId",
    async (req, reply) => {
      const [row] = db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, req.params.accountId), eq(accounts.planId, req.params.planId)))
        .limit(1)
        .all();
      if (!row) return reply.code(404).send(notFound("Account"));
      db.delete(accounts).where(eq(accounts.id, req.params.accountId)).run();
      return reply.code(204).send();
    },
  );
}
