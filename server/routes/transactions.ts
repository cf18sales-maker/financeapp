import { Router } from "express";
import { storage } from "../storage";
import { insertTransactionSchema } from "@shared/schema";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { accountId, categoryId, uncategorized, search, dateFrom, dateTo, importBatchId } = req.query;
    const txs = await storage.getTransactions({
      accountId: accountId as string,
      categoryId: categoryId as string,
      uncategorized: uncategorized === "true",
      search: search as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      importBatchId: importBatchId as string,
    });
    res.json(txs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const data = insertTransactionSchema.partial().parse(req.body);
    const tx = await storage.updateTransaction(req.params.id, data);
    if (!tx) return res.status(404).json({ error: "Not found" });
    res.json(tx);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteTransaction(req.params.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
