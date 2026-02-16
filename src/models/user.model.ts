import { Document, Schema, model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "viewer";
  passwordMustChange: boolean; // 👈 NUEVO
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "viewer"],
      default: "viewer",
    },
    passwordMustChange: {
      type: Boolean,
      default: true, // 👈 CLAVE
    },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema, "users");
