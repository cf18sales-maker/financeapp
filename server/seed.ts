import { db } from "./db";
import { accounts, categories, categoryRules, importBatches, transactions } from "@shared/schema";
import { sql } from "drizzle-orm";
function log(msg: string) { console.log(`[seed] ${msg}`); }

export async function seed() {
  try {
    const [{ count: acctCount }] = await db.select({ count: sql<number>`count(*)` }).from(accounts);
    if (Number(acctCount) > 0) return;

    log("Seeding database with sample data...", "seed");

    const [chase] = await db.insert(accounts).values({
      name: "Chase Freedom",
      institution: "Chase Bank",
      type: "credit_card",
      color: "#0ea5e9",
      currency: "AUD",
      description: "Primary credit card for daily purchases",
    }).returning();

    const [bofa] = await db.insert(accounts).values({
      name: "BofA Checking",
      institution: "Bank of America",
      type: "checking",
      color: "#ef4444",
      currency: "AUD",
      description: "Main checking account",
    }).returning();

    const [amex] = await db.insert(accounts).values({
      name: "Amex Platinum",
      institution: "American Express",
      type: "credit_card",
      color: "#6366f1",
      currency: "AUD",
      description: "Travel rewards card",
    }).returning();

    const cats = await db.insert(categories).values([
      { name: "Groceries", color: "#10b981", icon: "shopping-cart" },
      { name: "Dining Out", color: "#f59e0b", icon: "utensils" },
      { name: "Transportation", color: "#0ea5e9", icon: "car" },
      { name: "Entertainment", color: "#8b5cf6", icon: "film" },
      { name: "Utilities", color: "#6366f1", icon: "zap" },
      { name: "Healthcare", color: "#ef4444", icon: "heart" },
      { name: "Travel", color: "#14b8a6", icon: "plane" },
      { name: "Shopping", color: "#ec4899", icon: "gift" },
      { name: "Income", color: "#22c55e", icon: "trending-up" },
      { name: "Subscriptions", color: "#a855f7", icon: "repeat" },
    ]).returning();

    const catMap: Record<string, string> = Object.fromEntries(cats.map(c => [c.name, c.id]));

    await db.insert(categoryRules).values([
      { name: "Whole Foods → Groceries", field: "description", operator: "contains", value: "WHOLE FOODS", categoryId: catMap["Groceries"], priority: 10, isActive: true },
      { name: "Trader Joe's → Groceries", field: "description", operator: "contains", value: "TRADER JOE", categoryId: catMap["Groceries"], priority: 10, isActive: true },
      { name: "Kroger → Groceries", field: "description", operator: "contains", value: "KROGER", categoryId: catMap["Groceries"], priority: 10, isActive: true },
      { name: "Uber Eats → Dining", field: "description", operator: "contains", value: "UBER EATS", categoryId: catMap["Dining Out"], priority: 10, isActive: true },
      { name: "DoorDash → Dining", field: "description", operator: "contains", value: "DOORDASH", categoryId: catMap["Dining Out"], priority: 10, isActive: true },
      { name: "Starbucks → Dining", field: "description", operator: "contains", value: "STARBUCKS", categoryId: catMap["Dining Out"], priority: 9, isActive: true },
      { name: "McDonald's → Dining", field: "description", operator: "contains", value: "MCDONALD", categoryId: catMap["Dining Out"], priority: 9, isActive: true },
      { name: "Uber → Transportation", field: "description", operator: "contains", value: "UBER", categoryId: catMap["Transportation"], priority: 5, isActive: true },
      { name: "Lyft → Transportation", field: "description", operator: "contains", value: "LYFT", categoryId: catMap["Transportation"], priority: 9, isActive: true },
      { name: "Netflix → Subscriptions", field: "description", operator: "contains", value: "NETFLIX", categoryId: catMap["Subscriptions"], priority: 10, isActive: true },
      { name: "Spotify → Subscriptions", field: "description", operator: "contains", value: "SPOTIFY", categoryId: catMap["Subscriptions"], priority: 10, isActive: true },
      { name: "Amazon Prime → Subscriptions", field: "description", operator: "contains", value: "AMAZON PRIME", categoryId: catMap["Subscriptions"], priority: 10, isActive: true },
      { name: "Amazon → Shopping", field: "description", operator: "contains", value: "AMAZON", categoryId: catMap["Shopping"], priority: 4, isActive: true },
      { name: "Direct Deposit → Income", field: "description", operator: "contains", value: "DIRECT DEPOSIT", categoryId: catMap["Income"], priority: 10, isActive: true },
      { name: "Payroll → Income", field: "description", operator: "contains", value: "PAYROLL", categoryId: catMap["Income"], priority: 10, isActive: true },
    ]);

    const [batch1] = await db.insert(importBatches).values({
      accountId: chase.id,
      fileName: "chase_jan_2026.csv",
      rowCount: 15,
    }).returning();

    const [batch2] = await db.insert(importBatches).values({
      accountId: bofa.id,
      fileName: "bofa_jan_2026.csv",
      rowCount: 8,
    }).returning();

    await db.insert(transactions).values([
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-28", description: "WHOLE FOODS MARKET #12", amount: "87.43", type: "debit", categoryId: catMap["Groceries"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-27", description: "STARBUCKS #03421", amount: "6.75", type: "debit", categoryId: catMap["Dining Out"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-26", description: "UBER EATS ORDER", amount: "34.20", type: "debit", categoryId: catMap["Dining Out"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-25", description: "AMAZON.COM AMZN", amount: "52.99", type: "debit", categoryId: catMap["Shopping"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-24", description: "NETFLIX.COM", amount: "15.99", type: "debit", categoryId: catMap["Subscriptions"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-23", description: "LYFT RIDE", amount: "18.50", type: "debit", categoryId: catMap["Transportation"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-22", description: "TRADER JOE'S #89", amount: "63.11", type: "debit", categoryId: catMap["Groceries"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-21", description: "SPOTIFY USA", amount: "9.99", type: "debit", categoryId: catMap["Subscriptions"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-20", description: "MCDONALD'S F31204", amount: "12.47", type: "debit", categoryId: catMap["Dining Out"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-19", description: "CVS PHARMACY #2341", amount: "28.90", type: "debit", categoryId: catMap["Healthcare"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-18", description: "DOORDASH ORDER #X7", amount: "41.00", type: "debit", categoryId: catMap["Dining Out"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-17", description: "THE HOME DEPOT", amount: "124.30", type: "debit" },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-15", description: "AMAZON PRIME MEMBERSHIP", amount: "14.99", type: "debit", categoryId: catMap["Subscriptions"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-14", description: "DELTA AIR LINES TICKET", amount: "340.00", type: "debit", categoryId: catMap["Travel"] },
      { accountId: chase.id, importBatchId: batch1.id, date: "2026-01-10", description: "LOCAL RESTAURANT #5", amount: "65.20", type: "debit" },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-28", description: "DIRECT DEPOSIT ACME CORP PAYROLL", amount: "3200.00", type: "credit", categoryId: catMap["Income"] },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-25", description: "COMCAST CABLE INTERNET", amount: "89.99", type: "debit", categoryId: catMap["Utilities"] },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-20", description: "ELECTRIC COMPANY PAYMENT", amount: "112.40", type: "debit", categoryId: catMap["Utilities"] },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-18", description: "WALGREENS PHARMACY", amount: "42.15", type: "debit", categoryId: catMap["Healthcare"] },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-15", description: "KROGER #0123", amount: "95.67", type: "debit", categoryId: catMap["Groceries"] },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-10", description: "PARKING GARAGE DOWNTOWN", amount: "22.00", type: "debit" },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-08", description: "ATM WITHDRAWAL", amount: "200.00", type: "debit" },
      { accountId: bofa.id, importBatchId: batch2.id, date: "2026-01-05", description: "FREELANCE PAYMENT TRANSFER", amount: "850.00", type: "credit", categoryId: catMap["Income"] },
    ]);

    log("Seed complete!", "seed");
  } catch (err) {
    console.error("Seed error:", err);
  }
}
