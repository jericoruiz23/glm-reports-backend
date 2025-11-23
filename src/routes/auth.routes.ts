import { Router } from "express";
import { register, login } from "../controllers/auth.controller";
import { auth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

// -------------------------
// Autenticación
// -------------------------
router.post("/register", register);
router.post("/login", login);

// -------------------------
// Rutas protegidas
// -------------------------

// Solo admin puede acceder
router.get("/admin/reports", auth, requireRole("admin"), (req, res) => {
    res.json({ message: "Admin reports content" });
});

// Cualquier usuario autenticado puede acceder
router.get("/viewer/dashboard", auth, (req, res) => {
    res.json({ message: "Viewer dashboard content" });
});

export default router;
