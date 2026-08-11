// Emergency Fund (docs/09 §9.3, engine emergencyFund.ts). Computes the real
// (today's-money) purchasing-power assessment of the plan's liquid cash against
// a user-supplied coverage target. Inputs are taken per-request so the panel can
// let the user experiment with coverage months and monthly expense.

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { accounts, planAssumptions } from "../../db/schema";
import { EmergencyFundRequestSchema } from "../schemas";
import { validateOrThrow } from "../errors";
import { guardPlan } from "./helpers";
import { assessEmergencyFund } from "@wealthpath/engine";

export function registerEmergencyFundRoutes(app: FastifyInstance, db: Db): void {
  // Returns current inputs (liquid cash + inflation assumption) for prefilling.
  app.get<{ Params: { planId: string } }>(
    "/plans/:planId/emergency-fund",
    {
      schema: {
        tags: ["emergency-fund"],
        params: {
          type: "object",
          required: ["planId"],
          properties: { planId: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              liquidBalance: { type: "number" },
              inflationRate: { type: "number" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      const rows = db.select().from(accounts).where(eq(accounts.planId, req.params.planId)).all();
      const liquidBalance = rows
        .filter((a) => a.instrumentType === "LIQUID_CASH")
        .reduce((s, a) => s + a.currentBalance, 0);
      const [assumptions] = db
        .select()
        .from(planAssumptions)
        .where(eq(planAssumptions.planId, req.params.planId))
        .limit(1)
        .all();
      return reply.send({
        liquidBalance,
        inflationRate: assumptions?.inflationLongRunMean ?? 0.06,
      });
    },
  );

  app.post<{ Params: { planId: string }; Body: unknown }>(
    "/plans/:planId/emergency-fund",
    {
      schema: {
        tags: ["emergency-fund"],
        params: {
          type: "object",
          required: ["planId"],
          properties: { planId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["targetCoverageMonths", "monthlyExpense"],
          properties: {
            targetCoverageMonths: { type: "number" },
            monthlyExpense: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              planId: { type: "string" },
              targetAmount: { type: "number" },
              currentBalance: { type: "number" },
              realValueAtEnd: { type: "number" },
              gapAtEnd: { type: "number" },
              onTarget: { type: "boolean" },
              liquidBalance: { type: "number" },
              inflationRate: { type: "number" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      const body = validateOrThrow(EmergencyFundRequestSchema, req.body);
      const rows = db.select().from(accounts).where(eq(accounts.planId, req.params.planId)).all();
      const liquidBalance = rows
        .filter((a) => a.instrumentType === "LIQUID_CASH")
        .reduce((s, a) => s + a.currentBalance, 0);
      const [assumptions] = db
        .select()
        .from(planAssumptions)
        .where(eq(planAssumptions.planId, req.params.planId))
        .limit(1)
        .all();
      const result = assessEmergencyFund({
        targetCoverageMonths: body.targetCoverageMonths,
        monthlyExpense: body.monthlyExpense,
        liquidBalance,
        inflationRate: assumptions?.inflationLongRunMean ?? 0.06,
        years: 0,
      });
      return reply.send({ planId: req.params.planId, ...result, liquidBalance, inflationRate: assumptions?.inflationLongRunMean ?? 0.06 });
    },
  );
}
