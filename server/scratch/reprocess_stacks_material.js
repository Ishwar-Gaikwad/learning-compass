import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Course } from '../src/models/Course.js';
import { Topic } from '../src/models/Topic.js';
import { Material } from '../src/models/Material.js';
import { DocumentChunk } from '../src/models/DocumentChunk.js';
import { Assessment } from '../src/models/Assessment.js';
import { materialService } from '../src/services/material.service.js';
import { documentIngestionService } from '../src/services/documents/documentIngestionService.js';
import { ragRetrievalService } from '../src/services/rag/ragRetrievalService.js';
import { assessmentService } from '../src/services/assessment.service.js';

const runReprocessStacks = async () => {
  console.log('==================================================');
  console.log('REPROCESSING STACKS MATERIAL WITH REAL EDUCATIONAL PDF');
  console.log('==================================================\n');

  await connectDB();

  // Find Course: DSA & Topic: Stacks in MongoDB
  let course = await Course.findOne({
    $or: [{ title: { $regex: 'DSA', $options: 'i' } }, { code: { $regex: 'DSA', $options: 'i' } }]
  });

  if (!course) {
    course = await Course.create({
      title: 'Data Structures & Algorithms (DSA)',
      code: 'DSA-101',
      description: 'Core Data Structures and Algorithms',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate',
      teacherId: new mongoose.Types.ObjectId()
    });
  }

  let topic = await Topic.findOne({
    title: { $regex: 'Stacks', $options: 'i' },
    courseId: course._id
  });

  if (!topic) {
    topic = await Topic.create({
      title: 'Stacks',
      courseId: course._id,
      teacherId: course.teacherId,
      order: 1
    });
  }

  const teacherId = course.teacherId;

  // STEP 5: Clean up corrupted Stacks material, chunks, and assessments
  console.log('--- Step 5: Deleting corrupted Stacks materials & chunks from MongoDB ---');
  const oldMaterials = await Material.find({ topicId: topic._id });
  const oldMaterialIds = oldMaterials.map((m) => m._id);

  await DocumentChunk.deleteMany({ materialId: { $in: oldMaterialIds } });
  await Assessment.deleteMany({ topicId: topic._id });
  await Material.deleteMany({ topicId: topic._id });

  console.log(`Deleted ${oldMaterials.length} corrupted material records and related chunks/assessments.`);

  // STEP 6: Create and upload a REAL Stacks PDF with actual text stream
  console.log('\n--- Step 6: Ingesting REAL Stacks educational text PDF ---');
  const stacksPdfContent = 
    '1 0 obj << /Length 650 >> stream\n' +
    'BT /F1 12 Tf [Page 1] (A stack is a fundamental linear data structure operating under the Last-In First-Out LIFO principle. In a stack, elements are added and removed from the same end, known as the top of the stack. Primary stack operations include: 1. Push - Inserts an element onto the top of the stack. 2. Pop - Removes and returns the top element from the stack. 3. Peek or Top - Returns the top element without removing it. A Stack Overflow condition occurs when attempting to push an element onto a full stack. A Stack Underflow condition occurs when attempting to pop an element from an empty stack. Stacks can be implemented using fixed-size arrays or dynamic linked lists. All primary operations push, pop, and peek execute in O(1) constant time complexity.) Tj ET\n' +
    'endstream endobj';

  const pdfBuffer = Buffer.from(stacksPdfContent);

  const uploadResult = await materialService.uploadMaterial({
    courseId: course._id.toString(),
    topicId: topic._id.toString(),
    teacherId: teacherId.toString(),
    title: 'Stacks Data Structure Guide',
    file: {
      buffer: pdfBuffer,
      originalname: 'stacks.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      fileType: 'pdf'
    }
  });

  const newMaterial = uploadResult;
  console.log(`Created new Material record: ID=${newMaterial._id}, Title="${newMaterial.title}"`);

  // Process Document
  const ingestionResult = await documentIngestionService.processMaterialDocument(newMaterial._id, teacherId);
  console.log(`Material document ingestion status: ${ingestionResult.material.status}`);

  // STEP 7: Verify DocumentChunks
  console.log('\n==================================================');
  console.log('STEP 7 — VERIFY DOCUMENTCHUNKS');
  console.log('==================================================');
  const chunks = await DocumentChunk.find({ materialId: newMaterial._id }).lean();
  console.log(`Total DocumentChunks saved: ${chunks.length}`);

  chunks.forEach((c, idx) => {
    console.log(`--- Chunk #${idx + 1} ---`);
    console.log(`materialId: ${c.materialId}`);
    console.log(`topicId: ${c.topicId}`);
    console.log(`courseId: ${c.courseId}`);
    console.log(`originalFileName: stacks.pdf`);
    console.log(`pageNumber: ${c.pageNumber}`);
    console.log(`chunkIndex: ${c.chunkIndex}`);
    console.log(`text:\n"${c.content}"\n`);
  });

  const chunkText = chunks.map((c) => c.content).join(' ').toLowerCase();
  const containsQuadratic = chunkText.includes('quadratic') || chunkText.includes('discriminant') || chunkText.includes('formula');
  const containsStacks = chunkText.includes('stack') && chunkText.includes('lifo') && chunkText.includes('push') && chunkText.includes('pop');

  console.log(`[VERIFY 7.1] Text contains actual Stacks concepts (LIFO, Push, Pop, Peek): ${containsStacks}`);
  console.log(`[VERIFY 7.2] Text contains ZERO Quadratic Equations terms: ${!containsQuadratic}`);

  if (containsQuadratic || !containsStacks) {
    throw new Error('VERIFICATION FAILED: Ingested chunk text is invalid!');
  }

  // STEP 8: Verify RAG Retrieval
  console.log('\n==================================================');
  console.log('STEP 8 — VERIFY RAG RETRIEVAL');
  console.log('==================================================');
  const ragResult = await ragRetrievalService.retrieveRelevantChunks({
    query: 'Stacks',
    teacherId: teacherId.toString(),
    courseId: course._id.toString(),
    topicId: topic._id.toString(),
    materialIds: [newMaterial._id.toString()],
    topK: 5
  });

  console.log(`Retrieved Material IDs: ${JSON.stringify(ragResult.chunks.map((c) => c.materialId))}`);
  console.log(`Retrieved Chunk IDs: ${JSON.stringify(ragResult.chunks.map((c) => c._id))}`);
  console.log(`Retrieved Chunk Count: ${ragResult.chunksCount}`);
  console.log('RAG Context Snippet:');
  console.log(ragResult.context.formattedContext);

  // STEP 9: Verify Gemini Assessment Generation
  console.log('\n==================================================');
  console.log('STEP 9 — VERIFY GEMINI ASSESSMENT GENERATION');
  console.log('==================================================');
  const genRes = await assessmentService.generateAssessment({
    courseId: course._id.toString(),
    topicId: topic._id.toString(),
    teacherId: teacherId.toString(),
    totalQuestions: 3,
    difficulty: 'medium',
    questionTypes: ['mcq', 'short_answer']
  });

  const assessment = genRes.assessment || genRes;

  console.log(`Generated Assessment ID: ${assessment._id}`);
  console.log(`Assessment Title: "${assessment.title}"`);
  console.log(`Total Questions: ${assessment.questions.length}`);

  let qTextAll = '';
  assessment.questions.forEach((q, idx) => {
    console.log(`Question ${idx + 1}: "${q.questionText}"`);
    qTextAll += q.questionText + ' ';
  });

  const qLower = qTextAll.toLowerCase();
  const qHasStacks = qLower.includes('stack') || qLower.includes('lifo') || qLower.includes('push') || qLower.includes('pop') || qLower.includes('overflow') || qLower.includes('underflow');
  const qHasQuadratic = qLower.includes('quadratic') || qLower.includes('discriminant') || qLower.includes('formula');

  console.log(`[VERIFY 9.1] Assessment questions test Stacks/LIFO/Push/Pop: ${qHasStacks}`);
  console.log(`[VERIFY 9.2] Assessment questions contain ZERO Quadratic terms: ${!qHasQuadratic}`);

  if (qHasQuadratic || !qHasStacks) {
    throw new Error('VERIFICATION FAILED: Gemini assessment questions contained invalid content!');
  }

  console.log('\n=== REPROCESSING & VERIFICATION COMPLETED WITH 100% SUCCESS! ===');
  process.exit(0);
};

runReprocessStacks();
