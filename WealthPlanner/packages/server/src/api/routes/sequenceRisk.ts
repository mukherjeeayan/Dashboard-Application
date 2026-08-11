// Sequence Risk route (docs/10 Phase 4, docs/06 §6.5, source §3.5). The user
// enters a series of annual returns (replacing the workbook's "paste into
// column B"); the engine runs the same series forward and reversed and reports
// the ending-corpus gap. The series is persisted to `sequence_risk_returns`.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sequenceRisk } from "@wealthpath/engine";
import type { Db } from "../../db";
import { accounts, plans, sequenceRiskReturns } from "../../db/schema";
import { notFound } from "../errors";
import { guardPlan } from "./helpers";

const ReturnRowSchema = z.object({
  yearIndex: z.number().int().nonnegative(),
  annualReturn: z.number().finite(),
});

const PutBodySchema = z.object({
  returns: z.array(ReturnRowSchema),
});

export function registerSequenceRiskRoutes(app: FastifyInstance, db: Db): void {
  const netWorth = (planId: string): number => {
    const planAccounts = db.select().from(accounts).where(eq(accounts.planId, planId)).all();
    return planAccounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  };

  const loadSeries = (planId: string) =>
    db
      .select()
      .from(sequenceRiskReturns)
      .where(eq(sequenceRiskReturns.planId, planId))
      .orderBy(sequenceRiskReturns.yearIndex)
      .all();

  const compute = (planId: string) => {
    const series = loadSeries(planId);
    const returns = series.map((r) => r.annualReturn);
    const startingBalance = netWorth(planId);
    const result = returns.length > 0
      ? sequenceRisk(returns, startingBalance, 0)
      : null;
    return {
      returns: series.map((r) => ({ yearIndex: r.yearIndex, annualReturn: r.annualReturn })),
      startingBalance,
      result,
    };
  };

  app.get<{ Params: { planId: string } }>("/plans/:planId/sequence-risk", async (req, reply) => {
    const [plan] = db.select().from(plans).where(eq(plans.id, req.params.planId)).limit(1).all();
    if (!plan) return reply.code(404).send(notFound("Plan"));
    return reply.send(compute(req.params.planId));
  });

  app.put<{ Params: { planId: string }; Body: unknown }>(
    "/plans/:planId/sequence-risk",
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      const body = PutBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: "Invalid body", details: body.error.flatten() });
      }
      const planId = req.params.planId;

      db.transaction((tx) => {
        tx.delete(sequenceRiskReturns).where(eq(sequenceRiskReturns.planId, planId)).run();
        for (const row of body.data.returns) {
          tx.insert(sequenceRiskReturns)
            .values({ id: randomUUID(), planId, yearIndex: row.yearIndex, annualReturn: row.annualReturn })
            .run();
        }
      });

      return reply.send(compute(planId));
    },
  );
}
