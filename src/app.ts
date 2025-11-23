import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'express-async-errors';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middlewares/errorHandler';
export const startServer = async () => {
  await connectDB(); // conectar primero

  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json());

  // Test simple para probar que Express funciona
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Rutas
  app.use('/api/auth', authRoutes);

  app.use(errorHandler);

  const port = parseInt(process.env.PORT || '3001', 10);
  app.listen(port, "0.0.0.0", () => console.log(`Server running on port ${port}`));
};
