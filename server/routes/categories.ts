import { Router } from "express";
import { storage } from "../storage";
import { insertCategorySchema } from "@shared/schema";

const router = Router();

router.get("/", async (req, res) => {
  try {
    res.json(await storage.getCategories());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const data = insertCategorySchema.parse(req.body);
    res.json(await storage.createCategory(data));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const data = insertCategorySchema.partial().parse(req.body);
    const cat = await storage.updateCategory(req.params.id, data);
    if (!cat) return res.status(404).json({ error: "Not found" });
    res.json(cat);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteCategory(req.params.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
