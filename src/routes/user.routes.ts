import { Router } from "express";
import { getUsers, updateUser, deleteUser } from "../controllers/user.controller";
import { auth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

// GET all users
router.get("/", auth, getUsers);

// PUT update user (solo admin)
router.put("/:id", auth, requireRole("admin"), updateUser);

// DELETE user (solo admin)
router.delete("/:id", auth, requireRole("admin"), deleteUser);

export default router;
