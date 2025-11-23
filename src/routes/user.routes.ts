import { Router } from "express";
import { User } from "../models/user.model";

const router = Router();

router.get("/", async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

export default router;
