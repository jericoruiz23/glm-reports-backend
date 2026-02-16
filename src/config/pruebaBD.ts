import "dotenv/config";
import mongoose from "mongoose";
import { Process } from "../models/controlimport.model";

function esFechaISO(valor: any) {
    return (
        typeof valor === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(valor)
    );
}

function normalizarValor(valor: any) {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return valor;

    d.setUTCHours(12, 0, 0, 0);
    return d;
}

function normalizeDates(obj: any, seen = new WeakSet()) {
    if (!obj || typeof obj !== "object") return;

    if (seen.has(obj)) return;
    seen.add(obj);

    for (const key of Object.keys(obj)) {
        const value = obj[key];

        if (value instanceof Date) {
            value.setUTCHours(12, 0, 0, 0);
        }
        else if (esFechaISO(value)) {
            obj[key] = normalizarValor(value);
        }
        else if (Array.isArray(value)) {
            value.forEach((v, i) => {
                if (v instanceof Date || esFechaISO(v)) {
                    value[i] = normalizarValor(v);
                } else {
                    normalizeDates(v, seen);
                }
            });
        }
        else if (typeof value === "object") {
            normalizeDates(value, seen);
        }
    }
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("✅ Conectado a MongoDB");

    const cursor = Process.find().cursor(); // ❗ SIN lean()

    let count = 0;

    for await (const doc of cursor) {
        const plain = doc.toObject(); // convertimos aquí

        normalizeDates(plain);

        await Process.updateOne(
            { _id: doc._id },
            { $set: plain }
        );

        count++;
    }

    console.log(`🎯 Migración completada. Procesos actualizados: ${count}`);
    await mongoose.disconnect();
}

run().catch(err => {
    console.error("❌ Error en migración", err);
    process.exit(1);
});
