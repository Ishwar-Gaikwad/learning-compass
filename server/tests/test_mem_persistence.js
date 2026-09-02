import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve('./.mongo_persistent_data');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

console.log('Testing MongoMemoryServer persistent dbPath:', dbPath);

const runTest = async () => {
  try {
    const server = await MongoMemoryServer.create({
      instance: {
        dbPath,
        storageEngine: 'wiredTiger'
      }
    });
    const uri = server.getUri();
    console.log('[PERSISTENCE TEST] Server URI:', uri);
    const conn = await mongoose.connect(uri, { dbName: 'learning_compass' });
    console.log('[PERSISTENCE TEST] Mongoose connected successfully.');
    await mongoose.disconnect();
    await server.stop();
    console.log('[PERSISTENCE TEST] Stopped cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('[PERSISTENCE TEST ERROR]:', err);
    process.exit(1);
  }
};

runTest();
