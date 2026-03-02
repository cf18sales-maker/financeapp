import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// GET /api/stats/spending-by-category?dateFrom=&dateTo=
router.get("/spending-by-category", async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    res.json(await storage.getSpendingByCategory(dateFrom as string, dateTo as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/stats/monthly-spending?months=6
router.get("/monthly-spending", async (req, res) => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    res.json(await storage.getMonthlySpending(months));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
