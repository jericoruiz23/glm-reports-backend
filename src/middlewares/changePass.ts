import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const forcePasswordChange = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.passwordMustChange) {
        return res.status(403).json({
            message: "Password change required",
            code: "FORCE_PASSWORD_CHANGE",
        });
    }

    next();
};
