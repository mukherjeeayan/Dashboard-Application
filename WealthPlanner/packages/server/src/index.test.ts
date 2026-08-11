import { describe, expect, it } from "vitest";
import { buildServer } from "./index";

describe("server", () => {
  it("serves /health with status ok", async () => {
    const app = await buildServer({ serveClient: false });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("exposes the OpenAPI JSON spec and UI", async () => {
    const app = await buildServer({ serveClient: false });
    const spec = await app.inject({ method: "GET", url: "/documentation/json" });
    expect(spec.statusCode).toBe(200);
    expect(spec.json().openapi).toBe("3.0.3");
    expect(spec.json().info.title).toBe("WealthPath API");

    const ui = await app.inject({ method: "GET", url: "/documentation" });
    expect(ui.statusCode).toBe(200);
    expect(ui.headers["content-type"]).toContain("text/html");
    await app.close();
  });
});
