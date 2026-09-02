import mongoose from 'mongoose';

const sanitizeHost = (host) => {
  if (!host) return 'unknown';
  return host.replace(/:[^@]+@/, ':****@');
};

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI;
  const dbMode = process.env.DB_MODE;

  // 1. If MONGODB_URI exists in .env or DB_MODE=ATLAS: MongoDB Atlas is authoritative
  if (mongoUri || dbMode === 'ATLAS') {
    const uriToConnect = mongoUri || process.env.MONGODB_URI;
    console.log('[DB] mode: ATLAS');
    try {
      const conn = await mongoose.connect(uriToConnect, {
        dbName: 'learning_compass',
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 50,
        minPoolSize: 5
      });
      console.log('[DB] connected');
      console.log(`[DB] database: ${conn.connection.name}`);
      console.log(`[DB] host: ${sanitizeHost(conn.connection.host)}`);
      await ensureCorrectIndexes();
      return conn;
    } catch (error) {
      console.error(`[DB] Atlas connection failed: ${error.message}`);
      console.error('[DB] CRITICAL: Configured MongoDB Atlas database is unreachable. Aborting startup to prevent silent database fallback and user session loss.');
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }
      process.exit(1);
    }
  }

  // 2. Persistent Local MongoDB if DB_MODE=LOCAL
  if (dbMode === 'LOCAL') {
    const localUri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/learning_compass';
    console.log('[DB] mode: LOCAL');
    try {
      const conn = await mongoose.connect(localUri, {
        dbName: 'learning_compass'
      });
      console.log('[DB] connected');
      console.log(`[DB] database: ${conn.connection.name}`);
      console.log(`[DB] host: ${sanitizeHost(conn.connection.host)}`);
      await ensureCorrectIndexes();
      return conn;
    } catch (error) {
      console.error(`[DB] Persistent local database error: ${error.message}`);
      console.error('[DB] CRITICAL: Configured local MongoDB is unreachable. Aborting startup.');
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }
      process.exit(1);
    }
  }

  // 3. If no database configuration is present, abort startup.
  console.error('[CRITICAL MongoDB Error] MONGODB_URI is not defined and DB_MODE is not configured.');
  console.error('[DB] startup aborted');
  if (process.env.NODE_ENV === 'test') {
    throw new Error('MONGODB_URI is not defined and DB_MODE is not configured.');
  }
  process.exit(1);
};

export const ensureCorrectIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const collectionsToCheck = [
      'diagnosticreports',
      'learningpaths',
      'diagnosticcomparisons',
      'attempts',
      'assessmentassignments'
    ];

    for (const colName of collectionsToCheck) {
      const collection = db.collection(colName);
      const indexes = await collection.indexes().catch(() => []);
      for (const idx of indexes) {
        // Drop any standalone unique index on studentId alone
        const keys = Object.keys(idx.key || {});
        if (idx.unique && keys.length === 1 && keys[0] === 'studentId') {
          console.log(`[DB MIGRATION] Dropping incorrect unique index '${idx.name}' on collection '${colName}'`);
          await collection.dropIndex(idx.name).catch((err) => {
            console.warn(`[DB MIGRATION] Failed to drop index '${idx.name}':`, err.message);
          });
        }
      }
    }
  } catch (err) {
    console.warn('[DB MIGRATION] Index check failed:', err.message);
  }
};

export const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

