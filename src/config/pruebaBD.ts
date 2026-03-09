import "dotenv/config";
import mongoose from "mongoose";
import { Process } from "../models/controlimport.model";

const STAGES = ["inicio", "preembarque", "postembarque", "aduana", "despacho"] as const;

function normalizeDateFieldsToNoon(obj: any, seen = new WeakSet(), depth = 0): boolean {
    if (!obj || typeof obj !== "object" || depth > 10) return false;

    if (seen.has(obj)) return false;
    seen.add(obj);

    let changed = false;

    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (item && typeof item === "object") {
                if (normalizeDateFieldsToNoon(item, seen, depth + 1)) changed = true;
            }
        }
        return changed;
    }

    const keys = Object.keys(obj);
    for (const key of keys) {

        if (key.startsWith("_") || key.startsWith("$") || key === "createdAt" || key === "updatedAt" || key === "__v") continue;

        let val: any;
        try {
            val = obj[key];
        } catch {
            continue;
        }

        if (val instanceof Date) {
            const h = val.getUTCHours();
            const m = val.getUTCMinutes();
            const s = val.getUTCSeconds();
            const ms = val.getUTCMilliseconds();

            if (h !== 12 || m !== 0 || s !== 0 || ms !== 0) {
                val.setUTCHours(12, 0, 0, 0);
                changed = true;
            }
        } else if (val && typeof val === "object" && !(val instanceof mongoose.Types.ObjectId)) {
            if (normalizeDateFieldsToNoon(val, seen, depth + 1)) changed = true;
        }
    }

    return changed;
}

async function run() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("❌ MONGO_URI no definida en .env");
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("✅ Conectado a MongoDB");

    const total = await Process.countDocuments();
    console.log(`📦 Total de procesos en BD: ${total}`);

    const cursor = Process.find().cursor();

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for await (const doc of cursor) {
        try {
            let docChanged = false;

            for (const stage of STAGES) {
                const stageData = (doc as any)[stage];
                if (stageData) {
                    if (normalizeDateFieldsToNoon(stageData)) {
                        doc.markModified(stage);
                        docChanged = true;
                    }
                }
            }

            if (docChanged) {
                await doc.save(); // Dispara el pre('save') como respaldo
                updated++;
                if (updated % 50 === 0) {
                    console.log(`   … ${updated} procesos actualizados`);
                }
            } else {
                skipped++;
            }
        } catch (err: any) {
            errors++;
            console.error(`❌ Error en proceso ${doc._id}: ${err.message}`);
        }
    }

    console.log("");
    console.log("═══════════════════════════════════════════");
    console.log("🎯 MIGRACIÓN COMPLETADA");
    console.log(`   ✅ Actualizados:  ${updated}`);
    console.log(`   ⏭️  Sin cambios:  ${skipped}`);
    console.log(`   ❌ Errores:       ${errors}`);
    console.log(`   📦 Total:         ${total}`);
    console.log("═══════════════════════════════════════════");

    await mongoose.disconnect();
}

run().catch(err => {
    console.error("❌ Error fatal en migración:", err);
    process.exit(1);
});
