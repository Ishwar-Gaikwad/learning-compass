import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config();
dotenv.config({ path: './.env' });
dotenv.config({ path: '../server/.env' });

console.log('MONGODB_URI present:', Boolean(process.env.MONGODB_URI));
console.log('MONGODB_URI value:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 25) + '...' : 'undefined');

const testConnect = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'learning_compass',
      serverSelectionTimeoutMS: 5000
    });
    console.log('[DB TEST SUCCESS] Host:', conn.connection.host, 'DB Name:', conn.connection.name);
    process.exit(0);
  } catch (err) {
    console.error('[DB TEST ERROR]:', err.message);
    process.exit(1);
  }
};

testConnect();
