import "dotenv/config";
import { connectDB } from "./db";
import { Process } from "../models/controlimport.model";

const main = async () => {
    await connectDB();

    const dryRun = String(process.argv[2] ?? "true") !== "false";
    const filter = {
        "automatico.cumplimientoDemorraje": { $exists: true },
    };

    if (dryRun) {
        const count = await Process.countDocuments(filter);
        console.log(`[legacy-cleanup][dry-run] docs that would be updated: ${count}`);
        process.exit(0);
    }

    const result = await Process.updateMany(
        filter,
        {
            $unset: {
                "automatico.cumplimientoDemorraje": "",
            },
        }
    );
    console.log(
        `[legacy-cleanup] matched=${result.matchedCount} modified=${result.modifiedCount}`
    );
    process.exit(0);
};

main().catch((error) => {
    console.error("[legacy-cleanup] fatal error:", error);
    process.exit(1);
});
