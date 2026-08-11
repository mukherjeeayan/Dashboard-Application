// Jurisdiction Pack endpoints (docs/10 Phase 4, §9.3 step 1–2). Lists the
// shipped packs and returns a single pack for the client's jurisdiction
// selection screen.

import type { FastifyInstance } from "fastify";
import { listPackIds, loadPack } from "@wealthpath/jurisdictions";

export function registerJurisdictionRoutes(app: FastifyInstance): void {
  app.get("/jurisdiction-packs", async () => {
    return listPackIds().map((id) => {
      const pack = loadPack(id);
      return {
        packId: pack.packId,
        displayName: pack.displayName,
        currency: pack.currency,
        locale: pack.locale,
      };
    });
  });

  app.get<{ Params: { packId: string } }>("/jurisdiction-packs/:packId", async (req, reply) => {
    try {
      const pack = loadPack(req.params.packId);
      return reply.send(pack);
    } catch (err) {
      return reply.code(404).send({
        error: `Jurisdiction Pack not found: ${req.params.packId}`,
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }
  });
}
