// Shared helpers for nested-under-a-plan CRUD routes (docs/10 Phase 4).

import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { plans } from "../../db/schema";
import { notFound } from "../errors";

/** Throws a 404 HttpError when the plan does not exist (FK guard). */
export function guardPlan(db: Db, planId: string): void {
  const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
  if (!plan) throw notFound("Plan");
}
