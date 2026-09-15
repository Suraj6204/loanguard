import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/authRoutes';
import borrowerRoutes from './routes/borrowerRoutes';
import documentRoutes from './routes/documentRoutes';
import loanRoutes from './routes/loanRoutes';
import operationsRoutes from './routes/operationsRoutes';

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(generalLimiter);

// ============================================================
// BODY PARSERS
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// TRUST PROXY (for rate limiter behind reverse proxy)
// ============================================================
app.set('trust proxy', 1);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'LoanGuard API is running', timestamp: new Date().toISOString() });
});

// ============================================================
// API ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/borrower', borrowerRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/applications', loanRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/admin', operationsRoutes);

// ============================================================
// 404 HANDLER
// ============================================================
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    code: 'NOT_FOUND',
  });
});

// ============================================================
// ERROR HANDLER (must be last)
// ============================================================
app.use(errorHandler);

export default app;
