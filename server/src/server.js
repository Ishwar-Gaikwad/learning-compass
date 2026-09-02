import dotenv from 'dotenv';
// import { validateEnv, config } from './config/env.config.js';
// import app from './app.js';
// import { connectDB } from './config/db.js';

import { validateEnv, config } from './config/env.config.js';
import app from './app.js';
import { connectDB } from './config/db.js';

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

