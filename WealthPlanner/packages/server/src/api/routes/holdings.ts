// Direct Holdings routes (docs/09 §9.1). Buy (create a lot), Sell (record a
// disposal against lots in FIFO order with realized gain/tax), Update Price
// (per-ticker price entry), and Record Yield Income — for
// MARKET_LINKED_DIRECT and DIGITAL_ASSET accounts. The account's currentBalance
// is kept equal to Σ remaining quantity × latest price (docs/06 §6.1).

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "../../db";
import {
  accounts,
  lots,
  lotDisposals,
  tickerPriceEntries,
  yieldIncomeEntries,
  plans,
} from "../../db/schema";
import {
  CreateLotSchema,
  SellRequestSchema,
  CreateTickerPriceSchema,
  CreateYieldIncomeSchema,
} from "../schemas";
import { notFound, validateOrThrow, HttpError } from "../errors";
import { guardPlan } from "./helpers";
import { remainingQuantity, toAdjustedLot } from "@wealthpath/engine";
import { computeGainsTax } from "@wealthpath/engine";
import { loadPack } from "@wealthpath/jurisdictions";

type LatestPriceMap = Record<string, { date: string; price: number }>;

// OpenAPI response shapes (JSON Schema) used to document the holdings routes.
const disposalSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    lotId: { type: "string" },
    date: { type: "string", format: "date" },
    quantity: { type: "number" },
    pricePerUnit: { type: "number" },
    realizedGain: { type: "number" },
    realizedTax: { type: "number" },
  },
} as const;

const lotSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    accountId: { type: "string" },
    ticker: { type: "string" },
    quantity: { type: "number" },
    acquisitionDate: { type: "string", format: "date" },
    acquisitionPricePerUnit: { type: "number" },
    remainingQuantity: { type: "number" },
    disposals: { type: "array", items: disposalSchema },
  },
} as const;

const yieldEntrySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    accountId: { type: "string" },
    date: { type: "string", format: "date" },
    amount: { type: "number" },
    description: { type: ["string", "null"] },
  },
} as const;

function latestPrices(rows: typeof tickerPriceEntries.$inferSelect[]): LatestPriceMap {
  const latest: LatestPriceMap = {};
  for (const p of rows) {
    const prev = latest[p.ticker];
    if (!prev || p.asOfDate > prev.date) latest[p.ticker] = { date: p.asOfDate, price: p.pricePerUnit };
  }
  return latest;
}

function assertAccount(db: Db, planId: string, accountId: string) {
  const [account] = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.planId, planId)))
    .limit(1)
    .all();
  if (!account) throw notFound("Account");
  if (account.instrumentType !== "MARKET_LINKED_DIRECT" && account.instrumentType !== "DIGITAL_ASSET") {
    throw new HttpError(400, "Direct Holdings only applies to MARKET_LINKED_DIRECT / DIGITAL_ASSET accounts", "NOT_DIRECT_HOLDING");
  }
  return account;
}

/** Recomputes an account's currentBalance from its lots and latest prices. */
function refreshBalance(db: Db, accountId: string) {
  const lotRows = db.select().from(lots).where(eq(lots.accountId, accountId)).all();
  const disposalRows = db.select().from(lotDisposals).all();
  const priceRows = db.select().from(tickerPriceEntries).where(eq(tickerPriceEntries.accountId, accountId)).all();
  const latest = latestPrices(priceRows);
  let value = 0;
  for (const lot of lotRows) {
    const price = latest[lot.ticker];
    if (price === undefined) continue;
    value += remainingQuantity({ ...lot, disposals: disposalRows.filter((d) => d.lotId === lot.id) }) * price.price;
  }
  db.update(accounts).set({ currentBalance: value }).where(eq(accounts.id, accountId)).run();
  return value;
}

