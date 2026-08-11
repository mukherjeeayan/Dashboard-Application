// HTTP API for Monte Carlo runs (docs/07 §7.6). Exposes:
//   POST /plans/:planId/monte-carlo   -> run the engine (cache-aware); returns
//                                       JSON by default or a text/event-stream
//                                       when the client requests SSE.
//   GET  /plans/:planId/monte-carlo/:runId -> status + result for one run.
//
// The route layer stays thin: it validates the request, projects the plan into
// engine input, and delegates to the orchestration service.

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { Db } from "../db";
import { MonteCarloService } from "./service";
import { MonteCarloPool, type MonteCarloEngine, type MonteCarloJobInput } from "./workerPool";
import { projectSingleBlended, type Overrides, type PlanProjection } from "./planProjection";
import { MonteCarloRunRepository } from "./repository";

const ENGINE_ENUM = ["SINGLE_BLENDED", "CORRELATED", "ACCUMULATION", "MACRO_COMBINED"] as const;

const OverrideSchema = z.object({
  fixedIncomeROI: z.number().optional(),
  inflation: z.number().optional(),
  marketMean: z.number().optional(),
  marketVol: z.number().optional(),
  crashFloor: z.number().optional(),
  trialCount: z.number().int().positive().max(1_000_000).optional(),
  years: z.number().int().positive().optional(),
  seed: z.number().int().nullable().optional(),
  yearlyExpenditure: z.number().optional(),
});

const RunBodySchema = z.object({
  engine: z.enum(ENGINE_ENUM).default("SINGLE_BLENDED"),
  overrides: OverrideSchema.optional(),
});

export interface MonteCarloDeps {
  db: Db;
  pool?: MonteCarloPool;
}

export function registerMonteCarloRoutes(app: FastifyInstance, deps: MonteCarloDeps): void {
  const pool = deps.pool ?? new MonteCarloPool();
  const service = new MonteCarloService(deps.db, pool);
  const repo = new MonteCarloRunRepository(deps.db);

  app.post<{ Params: { planId: string }; Body: unknown }>(
    "/plans/:planId/monte-carlo",
    async (req, reply) => {
      const parsed = RunBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid body", details: parsed.error.flatten() });
      }
      const { engine, overrides } = parsed.data;

      const projection = projectSingleBlended(deps.db, req.params.planId, overrides as Overrides);
      if (!projection) {
        return reply.code(404).send({ error: `Plan not found: ${req.params.planId}` });
      }

      const wantsStream = (req.headers.accept ?? "").includes("text/event-stream");
      if (wantsStream) {
        return streamRun(reply, service, req.params.planId, engine, projection);
      }

      const outcome = await service.run(
        { planId: req.params.planId, engine, input: projection as unknown as MonteCarloJobInput, seed: projection.seed },
      );
      return reply.send({ ...outcome });
    },
  );

  app.get<{ Params: { planId: string; runId: string } }>(
    "/plans/:planId/monte-carlo/:runId",
    async (req, reply) => {
      const run = repo.getRun(req.params.planId, req.params.runId);
      if (!run) {
        return reply.code(404).send({ error: `Run not found: ${req.params.runId}` });
      }
      return reply.send(run);
    },
  );
}

/** Streams progress events followed by a final result event (SSE). */
async function streamRun(
  reply: FastifyReply,
  service: MonteCarloService,
  planId: string,
  engine: MonteCarloEngine,
  projection: PlanProjection,
): Promise<void> {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const outcome = await service.run(
      { planId, engine, input: projection as unknown as MonteCarloJobInput, seed: projection.seed },
      (completedTrials, totalTrials) =>
        send("progress", { completedTrials, totalTrials }),
    );
    send("result", outcome);
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
}

