import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Course } from '../src/models/Course.js';
import { Topic } from '../src/models/Topic.js';
import { Material } from '../src/models/Material.js';
import { DocumentChunk } from '../src/models/DocumentChunk.js';
import { Assessment } from '../src/models/Assessment.js';
import { User } from '../src/models/User.js';
import { ragRetrievalService } from '../src/services/rag/ragRetrievalService.js';
import { vectorSearchService } from '../src/services/rag/vectorSearchService.js';
import { buildAssessmentPrompt } from '../src/services/ai/prompts/assessmentPrompt.js';

const runDiagnostic = async () => {
  console.log('==================================================');
  console.log('STARTING READ-ONLY DIAGNOSTIC FOR DSA -> STACKS');
  console.log('==================================================\n');

  await connectDB();

  // Find Course: DSA or Title containing DSA / Data Structures
  const dsaCourse = await Course.findOne({
    $or: [
      { title: { $regex: 'DSA', $options: 'i' } },
      { title: { $regex: 'Data Structures', $options: 'i' } },
      { code: { $regex: 'DSA', $options: 'i' } }
    ]
  }).lean();

  console.log('=== SEARCHING FOR DSA COURSE IN MONGODB ===');
  if (!dsaCourse) {
    console.log('No course found matching "DSA" or "Data Structures". All courses in DB:');
    const allCourses = await Course.find({}).lean();
    console.log(allCourses.map((c) => ({ id: c._id, title: c.title, code: c.code, teacherId: c.teacherId })));
  } else {
    console.log(`Found Course: ID=${dsaCourse._id}, Code=${dsaCourse.code}, Title="${dsaCourse.title}", TeacherID=${dsaCourse.teacherId}`);
  }

  // Find Topic: Stacks
  const stacksTopic = await Topic.findOne({
    $or: [
      { title: { $regex: 'Stacks', $options: 'i' } },
      { title: { $regex: 'Stack', $options: 'i' } }
    ]
  }).lean();

  console.log('\n=== SEARCHING FOR STACKS TOPIC IN MONGODB ===');
  if (!stacksTopic) {
    console.log('No topic found matching "Stacks". All topics in DB:');
    const allTopics = await Topic.find({}).populate('courseId', 'title code').lean();
    console.log(allTopics.map((t) => ({ id: t._id, title: t.title, course: t.courseId?.title, courseId: t.courseId?._id, teacherId: t.teacherId })));
  } else {
    console.log(`Found Topic: ID=${stacksTopic._id}, Title="${stacksTopic.title}", CourseID=${stacksTopic.courseId}, TeacherID=${stacksTopic.teacherId}`);
  }

  // If both found or if we want to run diagnostic on them:
  let courseId = dsaCourse?._id?.toString();
  let topicId = stacksTopic?._id?.toString();
  let teacherId = (stacksTopic?.teacherId || dsaCourse?.teacherId)?.toString();
  let topicName = stacksTopic?.title;

  console.log('\n==================================================');
  console.log('STEP 1 — VERIFY THE REQUEST');
  console.log('==================================================');
  console.log('[ASSESSMENT REQUEST]');
  console.log(`courseId: ${courseId}`);
  console.log(`topicId: ${topicId}`);
  console.log(`teacherId: ${teacherId}`);
  console.log(`topicName: ${topicName}`);

  console.log('\n==================================================');
  console.log('STEP 2 — VERIFY TOPIC DATABASE RECORD');
  console.log('==================================================');
  if (stacksTopic) {
    console.log(`topic._id: ${stacksTopic._id}`);
    console.log(`topic.name: ${stacksTopic.title}`);
    console.log(`topic.courseId: ${stacksTopic.courseId}`);
    console.log(`topic.teacherId: ${stacksTopic.teacherId}`);
  } else {
    console.log('Topic record missing from database!');
  }

  console.log('\n==================================================');
  console.log('STEP 3 — VERIFY MATERIALS');
  console.log('==================================================');
  let materials = [];
  if (topicId) {
    materials = await Material.find({
      topicId: topicId,
      courseId: courseId,
      teacherId: teacherId
    }).lean();

    if (materials.length === 0) {
      console.log('No materials found matching (topicId, courseId, teacherId). Trying topicId alone:');
      materials = await Material.find({ topicId: topicId }).lean();
    }
  }

  console.log(`Total Materials returned: ${materials.length}`);
  materials.forEach((m, idx) => {
    console.log(`--- Material #${idx + 1} ---`);
    console.log(`materialId: ${m._id}`);
    console.log(`originalFileName: ${m.originalFileName || m.title}`);
    console.log(`topicId: ${m.topicId}`);
    console.log(`courseId: ${m.courseId}`);
    console.log(`teacherId: ${m.teacherId}`);
    console.log(`extractedText characterCount: ${m.extractedText?.length || 0}`);
    console.log(`extractedText first 300 chars: "${(m.extractedText || '').substring(0, 300)}..."`);
  });

  const materialIds = materials.map((m) => m._id.toString());

  console.log('\n==================================================');
  console.log('STEP 4 — VERIFY DOCUMENT CHUNKS');
  console.log('==================================================');
  let chunks = [];
  if (materialIds.length > 0) {
    chunks = await DocumentChunk.find({
      materialId: { $in: materialIds }
    }).lean();
  }

  console.log(`Total DocumentChunks found for materialIds: ${chunks.length}`);
  chunks.forEach((c, idx) => {
    console.log(`--- Chunk #${idx + 1} ---`);
    console.log(`chunkId: ${c._id}`);
    console.log(`materialId: ${c.materialId}`);
    console.log(`topicId: ${c.topicId}`);
    console.log(`courseId: ${c.courseId}`);
    console.log(`teacherId: ${c.teacherId}`);
    console.log(`pageNumber: ${c.pageNumber}`);
    console.log(`chunkIndex: ${c.chunkIndex}`);
    console.log(`first 500 characters of text:\n"${c.content.substring(0, 500)}"`);
  });

  if (materialIds.length === 0) {
    console.log('All DocumentChunks in DB (reporting first 5):');
    const sampleChunks = await DocumentChunk.find({}).limit(5).populate('materialId', 'originalFileName title').lean();
    sampleChunks.forEach((c, idx) => {
      console.log(`Sample Chunk #${idx + 1}: ID=${c._id}, materialId=${c.materialId?._id}, fileName=${c.materialId?.originalFileName}, content="${c.content.substring(0, 150)}..."`);
    });
  }

  console.log('\n==================================================');
  console.log('STEP 5 & 6 — VERIFY VECTOR SEARCH INPUT & RESULT');
  console.log('==================================================');
  let retrievalResult = null;
  if (topicName && teacherId) {
    console.log('Arguments passed into ragRetrievalService.retrieveRelevantChunks:');
    console.log({
      query: topicName,
      teacherId,
      courseId,
      topicId,
      materialIds,
      topK: 5
    });

    try {
      retrievalResult = await ragRetrievalService.retrieveRelevantChunks({
        query: topicName,
        teacherId,
        courseId,
        topicId,
        materialIds,
        topK: 5
      });

      console.log('\nVector Search Result Chunks:');
      retrievalResult.chunks.forEach((rc, idx) => {
        console.log(`Retrieved Chunk #${idx + 1}:`);
        console.log(`chunkId: ${rc._id}`);
        console.log(`materialId: ${rc.materialId}`);
        console.log(`topicId: ${rc.topicId}`);
        console.log(`courseId: ${rc.courseId}`);
        console.log(`teacherId: ${rc.teacherId}`);
        console.log(`score: ${rc.score}`);
        console.log(`first 500 chars text:\n"${rc.content.substring(0, 500)}"`);
      });
    } catch (err) {
      console.error('Vector search execution error:', err.message);
    }
  }

  console.log('\n==================================================');
  console.log('STEP 7 — VERIFY POST-RETRIEVAL VALIDATION');
  console.log('==================================================');
  console.log(`Allowed material IDs: ${JSON.stringify(materialIds)}`);
  console.log(`Allowed topic ID: ${topicId}`);
  console.log(`Allowed course ID: ${courseId}`);
  console.log(`Allowed teacher ID: ${teacherId}`);

  if (retrievalResult?.chunks) {
    retrievalResult.chunks.forEach((chunk) => {
      const cMat = chunk.materialId?.toString();
      const cTop = chunk.topicId?.toString();
      const cCourse = chunk.courseId?.toString();
      const cTeacher = chunk.teacherId?.toString();

      const matValid = materialIds.includes(cMat);
      const topValid = cTop === topicId;
      const courseValid = !courseId || cCourse === courseId;
      const teacherValid = cTeacher === teacherId;
      const isValid = matValid && topValid && courseValid && teacherValid;

      console.log(`Chunk ${chunk._id}: matId=${cMat}, topicId=${cTop}, courseId=${cCourse}, teacherId=${cTeacher} -> ${isValid ? 'VALID' : 'REJECTED'}`);
    });
  }

  console.log('\n==================================================');
  console.log('STEP 8 & 9 — VERIFY FINAL RAG CONTEXT & PROMPTS');
  console.log('==================================================');
  if (retrievalResult?.context) {
    const prompts = buildAssessmentPrompt({
      topicTitle: topicName || 'Stacks',
      contextData: retrievalResult.context,
      totalQuestions: 5,
      difficulty: 'medium',
      questionTypes: ['mcq', 'short_answer']
    });

    console.log('========== GEMINI RAG CONTEXT START ==========');
    console.log(retrievalResult.context.formattedContext || '(EMPTY CONTEXT)');
    console.log('========== GEMINI RAG CONTEXT END ==========\n');

    console.log('========== SYSTEM PROMPT START ==========');
    console.log(prompts.systemPrompt);
    console.log('========== SYSTEM PROMPT END ==========\n');

    console.log('========== USER PROMPT START ==========');
    console.log(prompts.userPrompt);
    console.log('========== USER PROMPT END ==========\n');
  }

  console.log('\n==================================================');
  console.log('STEP 11 & 12 — CHECK STORED ASSESSMENTS IN DATABASE');
  console.log('==================================================');
  const allAssessments = await Assessment.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log(`Total Recent Assessments in Database: ${allAssessments.length}`);
  allAssessments.forEach((a, idx) => {
    console.log(`--- Assessment #${idx + 1} ---`);
    console.log(`_id: ${a._id}`);
    console.log(`accessCode: ${a.accessCode}`);
    console.log(`title: "${a.title}"`);
    console.log(`topicId: ${a.topicId}`);
    console.log(`courseId: ${a.courseId}`);
    console.log(`teacherId: ${a.teacherId}`);
    console.log(`createdAt: ${a.createdAt}`);
    console.log(`sourceMaterialsUsed: ${JSON.stringify(a.sourceMaterialsUsed)}`);
    console.log(`Question 1 text: "${a.questions[0]?.questionText}"`);
    console.log(`Question 2 text: "${a.questions[1]?.questionText}"`);
  });

  process.exit(0);
};

runDiagnostic();
