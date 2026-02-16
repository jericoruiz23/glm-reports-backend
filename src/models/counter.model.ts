import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
    _id: String,
    seq: Number
});

export const Counter = mongoose.model("Counter", counterSchema);
