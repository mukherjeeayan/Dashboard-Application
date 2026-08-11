// Consistent error handling for the API (docs/10 §10.4, Phase 4). Every error
// — validation, not-found, foreign-key, or unexpected — is serialized to the
// same shape so clients can rely on a single contract.

import type { FastifyInstance } from "fastify";
import type { ZodType, ZodError } from "zod";

export interface ErrorBody {
  error: string;
  statusCode: number;
  code?: string;
  details?: unknown;
}

/** Error carrying an HTTP status and a short machine-readable code. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code = String(statusCode),
  ) {
    super(message);
  }
}

export const notFound = (resource: string) =>
  new HttpError(404, `${resource} not found`, "NOT_FOUND");

/**
 * Validates a value against a Zod schema. On failure throws a 400 HttpError
 * carrying the flattened issues (consistent shape). Returns the parsed value.
 */
export function validateOrThrow<T>(schema: ZodType<T>, value: unknown, _label = "body"): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationError(result.error);
  }
  return result.data;
}

export function validationError(error: ZodError, code = "VALIDATION"): HttpError {
  const err = new HttpError(400, "Validation failed", code) as HttpError & { details?: unknown };
  err.details = error.flatten();
  return err;
}

/** Installs the app-wide error handler that normalises errors to ErrorBody. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      const body: ErrorBody = {
        error: err.message,
        statusCode: err.statusCode,
        code: err.code,
        details: (err as { details?: unknown }).details,
      };
      return reply.code(err.statusCode).send(body);
    }

    // Zod errors thrown outside validateOrThrow.
    const zod = (err as { name?: string }).name;
    if (zod === "ZodError") {
      const body: ErrorBody = {
        error: "Validation failed",
        statusCode: 400,
        code: "VALIDATION",
        details: err,
      };
      return reply.code(400).send(body);
    }

    if (err.message?.includes("FOREIGN KEY constraint failed")) {
      const body: ErrorBody = {
        error: "Referenced record does not exist",
        statusCode: 400,
        code: "FOREIGN_KEY",
      };
      return reply.code(400).send(body);
    }

    app.log.error(err);
    const body: ErrorBody = {
      error: err.message ?? "Internal Server Error",
      statusCode: 500,
      code: "INTERNAL",
    };
    return reply.code(500).send(body);
  });
}
