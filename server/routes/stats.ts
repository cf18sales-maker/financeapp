import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { transactions } from "@shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

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

// GET /api/stats/surplus/:month
// Returns the safe-to-invest breakdown for a given month (YYYY-MM)
router.get("/surplus/:month", async (req, res) => {
  try {
    const { month } = req.params;
    const dateFrom = `${month}-01`;
    const dateTo = `${month}-31`;

    // Income this month (credits)
    const [incomeRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "credit"), gte(transactions.date, dateFrom), lte(transactions.date, dateTo)));

    // Fixed costs (debits tagged 'fixed')
    const [fixedRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)` })
      .from(transactions)
      .where(and(
        eq(transactions.type, "debit"),
        eq(transactions.fixedVariable, "fixed"),
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
      ));

    // Variable spend MTD (debits tagged 'variable' or 'discretionary')
    const [variableRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)` })
      .from(transactions)
      .where(and(
        eq(transactions.type, "debit"),
        sql`${transactions.fixedVariable} IN ('variable', 'discretionary')`,
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
      ));

    // Untagged spend (debits with no fixedVariable set)
    const [untaggedRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)` })
      .from(transactions)
      .where(and(
        eq(transactions.type, "debit"),
        sql`${transactions.fixedVariable} IS NULL`,
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
      ));

    // Count untagged transactions to show the user they have work to do
    const [untaggedCountRow] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.type, "debit"),
        sql`${transactions.fixedVariable} IS NULL`,
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
      ));

    const income = parseFloat(incomeRow.total);
    const fixed = parseFloat(fixedRow.total);
    const variable = parseFloat(variableRow.total);
    const untagged = parseFloat(untaggedRow.total);
    const untaggedCount = parseInt(untaggedCountRow.count);

    // Surplus = income - fixed - variable - untagged
    // Untagged is shown separately so the user knows precision is limited
    const surplus = income - fixed - variable - untagged;

    res.json({
      month,
      income,
      fixedCosts: fixed,
      variableSpend: variable,
      untaggedSpend: untagged,
      untaggedCount,
      surplus,
      isComplete: untaggedCount === 0, // true when all debits are tagged
      currency: "AUD",
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
