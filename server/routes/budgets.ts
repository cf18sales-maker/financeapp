import { Router } from "express";
import { storage } from "../storage";
import { insertBudgetSchema } from "@shared/schema";

const router = Router();

// GET /api/budgets?month=YYYY-MM
router.get("/", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;
    res.json(await storage.getBudgets(month));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/budgets/summary/:month — budgets with MTD actuals
router.get("/summary/:month", async (req, res) => {
  try {
    const { month } = req.params;
    const summary = await storage.getBudgetSummary(month);
    res.json(summary);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const data = insertBudgetSchema.parse(req.body);
    const budget = await storage.upsertBudget(data);
    res.json(budget);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const data = insertBudgetSchema.partial().parse(req.body);
    const budget = await storage.updateBudget(req.params.id, data);
    if (!budget) return res.status(404).json({ error: "Not found" });
    res.json(budget);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteBudget(req.params.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
