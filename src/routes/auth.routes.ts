import { Router } from "express";
import { register, login, changePassword, getMe } from "../controllers/auth.controller";
import { auth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/me", auth, getMe);
router.post("/change-password", auth, changePassword);

router.post("/logout", (req, res) => {
    res.clearCookie("access_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
    });

    return res.json({ message: "Logged out" });
});

router.get("/admin/reports", auth, requireRole("admin"), (req, res) => {
    res.json({ message: "Admin reports content" });
});

router.get("/viewer/dashboard", auth, (req, res) => {
    res.json({ message: "Viewer dashboard content" });
});

export default router;
