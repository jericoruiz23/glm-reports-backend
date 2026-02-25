import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'express-async-errors';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middlewares/errorHandler';
import userRoutes from './routes/user.routes';
import cookieParser from "cookie-parser";
import controlImportRoutes from "./routes/controlimport.routes";
import catalogRoutes from './routes/catalog.routes';
import processMetricsRoutes from "./routes/processMetrics.routes";

export const startServer = async () => {
  await connectDB();

  const app = express();

  app.use(helmet());


  // ✅ CORS (temporalmente abierto para Cloud Run)
  const allowedOrigins = [
    "http://localhost:3000",
    "https://lopezmena-importaciones.web.app",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );


  // ✅ Cookie parser
  app.use(cookieParser());

  // ✅ JSON
  app.use(express.json());

  // ✅ Health check (Cloud Run friendly)
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // 🔹 Rutas
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  // Rutas de métricas materializadas por proceso.
  // Deben montarse antes de `controlImportRoutes` para evitar colisión con `/:id`.
  app.use('/api/process', processMetricsRoutes);
  app.use('/api/process', controlImportRoutes);
  app.use("/api/catalogos", catalogRoutes);

  // ❌ Errores
  app.use(errorHandler);

  // ✅ Puerto OBLIGATORIO (Cloud Run)
  const port = Number(process.env.PORT);
  if (!port) {
    throw new Error('PORT no definido por el entorno');
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${port}`);
  });
};
