// OpenAPI specification (docs/10 Phase 4). Registers @fastify/swagger in dynamic
// mode so the JSON spec at /documentation/json is generated from the routes,
// and @fastify/swagger-ui so /documentation renders an interactive reference.
//
// Routes that attach a `schema` contribute full request/response documentation;
// others are still listed (path + method) in the generated spec.

import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "WealthPath API",
        description: "Local-first personal wealth planning API.",
        version: "0.1.0",
      },
      tags: [
        { name: "plans", description: "Plans, assumptions, and plan resources" },
        { name: "monte-carlo", description: "Monte Carlo simulation runs" },
        { name: "jurisdictions", description: "Jurisdiction Packs" },
        {
          name: "holdings",
          description: "Direct holdings (lots, disposals, prices, yield) for MARKET_LINKED_DIRECT / DIGITAL_ASSET accounts",
        },
        {
          name: "reconciliation",
          description: "Period-end balance reconciliation for a plan's accounts",
        },
        {
          name: "emergency-fund",
          description: "Emergency-fund coverage assessment against the plan's liquid cash",
        },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/documentation",
    uiConfig: { docExpansion: "none", deepLinking: false },
  });
}