export function registerHoldingsRoutes(app: FastifyInstance, db: Db): void {
  const summary = (planId: string, accountId: string) => {
    const lotRows = db.select().from(lots).where(eq(lots.accountId, accountId)).all();
    const disposalRows = db.select().from(lotDisposals).all();
    const priceRows = db.select().from(tickerPriceEntries).where(eq(tickerPriceEntries.accountId, accountId)).all();
    const yieldRows = db.select().from(yieldIncomeEntries).where(eq(yieldIncomeEntries.accountId, accountId)).all();
    const latest = latestPrices(priceRows);
    const enriched = lotRows.map((l) => {
      const adjusted = toAdjustedLot({ ...l, disposals: disposalRows.filter((d) => d.lotId === l.id) });
      return { ...l, remainingQuantity: adjusted.remainingQuantity, disposals: adjusted.disposals };
    });
    let currentValue = 0;
    for (const lot of enriched) {
      const price = latest[lot.ticker];
      if (price !== undefined) currentValue += lot.remainingQuantity * price.price;
    }
    return {
      planId,
      accountId,
      lots: enriched,
      latestPrices: Object.fromEntries(Object.entries(latest).map(([t, v]) => [t, v.price])),
      yieldEntries: yieldRows,
      currentValue,
    };
  };

  app.get<{ Params: { planId: string; accountId: string } }>(
    "/plans/:planId/holdings/:accountId",
    {
      schema: {
        tags: ["holdings"],
        params: {
          type: "object",
          required: ["planId", "accountId"],
          properties: { planId: { type: "string" }, accountId: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              planId: { type: "string" },
              accountId: { type: "string" },
              currentValue: { type: "number" },
              latestPrices: { type: "object", additionalProperties: { type: "number" } },
              lots: { type: "array", items: lotSchema },
              yieldEntries: { type: "array", items: yieldEntrySchema },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      assertAccount(db, req.params.planId, req.params.accountId);
      return reply.send(summary(req.params.planId, req.params.accountId));
    },
  );

  // Buy — create a lot.
  app.post<{ Params: { planId: string; accountId: string }; Body: unknown }>(
    "/plans/:planId/holdings/:accountId/lots",
    {
      schema: {
        tags: ["holdings"],
        params: {
          type: "object",
          required: ["planId", "accountId"],
          properties: { planId: { type: "string" }, accountId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["ticker", "quantity", "acquisitionDate", "acquisitionPricePerUnit"],
          properties: {
            ticker: { type: "string" },
            quantity: { type: "number" },
            acquisitionDate: { type: "string", format: "date" },
            acquisitionPricePerUnit: { type: "number" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              lot: { type: "object" },
              currentValue: { type: "number" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      assertAccount(db, req.params.planId, req.params.accountId);
      const body = validateOrThrow(CreateLotSchema, req.body);
      const row = {
        id: randomUUID(),
        accountId: req.params.accountId,
        ticker: body.ticker,
        quantity: body.quantity,
        acquisitionDate: body.acquisitionDate,
        acquisitionPricePerUnit: body.acquisitionPricePerUnit,
      };
      db.insert(lots).values(row).run();
      const value = refreshBalance(db, req.params.accountId);
      db.update(accounts)
        .set({ lastUpdated: new Date().toISOString() })
        .where(eq(accounts.id, req.params.accountId))
        .run();
      return reply.code(201).send({ lot: row, currentValue: value });
    },
  );

  // Sell — record a disposal against lots in FIFO order, computing realized
  // gain/tax per consumed lot via the engine.
  app.post<{ Params: { planId: string; accountId: string }; Body: unknown }>(
    "/plans/:planId/holdings/:accountId/sell",
    {
      schema: {
        tags: ["holdings"],
        params: {
          type: "object",
          required: ["planId", "accountId"],
          properties: { planId: { type: "string" }, accountId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["date", "quantity", "pricePerUnit"],
          properties: {
            date: { type: "string", format: "date" },
            quantity: { type: "number" },
            pricePerUnit: { type: "number" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              disposals: { type: "array", items: { type: "object" } },
              totalGain: { type: "number" },
              totalTax: { type: "number" },
              currentValue: { type: "number" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      const account = assertAccount(db, req.params.planId, req.params.accountId);
      const body = validateOrThrow(SellRequestSchema, req.body);

      const [plan] = db.select().from(plans).where(eq(plans.id, req.params.planId)).limit(1).all();
      const pack = loadPack(plan.jurisdictionPackId);
      const rule = pack.capitalGains?.[account.instrumentType];
      if (!rule || typeof rule === "string") {
        throw new HttpError(400, `No capitalGains rule for ${account.instrumentType}`, "NO_CAPITAL_GAINS_RULE");
      }

      const lotRows = db.select().from(lots).where(eq(lots.accountId, req.params.accountId)).all();
      const disposalRows = db.select().from(lotDisposals).all();
      const available = lotRows
        .map((l) => ({ ...l, remaining: remainingQuantity({ ...l, disposals: disposalRows.filter((d) => d.lotId === l.id) }) }))
        .sort((a, b) => new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime());

      let remainingQty = body.quantity;
      const created: unknown[] = [];
      let totalGain = 0;
      let totalTax = 0;
      for (const lot of available) {
        if (remainingQty <= 1e-9) break;
        const take = Math.min(remainingQty, lot.remaining);
        if (take <= 0) continue;
        const gain = (body.pricePerUnit - lot.acquisitionPricePerUnit) * take;
        const holdingDays = Math.floor(
          (new Date(body.date).getTime() - new Date(lot.acquisitionDate).getTime()) / 86_400_000,
        );
        const tax = computeGainsTax(gain, holdingDays, rule, pack);
        totalGain += gain;
        totalTax += tax;
        const disposal = {
          id: randomUUID(),
          lotId: lot.id,
          date: body.date,
          quantity: take,
          pricePerUnit: body.pricePerUnit,
          realizedGain: gain,
          realizedTax: tax,
        };
        db.insert(lotDisposals).values(disposal).run();
        created.push(disposal);
        remainingQty -= take;
      }
      if (remainingQty > 1e-9) {
        throw new HttpError(400, "Disposal quantity exceeds available lot quantity", "INSUFFICIENT_LOTS");
      }

      const currentValue = refreshBalance(db, req.params.accountId);
      return reply.code(201).send({
        disposals: created,
        totalGain,
        totalTax,
        currentValue,
      });
    },
  );

  // Update Price — record the latest per-ticker price.
  app.post<{ Params: { planId: string; accountId: string }; Body: unknown }>(
    "/plans/:planId/holdings/:accountId/prices",
    {
      schema: {
        tags: ["holdings"],
        params: {
          type: "object",
          required: ["planId", "accountId"],
          properties: { planId: { type: "string" }, accountId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["ticker", "asOfDate", "pricePerUnit"],
          properties: {
            ticker: { type: "string" },
            asOfDate: { type: "string", format: "date" },
            pricePerUnit: { type: "number" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              priceEntry: { type: "object" },
              currentValue: { type: "number" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      assertAccount(db, req.params.planId, req.params.accountId);
      const body = validateOrThrow(CreateTickerPriceSchema, req.body);
      const row = {
        id: randomUUID(),
        accountId: req.params.accountId,
        ticker: body.ticker,
        asOfDate: body.asOfDate,
        pricePerUnit: body.pricePerUnit,
      };
      db.insert(tickerPriceEntries).values(row).run();
      const currentValue = refreshBalance(db, req.params.accountId);
      return reply.code(201).send({ priceEntry: row, currentValue });
    },
  );

  // Record Yield Income.
  app.post<{ Params: { planId: string; accountId: string }; Body: unknown }>(
    "/plans/:planId/holdings/:accountId/yield",
    {
      schema: {
        tags: ["holdings"],
        params: {
          type: "object",
          required: ["planId", "accountId"],
          properties: { planId: { type: "string" }, accountId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["date", "amount"],
          properties: {
            date: { type: "string", format: "date" },
            amount: { type: "number" },
            description: { type: "string" },
          },
        },
        response: {
          201: { type: "object", properties: { id: { type: "string" }, amount: { type: "number" } } },
        },
      },
    },
    async (req, reply) => {
      guardPlan(db, req.params.planId);
      assertAccount(db, req.params.planId, req.params.accountId);
      const body = validateOrThrow(CreateYieldIncomeSchema, req.body);
      const row = {
        id: randomUUID(),
        accountId: req.params.accountId,
        date: body.date,
        amount: body.amount,
        description: body.description ?? null,
      };
      db.insert(yieldIncomeEntries).values(row).run();
      return reply.code(201).send(row);
    },
  );
}
