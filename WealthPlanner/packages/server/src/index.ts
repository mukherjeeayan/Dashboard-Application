import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import { openDb, type Db } from "./db";
import { registerMonteCarloRoutes } from "./monteCarlo/routes";
import { registerApiRoutes } from "./api/routes";
import { registerOpenApi } from "./api/openapi";

export interface ServerOptions {
  port: number;
  host?: string;
  serveClient?: boolean;
  dbPath?: string;
}

export interface StartResult {
  url: string;
  close: () => Promise<void>;
}

const CLIENT_DIST = resolve(__dirname, "../../client/dist");

/**
 * Builds the Fastify application (routes only). Does not start listening,
 * so it can be exercised in tests via app.inject().
 */
export async function buildServer(options: {
  serveClient?: boolean;
  db?: Db;
} = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  await registerOpenApi(app);

  if (options.db) {
    registerApiRoutes(app, options.db);
    registerMonteCarloRoutes(app, { db: options.db });
  }

  if (options.serveClient !== false) {
    await app.register(fastifyStatic, {
      root: CLIENT_DIST,
      wildcard: false,
    });
    // SPA fallback: anything unknown serves index.html
    app.setNotFoundHandler((_req, reply) => {
      reply.type("text/html").sendFile("index.html");
    });
  }

  return app;
}

/**
 * Starts the server listening on the given port and returns the base URL
 * plus a close function (used by the CLI and by integration tests).
 * The local SQLite database is opened (and migrated) at startup.
 */
export async function startServer(options: ServerOptions): Promise<StartResult> {
  const host = options.host ?? "127.0.0.1";
  const { db, close: closeDb } = openDb(options.dbPath);
  const app = await buildServer({ serveClient: options.serveClient, db });
  await app.listen({ port: options.port, host });
  return {
    url: `http://${host}:${options.port}`,
    close: async () => {
      await app.close();
      closeDb();
    },
  };
}

