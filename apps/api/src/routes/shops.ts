import { Router } from "express";
import {
  create,
  getById,
  getStatus,
  list,
  remove,
  update,
} from "../controllers/shops.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.post("/", create);
router.get("/:id/status", getStatus);
router.get("/:id", getById);
router.patch("/:id", update);
router.delete("/:id", remove);

export default router;
