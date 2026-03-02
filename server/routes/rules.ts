import { Router } from "express";
import { storage } from "../storage";
import { insertCategoryRuleSchema } from "@shared/schema";

const router = Router();

router.get("/", async (req, res) => {
  try {
    res.json(await storage.getRules());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const data = insertCategoryRuleSchema.parse(req.body);
    res.json(await storage.createRule(data));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const data = insertCategoryRuleSchema.partial().parse(req.body);
    const rule = await storage.updateRule(req.params.id, data);
    if (!rule) return res.status(404).json({ error: "Not found" });
    res.json(rule);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteRule(req.params.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
