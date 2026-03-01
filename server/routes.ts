import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertCategorySchema, insertCategoryRuleSchema, insertTransactionSchema, insertImportBatchSchema } from "@shared/schema";
import { z } from "zod";

function applyRules(description: string, amount: string, type: string, rules: any[]): string | null {
  const sorted = [...rules].filter(r => r.isActive).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const rule of sorted) {
    let fieldValue = "";
    if (rule.field === "description") fieldValue = description.toLowerCase();
    else if (rule.field === "amount") fieldValue = amount;
    else if (rule.field === "type") fieldValue = type;

    let matches = false;
    const ruleValue = rule.value.toLowerCase();

    if (rule.field === "amount") {
      const numVal = parseFloat(amount);
      const numRule = parseFloat(rule.value);
      if (rule.operator === "gt") matches = numVal > numRule;
      else if (rule.operator === "lt") matches = numVal < numRule;
      else if (rule.operator === "gte") matches = numVal >= numRule;
      else if (rule.operator === "lte") matches = numVal <= numRule;
      else if (rule.operator === "equals") matches = numVal === numRule;
    } else {
      if (rule.operator === "contains") matches = fieldValue.includes(ruleValue);
      else if (rule.operator === "starts_with") matches = fieldValue.startsWith(ruleValue);
      else if (rule.operator === "ends_with") matches = fieldValue.endsWith(ruleValue);
      else if (rule.operator === "equals") matches = fieldValue === ruleValue;
      else if (rule.operator === "regex") {
        try { matches = new RegExp(rule.value, "i").test(fieldValue); } catch {}
      }
    }

    if (matches) return rule.categoryId;
  }
  return null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Accounts
  app.get("/api/accounts", async (req, res) => {
    try {
      const accs = await storage.getAccounts();
      res.json(accs);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const data = insertAccountSchema.parse(req.body);
      const acc = await storage.createAccount(data);
      res.json(acc);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/accounts/:id", async (req, res) => {
    try {
      const data = insertAccountSchema.partial().parse(req.body);
      const acc = await storage.updateAccount(req.params.id, data);
      if (!acc) return res.status(404).json({ error: "Not found" });
      res.json(acc);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      await storage.deleteAccount(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const cats = await storage.getCategories();
      res.json(cats);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const cat = await storage.createCategory(data);
      res.json(cat);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const data = insertCategorySchema.partial().parse(req.body);
      const cat = await storage.updateCategory(req.params.id, data);
      if (!cat) return res.status(404).json({ error: "Not found" });
      res.json(cat);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Rules
  app.get("/api/rules", async (req, res) => {
    try {
      const rules = await storage.getRules();
      res.json(rules);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/rules", async (req, res) => {
    try {
      const data = insertCategoryRuleSchema.parse(req.body);
      const rule = await storage.createRule(data);
      res.json(rule);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/rules/:id", async (req, res) => {
    try {
      const data = insertCategoryRuleSchema.partial().parse(req.body);
      const rule = await storage.updateRule(req.params.id, data);
      if (!rule) return res.status(404).json({ error: "Not found" });
      res.json(rule);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/rules/:id", async (req, res) => {
    try {
      await storage.deleteRule(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Import batches
  app.get("/api/import-batches", async (req, res) => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const batches = accountId
        ? await storage.getImportBatchesByAccount(accountId)
        : await storage.getImportBatches();
      res.json(batches);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/import-batches/:id", async (req, res) => {
    try {
      await storage.deleteTransactionsByBatch(req.params.id);
      await storage.deleteImportBatch(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Transactions
  app.get("/api/transactions", async (req, res) => {
    try {
      const { accountId, categoryId, uncategorized, search, dateFrom, dateTo, importBatchId } = req.query;
      const txs = await storage.getTransactions({
        accountId: accountId as string,
        categoryId: categoryId as string,
        uncategorized: uncategorized === "true",
        search: search as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        importBatchId: importBatchId as string,
      });
      res.json(txs);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/transactions/:id", async (req, res) => {
    try {
      const data = insertTransactionSchema.partial().parse(req.body);
      const tx = await storage.updateTransaction(req.params.id, data);
      if (!tx) return res.status(404).json({ error: "Not found" });
      res.json(tx);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      await storage.deleteTransaction(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Import endpoint — parse CSV rows and auto-categorize
  app.post("/api/import", async (req, res) => {
    try {
      const { accountId, fileName, rows } = req.body as {
        accountId: string;
        fileName: string;
        rows: { date: string; description: string; amount: string; type: "debit" | "credit" }[];
      };

      if (!accountId || !fileName || !Array.isArray(rows)) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const rules = await storage.getRules();

      const batch = await storage.createImportBatch({ accountId, fileName, rowCount: rows.length });

      const txList = rows.map(row => {
        const categoryId = applyRules(row.description, row.amount, row.type, rules);
        return {
          accountId,
          importBatchId: batch.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          type: row.type,
          categoryId: categoryId ?? undefined,
          isManualCategory: false,
        };
      });

      const created = await storage.createTransactions(txList);
      res.json({ batch, transactions: created });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Re-apply rules to existing transactions
  app.post("/api/apply-rules", async (req, res) => {
    try {
      const rules = await storage.getRules();
      const allTxs = await storage.getTransactions();
      let updated = 0;
      for (const tx of allTxs) {
        if (!tx.isManualCategory) {
          const categoryId = applyRules(tx.description, tx.amount, tx.type, rules);
          if (categoryId !== tx.categoryId) {
            await storage.updateTransaction(tx.id, { categoryId: categoryId ?? undefined });
            updated++;
          }
        }
      }
      res.json({ updated });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Stats
  app.get("/api/stats/spending-by-category", async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const data = await storage.getSpendingByCategory(dateFrom as string, dateTo as string);
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/stats/monthly-spending", async (req, res) => {
    try {
      const months = parseInt(req.query.months as string) || 6;
      const data = await storage.getMonthlySpending(months);
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
