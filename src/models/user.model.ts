import { Document, Schema, model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "viewer";
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
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema, "users");
