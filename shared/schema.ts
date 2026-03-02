import { pgTable, text, varchar, numeric, boolean, integer, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const accountTypeEnum = pgEnum("account_type", [
  "checking", "savings", "credit_card", "investment", "super", "mortgage", "loan", "other",
]);

export const transactionTypeEnum = pgEnum("transaction_type", ["debit", "credit"]);

export const ruleFieldEnum = pgEnum("rule_field", ["description", "amount", "type"]);

export const ruleOperatorEnum = pgEnum("rule_operator", [
  "contains", "starts_with", "ends_with", "equals", "regex", "gt", "lt", "gte", "lte",
]);

export const fixedVariableEnum = pgEnum("fixed_variable", [
  "fixed", "variable", "discretionary",
]);

// ─── Accounts ────────────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  institution: text("institution").notNull(),
  type: accountTypeEnum("type").notNull().default("checking"),
  color: text("color").notNull().default("#6366f1"),
  currency: text("currency").notNull().default("AUD"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon").notNull().default("tag"),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Categorisation Rules ─────────────────────────────────────────────────────

export const categoryRules = pgTable("category_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  categoryId: varchar("category_id").notNull(),
  field: ruleFieldEnum("field").notNull().default("description"),
  operator: ruleOperatorEnum("operator").notNull().default("contains"),
  value: text("value").notNull(),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Budgets ─────────────────────────────────────────────────────────────────
// One budget entry per category per month (YYYY-MM).
// Enables MTD spend vs limit tracking and surplus projection.

export const budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull(),
  month: text("month").notNull(),           // "YYYY-MM"
  limitAmount: numeric("limit_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AUD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("budgets_category_month_unique").on(t.categoryId, t.month),
]);

// ─── Import Batches ───────────────────────────────────────────────────────────

export const importBatches = pgTable("import_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  fileName: text("file_name").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});

// ─── Transactions ─────────────────────────────────────────────────────────────
// Core fact table. Multi-currency aware, fixed/variable tagged.

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  importBatchId: varchar("import_batch_id"),

  date: text("date").notNull(),
  description: text("description").notNull(),

  // Primary stored amount (in account's currency)
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull().default("debit"),
  currency: text("currency").notNull().default("AUD"),

  // Original source amount — for multi-currency imports (USD transactions in AUD account, etc.)
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }),
  originalCurrency: text("original_currency"),

  // Categorisation
  categoryId: varchar("category_id"),
  isManualCategory: boolean("is_manual_category").notNull().default(false),

  // Expense classification — enables fixed vs variable budgeting
  fixedVariable: fixedVariableEnum("fixed_variable"),

  // Recurring detection — populated by recurring detection logic (Phase 1+)
  isRecurring: boolean("is_recurring").notNull().default(false),

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Insert Schemas (Zod) ─────────────────────────────────────────────────────

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertCategoryRuleSchema = createInsertSchema(categoryRules).omit({ id: true, createdAt: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true, createdAt: true });
export const insertImportBatchSchema = createInsertSchema(importBatches).omit({ id: true, importedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertCategoryRule = z.infer<typeof insertCategoryRuleSchema>;
export type CategoryRule = typeof categoryRules.$inferSelect;

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

export type InsertImportBatch = z.infer<typeof insertImportBatchSchema>;
export type ImportBatch = typeof importBatches.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Legacy user types (placeholder until auth is added in Phase 3)
export type User = { id: string; username: string; password: string };
export type InsertUser = { username: string; password: string };
