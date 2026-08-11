// Registers all API route modules + the shared error handler (docs/10 Phase 4).

import type { FastifyInstance } from "fastify";
import type { Db } from "../../db";
import { registerErrorHandler } from "../errors";
import { registerPlanRoutes } from "./plans";
import { registerAssumptionRoutes } from "./assumptions";
import { registerAccountRoutes } from "./accounts";
import { registerGoalRoutes } from "./goals";
import { registerLiabilityRoutes } from "./liabilities";
import { registerInsuranceRoutes } from "./insurance";
import { registerExpenseRoutes } from "./expenses";
import { registerJurisdictionRoutes } from "./jurisdictions";
import { registerPortfolioRiskRoutes } from "./portfolioRisk";
import { registerProjectionRoutes } from "./projection";
import { registerSequenceRiskRoutes } from "./sequenceRisk";
import { registerWithdrawalStrategyRoutes } from "./withdrawalStrategies";
import { registerSensitivityMatrixRoutes } from "./sensitivityMatrix";
import { registerScenarioAnalysisRoutes } from "./scenarioAnalysis";
import { registerActionItemRoutes } from "./actionItems";
import { registerTaxAnalysisRoutes } from "./taxAnalysis";
import { registerAiRoutes } from "./ai";
import { registerHoldingsRoutes } from "./holdings";
import { registerReconciliationRoutes } from "./reconciliation";
import { registerEmergencyFundRoutes } from "./emergencyFund";

export interface AiRoutesOptions {
  fetchFn?: typeof fetch;
  secretPath?: string;
}

export function registerApiRoutes(
  app: FastifyInstance,
  db: Db,
  aiOptions?: AiRoutesOptions,
): void {
  registerErrorHandler(app);
  registerPlanRoutes(app, db);
  registerAssumptionRoutes(app, db);
  registerAccountRoutes(app, db);
  registerGoalRoutes(app, db);
  registerLiabilityRoutes(app, db);
  registerInsuranceRoutes(app, db);
  registerExpenseRoutes(app, db);
  registerJurisdictionRoutes(app);
  registerPortfolioRiskRoutes(app, db);
  registerProjectionRoutes(app, db);
  registerSequenceRiskRoutes(app, db);
  registerWithdrawalStrategyRoutes(app, db);
  registerSensitivityMatrixRoutes(app, db);
  registerScenarioAnalysisRoutes(app, db);
  registerActionItemRoutes(app, db);
  registerTaxAnalysisRoutes(app, db);
  registerAiRoutes(app, db, aiOptions);
  registerHoldingsRoutes(app, db);
  registerReconciliationRoutes(app, db);
  registerEmergencyFundRoutes(app, db);
}
