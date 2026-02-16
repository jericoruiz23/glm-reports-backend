// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { User } from "../models/user.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 🔹 INTERFAZ PARA REQ CON USUARIO
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "admin" | "viewer";
    passwordMustChange: boolean;
  };
}

// -------------------------
// Registro de usuario
// -------------------------
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(email, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "viewer",
      passwordMustChange: true,
    });

    await newUser.save();

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        passwordMustChange: true,
      },
    });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// -------------------------
// Login
// -------------------------
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Completar los campos" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET not defined");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        passwordMustChange: user.passwordMustChange,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
      path: "/",
    });

    return res.json({
      message: "Inicio de sesión exitoso",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      passwordMustChange: user.passwordMustChange,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error del servidor" });
  }
};

// -------------------------
// Cambio de contraseña
// -------------------------
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(400).json({ message: "No se encontró usuario" });
    }


    let { newPassword } = req.body;
    console.log("newPassword raw:", req.body.newPassword);
    console.log("type:", typeof req.body.newPassword);
    console.log("length:", req.body.newPassword?.length);


    // ✅ Asegurar string
    if (typeof newPassword !== "string") {
      return res.status(400).json({ message: "Formato de contraseña inválido" });
    }

    // ✅ Limpiar espacios invisibles
    newPassword = newPassword.trim();

    // ✅ Misma regla que frontend
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Contraseña muy corta" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(req.user.id, {
      password: hashed,
      passwordMustChange: false,
    });

    return res.json({ message: "Contraseña actualizada correctamente" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error del servidor" });
  }


};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const user = await User.findById(userId).select(
      "name email role passwordMustChange"
    );

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    return res.json({
      user,
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({
      message: "Error al obtener usuario",
    });
  }
};