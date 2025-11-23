import { Request, Response } from "express";
import { User } from "../models/user.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Hashear password
    const hashed = await bcrypt.hash(password, 10);

    // Crear usuario con password hasheado
    const newUser = new User({
      name,
      email,
      password: hashed,   // ✔ ahora sí
      role: role || "viewer",
    });

    await newUser.save(); // ✔ guardar en la BD

    return res.status(201).json({
      message: "User registered",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: (newUser as any).role,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validación
    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Comparar password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Firmar JWT
    const token = jwt.sign(
      { id: user._id, role: (user as any).role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );


    return res.json({
      message: "Login successful",
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
