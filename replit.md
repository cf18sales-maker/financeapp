# BudgetOS — Capital Allocation OS

## Vision

BudgetOS is not a basic budgeting app. It is a **Capital Allocation OS for ambitious professionals** — designed to answer the single most important question:

> "Can I safely invest $X right now?"

### Target Users
- **Phase 1 (Now):** Solo — the builder is User Zero. High-income, multi-broker, multi-currency, credit-card optimized, offset-mortgage aware, asset-allocation focused.
- **Phase 2 (Medium term):** High-income professionals — tech workers, consultants, founders, SaaS sales leaders with multiple brokers and cross-border exposure.
- **Phase 3 (Long term):** SaaS product. Not a family budget tool. A professional capital allocation platform.

### Inspiration & Differentiation
- **PocketSmith:** Good statement imports and rule engine, but lacks live surplus modeling and investment integration.
- **YNAB:** Strong envelope logic, but poor investment layer. Not built for credit-card + allocation thinking.
- **Monarch/Copilot:** Clean UX but US-centric, no capital allocation modeling, no offset mortgage logic.
- **BudgetOS edge:** True surplus modeling + investment layer + offset mortgage modeling + AU market focus.

---

## Phased Roadmap

### Phase 1 (MVP — Current)
- [x] Manual statement import (CSV) with column mapping
- [x] Multi-account support (cards, banks)
- [x] Rules-based auto-categorization
- [x] Dashboard with spending overview
- [x] Transaction management
- [ ] **Budgets** — per-category monthly spend limits with MTD tracking
- [ ] **Surplus projection** — safe-to-invest amount before statement closes
- [ ] Fixed vs variable expense tagging
- [ ] Recurring transaction detection

### Phase 2 (Scale)
- [ ] AU bank connectivity (Big 4, Amex AU)
- [ ] Multi-currency normalization (AUD/USD base)
- [ ] Safety buffer modeling
- [ ] Mobile-responsive layouts
- [ ] PDF monthly snapshot + CSV export
- [ ] Annual tax summary export

### Phase 3 (Differentiator)
- [ ] Investment tracking (stocks, ETFs, super)
- [ ] Brokerage account integration (IBKR, Moomoo)
- [ ] Asset allocation view + rebalancing signals
- [ ] Capital deployment suggestions
- [ ] Offset mortgage modeling
- [ ] Net worth over time
- [ ] Property value + mortgage balance tracking
- [ ] Accountant-friendly reports

---

## Architecture Principles

### Code Organization Rules
- **Domain-driven structure:** Routes, storage, and frontend pages are split by domain (accounts, categories, rules, transactions, budgets, investments, stats)
- **No spaghetti routes:** Each domain has its own route file under `server/routes/`
- **Thin routes:** Business logic lives in storage/service layer, not route handlers
- **Schema-first:** All new features start with `shared/schema.ts` before any route or UI
- **Modular frontend pages:** One file per page in `client/src/pages/`, shared components in `client/src/components/`

### Multi-Currency Architecture
- **Base currency:** AUD (primary user is Australian)
- **All amounts stored in original currency** with `currency` field on both accounts and transactions
- `originalAmount` + `originalCurrency` on transactions for cross-currency normalization later
- Exchange rate table prepared for Phase 2 normalization

### Multi-User Preparation
- Even in single-user mode, schema should have `userId` concept ready (nullable now, required in Phase 3 SaaS mode)
- Do not hard-code single-user assumptions into business logic

### Database Schema Philosophy
- Prefer nullable columns when adding new fields to avoid breaking existing data
- Never change primary key types — all IDs are `varchar` with UUID default
- Always use `npm run db:push --force` for schema changes
- Document every table's purpose in schema comments

---

## Tech Stack

- **Frontend:** React + TypeScript + Vite, TanStack Query, wouter routing, shadcn/ui, Recharts
- **Backend:** Express.js REST API, modular route files per domain
- **Database:** PostgreSQL via Drizzle ORM (Neon-backed Replit DB)
- **Styling:** Tailwind CSS, Open Sans font, green primary color theme

---

## File Structure

```
shared/
  schema.ts          ← ALL database table definitions and types (source of truth)

server/
  index.ts           ← App entry point, middleware, startup
  db.ts              ← Drizzle + pg pool connection
  seed.ts            ← Seed data (runs once on startup)
  storage.ts         ← IStorage interface + DatabaseStorage class
  routes/
    index.ts         ← Registers all domain routers
    accounts.ts      ← /api/accounts
    categories.ts    ← /api/categories
    rules.ts         ← /api/rules
    transactions.ts  ← /api/transactions
    import.ts        ← /api/import
    budgets.ts       ← /api/budgets
    stats.ts         ← /api/stats/*

client/src/
  App.tsx            ← Root with sidebar layout and routing
  components/
    app-sidebar.tsx  ← Navigation sidebar
    ui/              ← shadcn components (do not modify)
  pages/
    dashboard.tsx
    transactions.tsx
    accounts.tsx
    categories.tsx
    rules.tsx
    budgets.tsx      ← NEW: per-category monthly limits + MTD spend
    import.tsx
```

---

## Domain Data Models

### accounts
- id, name, institution, type (checking/savings/credit_card/investment/super/mortgage/loan/other)
- color, currency (default AUD), description

### categories
- id, name, color, icon, parentId (for sub-categories in future)

### category_rules
- field (description/amount/type), operator (contains/starts_with/ends_with/equals/regex/gt/lt/gte/lte)
- value, categoryId, priority, isActive

### budgets ← NEW
- categoryId, month (YYYY-MM), limitAmount, currency (default AUD)
- Unique constraint: one budget per category per month

### transactions
- accountId, importBatchId, date, description, amount, type (debit/credit)
- categoryId, isManualCategory, notes
- currency (default AUD) ← NEW
- originalAmount, originalCurrency ← NEW (for multi-currency source data)
- fixedVariable (fixed/variable/discretionary) ← NEW
- isRecurring (boolean) ← NEW

### import_batches
- accountId, fileName, rowCount, importedAt

---

## API Endpoints

```
GET  /api/accounts         GET  /api/categories      GET  /api/rules
POST /api/accounts         POST /api/categories      POST /api/rules
PUT  /api/accounts/:id     PUT  /api/categories/:id  PUT  /api/rules/:id
DEL  /api/accounts/:id     DEL  /api/categories/:id  DEL  /api/rules/:id

GET  /api/transactions     GET  /api/budgets          GET  /api/import-batches
PUT  /api/transactions/:id POST /api/budgets          DEL  /api/import-batches/:id
DEL  /api/transactions/:id PUT  /api/budgets/:id
                           DEL  /api/budgets/:id
                           GET  /api/budgets/summary/:month

POST /api/import
POST /api/apply-rules

GET  /api/stats/spending-by-category
GET  /api/stats/monthly-spending
GET  /api/stats/surplus/:month      ← FUTURE: safe-to-invest projection
```

---

## Key Design Decisions

1. **AUD-first:** Default currency is AUD throughout. USD support exists for future multi-currency normalization.
2. **Statement-import first, API-connect later:** Architecture supports both flows without a rewrite.
3. **Credit-card optimized:** The app understands that credit card statements show debits as positive, banks show them as negative — the import wizard normalizes this.
4. **No auth yet:** Single-user now, but schema is userId-ready for SaaS Phase 3.
5. **Phase gates:** Investment tracking, bank API connectivity, and offset modeling are Phase 2-3 and should not pollute Phase 1 code with premature abstractions.
