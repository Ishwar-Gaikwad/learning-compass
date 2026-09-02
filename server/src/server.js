import dotenv from 'dotenv';
import { validateEnv, config } from './src/config/env.config.js';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';

dotenv.config();
validateEnv();

const PORT = config.port;

const startServer = async () => {
  // Connect to MongoDB Atlas first
  await connectDB();

  // Start Express HTTP Server
  app.listen(PORT, () => {
    console.log(`[Server] Learning Compass API running on port ${PORT} (${config.nodeEnv})`);
  });
};

startServer();

