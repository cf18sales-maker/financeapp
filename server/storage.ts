import { db } from "./db";
import { accounts, categories, categoryRules, importBatches, transactions } from "@shared/schema";
import type {
  Account, InsertAccount,
  Category, InsertCategory,
  CategoryRule, InsertCategoryRule,
  ImportBatch, InsertImportBatch,
  Transaction, InsertTransaction,
  User, InsertUser,
} from "@shared/schema";
import { eq, desc, and, or, like, gte, lte, gt, lt, ilike, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

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

  // User (legacy)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  private users: Map<string, User> = new Map();

  async getAccounts(): Promise<Account[]> {
    return db.select().from(accounts).orderBy(accounts.name);
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, id));
    return acc;
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [acc] = await db.insert(accounts).values(account).returning();
    return acc;
  }

  async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const [acc] = await db.update(accounts).set(account).where(eq(accounts.id, id)).returning();
    return acc;
  }

  async deleteAccount(id: string): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(category).returning();
    return cat;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [cat] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return cat;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getRules(): Promise<CategoryRule[]> {
    return db.select().from(categoryRules).orderBy(desc(categoryRules.priority), categoryRules.name);
  }

  async getRule(id: string): Promise<CategoryRule | undefined> {
    const [rule] = await db.select().from(categoryRules).where(eq(categoryRules.id, id));
    return rule;
  }

  async createRule(rule: InsertCategoryRule): Promise<CategoryRule> {
    const [r] = await db.insert(categoryRules).values(rule).returning();
    return r;
  }

  async updateRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRule | undefined> {
    const [r] = await db.update(categoryRules).set(rule).where(eq(categoryRules.id, id)).returning();
    return r;
  }

  async deleteRule(id: string): Promise<void> {
    await db.delete(categoryRules).where(eq(categoryRules.id, id));
  }

  async getImportBatches(): Promise<ImportBatch[]> {
    return db.select().from(importBatches).orderBy(desc(importBatches.importedAt));
  }

  async getImportBatchesByAccount(accountId: string): Promise<ImportBatch[]> {
    return db.select().from(importBatches).where(eq(importBatches.accountId, accountId)).orderBy(desc(importBatches.importedAt));
  }

  async createImportBatch(batch: InsertImportBatch): Promise<ImportBatch> {
    const [b] = await db.insert(importBatches).values(batch).returning();
    return b;
  }

  async deleteImportBatch(id: string): Promise<void> {
    await db.delete(importBatches).where(eq(importBatches.id, id));
  }

  async getTransactions(filters?: {
    accountId?: string;
    categoryId?: string;
    uncategorized?: boolean;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    importBatchId?: string;
  }): Promise<Transaction[]> {
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

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(transaction).returning();
    return tx;
  }

  async createTransactions(txList: InsertTransaction[]): Promise<Transaction[]> {
    if (txList.length === 0) return [];
    return db.insert(transactions).values(txList).returning();
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [tx] = await db.update(transactions).set(transaction).where(eq(transactions.id, id)).returning();
    return tx;
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async deleteTransactionsByBatch(importBatchId: string): Promise<void> {
    await db.delete(transactions).where(eq(transactions.importBatchId, importBatchId));
  }

  async getSpendingByCategory(dateFrom?: string, dateTo?: string): Promise<{ categoryId: string | null; total: string }[]> {
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

  async getMonthlySpending(months: number = 6): Promise<{ month: string; total: string }[]> {
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

  // Legacy user methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const u: User = { ...user, id };
    this.users.set(id, u);
    return u;
  }
}

export const storage = new DatabaseStorage();
