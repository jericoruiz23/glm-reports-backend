import { Router } from "express";
import { getUsers, updateUser, deleteUser } from "../controllers/user.controller";
import { auth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.get("/", auth, getUsers);

router.put("/:id", auth, requireRole("admin"), updateUser);

router.delete("/:id", auth, requireRole("admin"), deleteUser);

export default router;
