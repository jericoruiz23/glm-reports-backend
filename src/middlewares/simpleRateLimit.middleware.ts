import { Request, Response, NextFunction } from "express";

type Bucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, Bucket>();

export const simpleRateLimit = (max: number, windowMs: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        const user = (req as any).user;
        const key = String(user?.id ?? req.ip ?? "anonymous");
        const bucket = buckets.get(key);

        if (!bucket || now >= bucket.resetAt) {
            buckets.set(key, {
                count: 1,
                resetAt: now + windowMs,
            });
            return next();
        }

        if (bucket.count >= max) {
            return res.status(429).json({
                message: "Too many requests",
                retryAfterMs: Math.max(bucket.resetAt - now, 0),
            });
        }

        bucket.count += 1;
        buckets.set(key, bucket);
        return next();
    };
};
