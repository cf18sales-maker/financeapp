# BudgetOS — Personal Finance App

## Overview

BudgetOS is a personal budgeting MVP focused on manual credit card/bank statement imports and a rules-based categorization system. It supports multiple statement sources (different cards/banks).

## Architecture

- **Frontend**: React + TypeScript + Vite (SPA), TanStack Query for data fetching
- **Backend**: Express.js REST API
- **Database**: PostgreSQL via Drizzle ORM (Neon-backed Replit DB)
- **Routing**: Wouter (client-side)
- **UI**: shadcn/ui + Tailwind CSS + Recharts for charts

## Key Features

1. **Dashboard** — Spending overview, bar chart (monthly), pie chart (by category), recent transactions
2. **Transactions** — Full transaction list with search, filter by account/category, uncategorized filter, inline category assignment
3. **Accounts** — Manage banks/cards (Chase, BofA, Amex, etc.) with type, color, institution
4. **Categories** — Manage budget categories with colors
5. **Rules** — Rules-based auto-categorization (match description/amount/type with contains/regex/etc, assign category, set priority)
6. **Import** — CSV import wizard with drag-and-drop, column mapping, preview, and batch history

## Pages & Routes

- `/` → Dashboard
- `/transactions` → Transaction list
- `/accounts` → Account management
- `/categories` → Category management
- `/rules` → Categorization rules
- `/import` → CSV import

## Database Schema

- `accounts` — name, institution, type (checking/savings/credit_card/investment/loan/other), color, currency
- `categories` — name, color, icon
- `category_rules` — field (description/amount/type), operator (contains/starts_with/ends_with/equals/regex/gt/lt/gte/lte), value, categoryId, priority, isActive
- `import_batches` — accountId, fileName, rowCount, importedAt
- `transactions` — accountId, importBatchId, date, description, amount, type (debit/credit), categoryId, isManualCategory

## API Endpoints

- `GET/POST /api/accounts`
- `PUT/DELETE /api/accounts/:id`
- `GET/POST /api/categories`
- `PUT/DELETE /api/categories/:id`
- `GET/POST /api/rules`
- `PUT/DELETE /api/rules/:id`
- `GET /api/import-batches`
- `DELETE /api/import-batches/:id` (also deletes its transactions)
- `GET /api/transactions` (supports ?accountId, categoryId, uncategorized, search, dateFrom, dateTo)
- `PUT/DELETE /api/transactions/:id`
- `POST /api/import` — Bulk import with auto-categorization
- `POST /api/apply-rules` — Re-apply all rules to existing transactions
- `GET /api/stats/spending-by-category`
- `GET /api/stats/monthly-spending`

## Seed Data

On first startup, seeds:
- 3 accounts (Chase Freedom, BofA Checking, Amex Platinum)
- 10 categories (Groceries, Dining Out, Transportation, Entertainment, Utilities, Healthcare, Travel, Shopping, Income, Subscriptions)
- 15 categorization rules
- 23 sample transactions across 2 import batches

## Running

The `Start application` workflow runs `npm run dev` which starts Express (port 5000) and Vite together.
