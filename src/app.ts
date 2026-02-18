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

export const startServer = async () => {
  await connectDB();

  const app = express();

  app.use(helmet());

  // ✅ Cookie parser
  app.use(cookieParser());

  // ✅ JSON
  app.use(express.json());

  // ✅ Health check (Cloud Run friendly)
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // 🌐 Ruta PÚBLICA /api/process — CORS abierto para Power BI y otros clientes externos
  app.use(
    '/api/process',
    cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }),
    controlImportRoutes
  );

  // ✅ CORS restrictivo para el resto de la API
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

  // 🔹 Rutas protegidas
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
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
