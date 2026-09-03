import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized Environment Configuration & Startup Validator
 */
export const validateEnv = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const errors = [];

  // Required in production
  if (nodeEnv === 'production') {
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI is required in production environment.');
    }

    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET is required in production environment.');
    } else if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long in production environment.');
    }

    const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    if (!clientUrl) {
      errors.push('FRONTEND_URL (or CLIENT_URL) is required in production for CORS security.');
    }

    if (process.env.STORAGE_PROVIDER === 's3') {
      if (!process.env.AWS_S3_BUCKET_NAME) errors.push('AWS_S3_BUCKET_NAME is required when STORAGE_PROVIDER=s3.');
      if (!process.env.AWS_ACCESS_KEY_ID) errors.push('AWS_ACCESS_KEY_ID is required when STORAGE_PROVIDER=s3.');
      if (!process.env.AWS_SECRET_ACCESS_KEY) errors.push('AWS_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=s3.');
      if (!process.env.S3_ENDPOINT) errors.push('S3_ENDPOINT is required when STORAGE_PROVIDER=s3.');
      if (!process.env.S3_REGION) errors.push('S3_REGION is required when STORAGE_PROVIDER=s3.');
    }

    if (process.env.LLM_PROVIDER === 'gemini' && !process.env.GEMINI_API_KEY) {
      errors.push('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');
    }

    if (process.env.OCR_PROVIDER === 'gemini' && !process.env.GEMINI_API_KEY) {
      errors.push('GEMINI_API_KEY is required when OCR_PROVIDER=gemini.');
    }
  }

  if (errors.length > 0) {
    console.error('====================================================');
    console.error('[CRITICAL] PRODUCTION ENVIRONMENT CONFIGURATION ERROR');
    console.error('====================================================');
    errors.forEach((err, idx) => console.error(` ${idx + 1}. ${err}`));
    console.error('====================================================');
    process.exit(1);
  }
};

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'development_fallback_jwt_secret_min_32_chars_long',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    s3BucketName: process.env.AWS_S3_BUCKET_NAME || 'learning-compass-materials',
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)
  },
  ai: {
    llmProvider: process.env.LLM_PROVIDER || 'gemini',
    llmModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    geminiApiKey: process.env.GEMINI_API_KEY
  },
  embedding: {
    provider: process.env.EMBEDDING_PROVIDER || 'local',
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10)
  },
  ocr: {
    provider: process.env.OCR_PROVIDER || 'local',
    model: process.env.OCR_MODEL || 'gpt-4o-mini'
  },
  vectorSearch: {
    indexName: process.env.VECTOR_INDEX_NAME || 'document_chunks_vector_index',
    path: process.env.VECTOR_SEARCH_PATH || 'embedding',
    numCandidates: parseInt(process.env.VECTOR_SEARCH_NUM_CANDIDATES || '50', 10),
    limit: parseInt(process.env.VECTOR_SEARCH_LIMIT || '5', 10)
  }
};
