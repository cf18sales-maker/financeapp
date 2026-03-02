import { db } from "./db";
import {
  accounts, categories, categoryRules, budgets, importBatches, transactions,
} from "@shared/schema";
import type {
  Account, InsertAccount,
  Category, InsertCategory,
  CategoryRule, InsertCategoryRule,
  Budget, InsertBudget,
  ImportBatch, InsertImportBatch,
  Transaction, InsertTransaction,
  User, InsertUser,
} from "@shared/schema";
import { eq, desc, and, ilike, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Budget Summary Type ──────────────────────────────────────────────────────

export type BudgetSummaryItem = {
  budgetId: string | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limitAmount: string | null;
  spentAmount: string;
  currency: string;
  month: string;
  percentUsed: number | null;
  remaining: number | null;
  isOverBudget: boolean;
};

// ─── Storage Interface ────────────────────────────────────────────────────────

export interface IStorage {
  // Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<void>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;

  // Rules
  getRules(): Promise<CategoryRule[]>;
  getRule(id: string): Promise<CategoryRule | undefined>;
  createRule(rule: InsertCategoryRule): Promise<CategoryRule>;
  updateRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRule | undefined>;
  deleteRule(id: string): Promise<void>;

  // Budgets
  getBudgets(month?: string): Promise<Budget[]>;
  getBudget(id: string): Promise<Budget | undefined>;
  upsertBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: string, budget: Partial<InsertBudget>): Promise<Budget | undefined>;
  deleteBudget(id: string): Promise<void>;
  getBudgetSummary(month: string): Promise<BudgetSummaryItem[]>;

  // Import Batches
  getImportBatches(): Promise<ImportBatch[]>;
  getImportBatchesByAccount(accountId: string): Promise<ImportBatch[]>;
  createImportBatch(batch: InsertImportBatch): Promise<ImportBatch>;
  deleteImportBatch(id: string): Promise<void>;

  // Transactions
  getTransactions(filters?: {
    accountId?: string;
    categoryId?: string;
    uncategorized?: boolean;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    importBatchId?: string;
  }): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  createTransactions(txList: InsertTransaction[]): Promise<Transaction[]>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<void>;
  deleteTransactionsByBatch(importBatchId: string): Promise<void>;

  // Stats
  getSpendingByCategory(dateFrom?: string, dateTo?: string): Promise<{ categoryId: string | null; total: string }[]>;
  getMonthlySpending(months?: number): Promise<{ month: string; total: string }[]>;

  // Legacy user (placeholder for Phase 3 auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

// ─── Database Storage Implementation ─────────────────────────────────────────

export class DatabaseStorage implements IStorage {
  private users: Map<string, User> = new Map();

  // ── Accounts ────────────────────────────────────────────────────────────────

  async getAccounts() {
    return db.select().from(accounts).orderBy(accounts.name);
  }

  async getAccount(id: string) {
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, id));
    return acc;
  }

  async createAccount(account: InsertAccount) {
    const [acc] = await db.insert(accounts).values(account).returning();
    return acc;
  }

  async updateAccount(id: string, account: Partial<InsertAccount>) {
    const [acc] = await db.update(accounts).set(account).where(eq(accounts.id, id)).returning();
    return acc;
  }

  async deleteAccount(id: string) {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async getCategories() {
    return db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: string) {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat;
  }

  async createCategory(category: InsertCategory) {
    const [cat] = await db.insert(categories).values(category).returning();
    return cat;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>) {
    const [cat] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return cat;
  }

  async deleteCategory(id: string) {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // ── Rules ────────────────────────────────────────────────────────────────────

  async getRules() {
    return db.select().from(categoryRules).orderBy(desc(categoryRules.priority), categoryRules.name);
  }

  async getRule(id: string) {
    const [rule] = await db.select().from(categoryRules).where(eq(categoryRules.id, id));
    return rule;
  }

  async createRule(rule: InsertCategoryRule) {
    const [r] = await db.insert(categoryRules).values(rule).returning();
    return r;
  }

  async updateRule(id: string, rule: Partial<InsertCategoryRule>) {
    const [r] = await db.update(categoryRules).set(rule).where(eq(categoryRules.id, id)).returning();
    return r;
  }

  async deleteRule(id: string) {
    await db.delete(categoryRules).where(eq(categoryRules.id, id));
  }

  // ── Budgets ──────────────────────────────────────────────────────────────────

  async getBudgets(month?: string) {
    if (month) {
      return db.select().from(budgets).where(eq(budgets.month, month)).orderBy(budgets.categoryId);
    }
    return db.select().from(budgets).orderBy(desc(budgets.month), budgets.categoryId);
  }

  async getBudget(id: string) {
    const [b] = await db.select().from(budgets).where(eq(budgets.id, id));
    return b;
  }

  async upsertBudget(budget: InsertBudget) {
    const [b] = await db
      .insert(budgets)
      .values(budget)
      .onConflictDoUpdate({
        target: [budgets.categoryId, budgets.month],
        set: { limitAmount: budget.limitAmount, currency: budget.currency },
      })
      .returning();
    return b;
  }

  async updateBudget(id: string, budget: Partial<InsertBudget>) {
    const [b] = await db.update(budgets).set(budget).where(eq(budgets.id, id)).returning();
    return b;
  }

  async deleteBudget(id: string) {
    await db.delete(budgets).where(eq(budgets.id, id));
  }

  /**
   * Returns each category that has either a budget or spend in the given month,
   * with MTD actual spend, limit, and remaining calculations.
   */
  async getBudgetSummary(month: string): Promise<BudgetSummaryItem[]> {
    // MTD date range for the month
    const dateFrom = `${month}-01`;
    const dateTo = `${month}-31`;

    // Get all categories
    const cats = await db.select().from(categories).orderBy(categories.name);

    // Get budgets for this month
    const monthBudgets = await db.select().from(budgets).where(eq(budgets.month, month));

    // Get MTD spending per category (debits only)
    const spendingRows = await db
      .select({
        categoryId: transactions.categoryId,
        total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "debit"),
          gte(transactions.date, dateFrom),
          lte(transactions.date, dateTo),
        )
      )
      .groupBy(transactions.categoryId);

    const spendMap: Record<string, number> = {};
    for (const row of spendingRows) {
      const key = row.categoryId ?? "__none__";
      spendMap[key] = parseFloat(row.total);
    }

    const budgetMap: Record<string, Budget> = {};
    for (const b of monthBudgets) {
      budgetMap[b.categoryId] = b;
    }

    // Build summary — include all categories that have a budget OR have spend
    const result: BudgetSummaryItem[] = [];

    for (const cat of cats) {
      const budget = budgetMap[cat.id];
      const spent = spendMap[cat.id] ?? 0;
      const limit = budget ? parseFloat(budget.limitAmount) : null;

      // Only include if there's a budget set or actual spend
      if (!budget && spent === 0) continue;

      const remaining = limit !== null ? limit - spent : null;
      const percentUsed = limit !== null && limit > 0 ? Math.round((spent / limit) * 100) : null;

      result.push({
        budgetId: budget?.id ?? null,
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        limitAmount: budget?.limitAmount ?? null,
        spentAmount: spent.toFixed(2),
        currency: budget?.currency ?? "AUD",
        month,
        percentUsed,
        remaining,
        isOverBudget: remaining !== null && remaining < 0,
      });
    }

    // Sort: over-budget first, then by percent used desc
    return result.sort((a, b) => {
      if (a.isOverBudget !== b.isOverBudget) return a.isOverBudget ? -1 : 1;
      return (b.percentUsed ?? 0) - (a.percentUsed ?? 0);
    });
  }

  // ── Import Batches ───────────────────────────────────────────────────────────

  async getImportBatches() {
    return db.select().from(importBatches).orderBy(desc(importBatches.importedAt));
  }

  async getImportBatchesByAccount(accountId: string) {
    return db.select().from(importBatches)
      .where(eq(importBatches.accountId, accountId))
      .orderBy(desc(importBatches.importedAt));
  }

  async createImportBatch(batch: InsertImportBatch) {
    const [b] = await db.insert(importBatches).values(batch).returning();
    return b;
  }

  async deleteImportBatch(id: string) {
    await db.delete(importBatches).where(eq(importBatches.id, id));
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async getTransactions(filters?: {
    accountId?: string;
    categoryId?: string;
    uncategorized?: boolean;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    importBatchId?: string;
  }) {
    let query = db.select().from(transactions).$dynamic();
    const conditions = [];

    if (filters?.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
    if (filters?.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
    if (filters?.uncategorized) conditions.push(sql`${transactions.categoryId} IS NULL`);
    if (filters?.search) conditions.push(ilike(transactions.description, `%${filters.search}%`));
    if (filters?.dateFrom) conditions.push(gte(transactions.date, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(transactions.date, filters.dateTo));
    if (filters?.importBatchId) conditions.push(eq(transactions.importBatchId, filters.importBatchId));

    if (conditions.length > 0) query = query.where(and(...conditions));
    return query.orderBy(desc(transactions.date), desc(transactions.createdAt));
  }

  async getTransaction(id: string) {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async createTransaction(transaction: InsertTransaction) {
    const [tx] = await db.insert(transactions).values(transaction).returning();
    return tx;
  }

  async createTransactions(txList: InsertTransaction[]) {
    if (txList.length === 0) return [];
    return db.insert(transactions).values(txList).returning();
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>) {
    const [tx] = await db.update(transactions).set(transaction).where(eq(transactions.id, id)).returning();
    return tx;
  }

  async deleteTransaction(id: string) {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async deleteTransactionsByBatch(importBatchId: string) {
    await db.delete(transactions).where(eq(transactions.importBatchId, importBatchId));
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  async getSpendingByCategory(dateFrom?: string, dateTo?: string) {
    const conditions = [eq(transactions.type, "debit")];
    if (dateFrom) conditions.push(gte(transactions.date, dateFrom));
    if (dateTo) conditions.push(lte(transactions.date, dateTo));

    return db
      .select({
        categoryId: transactions.categoryId,
        total: sql<string>`SUM(${transactions.amount}::numeric)`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(transactions.categoryId);
  }

  async getMonthlySpending(months: number = 6) {
    return db
      .select({
        month: sql<string>`TO_CHAR(DATE(${transactions.date}), 'YYYY-MM')`,
        total: sql<string>`SUM(${transactions.amount}::numeric)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "debit"),
          sql`DATE(${transactions.date}) >= NOW() - INTERVAL '${sql.raw(String(months))} months'`
        )
      )
      .groupBy(sql`TO_CHAR(DATE(${transactions.date}), 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(DATE(${transactions.date}), 'YYYY-MM')`);
  }

  // ── Legacy User (Phase 3 placeholder) ───────────────────────────────────────

  async getUser(id: string) { return this.users.get(id); }

  async getUserByUsername(username: string) {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(user: InsertUser) {
    const id = randomUUID();
    const u: User = { ...user, id };
    this.users.set(id, u);
    return u;
  }
}

export const storage = new DatabaseStorage();
