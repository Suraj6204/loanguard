import app from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';

async function start() {
  try {
    await connectDatabase();

    app.listen(env.PORT, () => {
      console.log(`
╔══════════════════════════════════════════╗
║       🏦 LoanGuard API Server           ║
║──────────────────────────────────────────║
║  Port:        ${String(env.PORT).padEnd(26)}║
║  Environment: ${env.NODE_ENV.padEnd(26)}║
║  API URL:     http://localhost:${String(env.PORT).padEnd(10)}║
╚══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
