import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// Apply rules engine to a single transaction
export function applyRulesToTransaction(
  description: string,
  amount: string,
  type: string,
  rules: { isActive: boolean; priority: number; field: string; operator: string; value: string; categoryId: string }[]
): string | null {
  const sorted = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

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

// POST /api/import — parse CSV rows, auto-categorize, store
router.post("/", async (req, res) => {
  try {
    const { accountId, fileName, rows } = req.body as {
      accountId: string;
      fileName: string;
      rows: {
        date: string;
        description: string;
        amount: string;
        type: "debit" | "credit";
        currency?: string;
        originalAmount?: string;
        originalCurrency?: string;
      }[];
    };

    if (!accountId || !fileName || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [account, rules] = await Promise.all([
      storage.getAccount(accountId),
      storage.getRules(),
    ]);

    const accountCurrency = account?.currency || "AUD";

    const batch = await storage.createImportBatch({ accountId, fileName, rowCount: rows.length });

    const txList = rows.map((row) => {
      const categoryId = applyRulesToTransaction(row.description, row.amount, row.type, rules);
      return {
        accountId,
        importBatchId: batch.id,
        date: row.date,
        description: row.description,
        amount: row.amount,
        type: row.type,
        currency: row.currency || accountCurrency,
        originalAmount: row.originalAmount || undefined,
        originalCurrency: row.originalCurrency || undefined,
        categoryId: categoryId ?? undefined,
        isManualCategory: false,
        isRecurring: false,
      };
    });

    const created = await storage.createTransactions(txList);
    res.json({ batch, transactions: created, categorized: created.filter((t) => t.categoryId).length });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// POST /api/apply-rules — re-apply all rules to existing non-manual transactions
router.post("/apply-rules", async (req, res) => {
  try {
    const rules = await storage.getRules();
    const allTxs = await storage.getTransactions();
    let updated = 0;

    for (const tx of allTxs) {
      if (!tx.isManualCategory) {
        const categoryId = applyRulesToTransaction(tx.description, tx.amount, tx.type, rules);
        if (categoryId !== tx.categoryId) {
          await storage.updateTransaction(tx.id, { categoryId: categoryId ?? undefined });
          updated++;
        }
      }
    }

    res.json({ updated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET/DELETE import batches
router.get("/batches", async (req, res) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const batches = accountId
      ? await storage.getImportBatchesByAccount(accountId)
      : await storage.getImportBatches();
    res.json(batches);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/batches/:id", async (req, res) => {
  try {
    await storage.deleteTransactionsByBatch(req.params.id);
    await storage.deleteImportBatch(req.params.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
