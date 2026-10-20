import { Router } from "express";
import {
  create,
  getById,
  getStatus,
  list,
  remove,
  retry,
  update,
  updateContent,
} from "../controllers/shops.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.post("/", create);
router.get("/:id/status", getStatus);
router.post("/:id/retry", retry);
router.put("/:id/content", updateContent);
router.get("/:id", getById);
router.patch("/:id", update);
router.delete("/:id", remove);

export default router;
