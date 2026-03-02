import type { Express } from "express";
import { createServer, type Server } from "http";
import accountsRouter from "./accounts";
import categoriesRouter from "./categories";
import rulesRouter from "./rules";
import transactionsRouter from "./transactions";
import budgetsRouter from "./budgets";
import importRouter from "./import";
import statsRouter from "./stats";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use("/api/accounts", accountsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/rules", rulesRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/budgets", budgetsRouter);
  app.use("/api", importRouter);           // handles /api/import, /api/apply-rules, /api/import/batches
  app.use("/api/stats", statsRouter);
  app.use("/api/import-batches", (req, res, next) => {
    // Legacy route — redirect to new import/batches
    req.url = "/batches" + req.url;
    importRouter(req, res, next);
  });
  return httpServer;
}
