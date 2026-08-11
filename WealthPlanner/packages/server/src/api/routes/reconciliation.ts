// Balance Reconciliation (docs/09 §9.1, §9.3 step 5). Bulk period-end entry of
// actual balances for a plan's accounts, replacing the source workbook's manual
// reconciliation column. Writes each actual balance back to the account's
// currentBalance and records a row in account_balance_history for the period.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { accounts, accountBalanceHistory } from "../../db/schema";
import { ReconciliationSchema } from "../schemas";
import { validateOrThrow, HttpError } from "../errors";
import { guardPlan } from "./helpers";

export function registerReconciliationRoutes(app: FastifyInstance, db: Db): void {
  // List the accounts available for reconciliation (current balances prefilled).
  app.get<{ Params: { planId: string } }>(
    "/plans/:planId/reconciliation",
    {
      schema: {
        tags: ["reconciliation"],
        params: {
          type: "object",
          required: ["planId"],
          properties: { planId: { type: "string" } },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                accountId: { type: "string" },
                label: { type: "string" },
                instrumentType: { type: "string" },
                currentBalance: { type: "number" },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      const rows = db
        .select()
        .from(accounts)
        .where(eq(accounts.planId, req.params.planId))
        .all();
      return reply.send(
        rows.map((a) => ({
          accountId: a.id,
          label: a.label,
          instrumentType: a.instrumentType,
          currentBalance: a.currentBalance,
        })),
      );
    },
  );

  app.put<{ Params: { planId: string }; Body: unknown }>(
    "/plans/:planId/reconciliation",
    {
      schema: {
        tags: ["reconciliation"],
        params: {
          type: "object",
          required: ["planId"],
          properties: { planId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["periodEnd", "rows"],
          properties: {
            periodEnd: { type: "string", format: "date" },
            rows: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["accountId", "actualBalance"],
                properties: {
                  accountId: { type: "string" },
                  actualBalance: { type: "number" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              periodEnd: { type: "string" },
              reconciled: { type: "number" },
              rows: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      const body = validateOrThrow(ReconciliationSchema, req.body);
      const accountIds = new Set(
        db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.planId, req.params.planId))
          .all()
          .map((r) => r.id),
      );

      const saved: unknown[] = [];
      const now = new Date().toISOString();
      for (const row of body.rows) {
        if (!accountIds.has(row.accountId)) {
          throw new HttpError(400, `Account ${row.accountId} does not belong to this plan`, "FOREIGN_ACCOUNT");
        }
        db.update(accounts)
          .set({ currentBalance: row.actualBalance, lastUpdated: now })
          .where(eq(accounts.id, row.accountId))
          .run();
        const history = {
          id: randomUUID(),
          accountId: row.accountId,
          periodEnd: body.periodEnd,
          actualBalance: row.actualBalance,
          projectedBalance: null,
        };
        db.insert(accountBalanceHistory).values(history).run();
        saved.push({ accountId: row.accountId, actualBalance: row.actualBalance, periodEnd: body.periodEnd });
      }
      return reply.send({ periodEnd: body.periodEnd, reconciled: saved.length, rows: saved });
    },
  );
}
