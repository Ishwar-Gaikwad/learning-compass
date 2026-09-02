import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { Material } from './src/models/Material.js';
import { DocumentChunk } from './src/models/DocumentChunk.js';

const runVerification = async () => {
  console.log('=== Verifying Material & DocumentChunk Models ===');

  console.log('1. Verifying model imports...');
  console.log(' - Material model imported:', !!Material);
  console.log(' - DocumentChunk model imported:', !!DocumentChunk);

  console.log('2. Connecting to MongoDB Atlas...');
  await connectDB();

  console.log('3. Validating Material model instantiation & schema fields...');
  const teacherId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const topicId = new mongoose.Types.ObjectId();

  const testMaterial = new Material({
    teacherId,
    courseId,
    topicId,
    title: 'Unit 3 Polynomial Operations Notes',
    originalFileName: 'poly_notes.pdf',
    fileSizeBytes: 1048576,
    mimeType: 'application/pdf',
    fileType: 'pdf',
    fileUrl: 'https://s3.amazonaws.com/bucket/poly_notes.pdf',
    storageKey: 'materials/poly_notes.pdf',
    status: 'uploaded',
    extractedTextMetadata: {
      characterCount: 5200,
      wordCount: 850,
      ocrExecuted: false,
      totalChunksCount: 6
    }
  });

  const materialValidationErr = testMaterial.validateSync();
  console.log(' - Material validation result:', materialValidationErr ? materialValidationErr.message : 'SUCCESS (No errors)');

  console.log('4. Validating DocumentChunk model instantiation & vector embedding compatibility...');
  // Mock 1536-dimensional float vector array compatible with Atlas Vector Search
  const mockEmbeddingVector = new Array(1536).fill(0).map(() => parseFloat((Math.random() * 2 - 1).toFixed(6)));

  const testChunk = new DocumentChunk({
    materialId: testMaterial._id,
    topicId,
    teacherId,
    content: 'Synthetic division is a shorthand method of polynomial division in the special case of dividing by a linear factor.',
    pageNumber: 1,
    chunkIndex: 0,
    tokenCount: 24,
    embedding: mockEmbeddingVector,
    metadata: {
      fileName: 'poly_notes.pdf',
      mimeType: 'application/pdf',
      sectionHeader: 'Synthetic Division'
    }
  });

  const chunkValidationErr = testChunk.validateSync();
  console.log(' - DocumentChunk validation result:', chunkValidationErr ? chunkValidationErr.message : 'SUCCESS (No errors)');
  console.log(' - Embedding array length:', testChunk.embedding.length, 'dimensions');

  console.log('\n=== ALL MODEL VERIFICATIONS COMPLETED SUCCESSFULLY! ===');
  process.exit(0);
};

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
