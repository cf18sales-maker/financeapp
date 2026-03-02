import { Router } from "express";
import { storage } from "../storage";
import { insertAccountSchema } from "@shared/schema";

const router = Router();

router.get("/", async (req, res) => {
  try {
    res.json(await storage.getAccounts());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const data = insertAccountSchema.parse(req.body);
    res.json(await storage.createAccount(data));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const data = insertAccountSchema.partial().parse(req.body);
    const acc = await storage.updateAccount(req.params.id, data);
    if (!acc) return res.status(404).json({ error: "Not found" });
    res.json(acc);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteAccount(req.params.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
