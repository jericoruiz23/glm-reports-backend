import "dotenv/config";
import { connectDB } from "./db";
import ProcessMetrics from "../models/processMetrics.model";
import { Process } from "../models/controlimport.model";
import { Types } from "mongoose";

const main = async () => {
    await connectDB();

    let scanned = 0;
    let removed = 0;
    const batchSize = Number(process.argv[2] ?? 200);

    const cursor = ProcessMetrics.find({}, { _id: 1, processId: 1 })
        .sort({ _id: 1 })
        .cursor();

    const orphanIds: Types.ObjectId[] = [];
    for await (const doc of cursor) {
        scanned += 1;
        const exists = await Process.exists({ _id: doc.processId });
        if (!exists) {
            orphanIds.push(doc._id);
        }

        if (orphanIds.length >= batchSize) {
            const result = await ProcessMetrics.deleteMany({ _id: { $in: orphanIds } });
            removed += result.deletedCount ?? 0;
            orphanIds.length = 0;
            console.log(`[metrics:cleanup-orphans] scanned=${scanned} removed=${removed}`);
        }
    }

    if (orphanIds.length > 0) {
        const result = await ProcessMetrics.deleteMany({ _id: { $in: orphanIds } });
        removed += result.deletedCount ?? 0;
    }

    console.log(`[metrics:cleanup-orphans] completed scanned=${scanned} removed=${removed}`);
    process.exit(0);
};

main().catch((error) => {
    console.error("[metrics:cleanup-orphans] fatal error:", error);
    process.exit(1);
});
