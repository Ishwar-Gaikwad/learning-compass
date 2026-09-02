import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';

dotenv.config();

const checkIndexes = async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  console.log('=== CURRENT MONGODB COLLECTIONS & INDEXES ===\n');

  for (const col of collections) {
    const name = col.name;
    const indexes = await db.collection(name).indexes();
    console.log(`Collection: ${name}`);
    console.log(JSON.stringify(indexes, null, 2));
    console.log('-----------------------------------');
  }

  process.exit(0);
};

checkIndexes();
