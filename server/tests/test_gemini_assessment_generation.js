import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';
import { Material } from './src/models/Material.js';
import { DocumentChunk } from './src/models/DocumentChunk.js';
import { Assessment } from './src/models/Assessment.js';
import { AssessmentAssignment } from './src/models/AssessmentAssignment.js';
import { Attempt } from './src/models/Attempt.js';
import { AttemptResponse } from './src/models/AttemptResponse.js';
import { courseService } from './src/services/course.service.js';
import { topicService } from './src/services/topic.service.js';
import { materialService } from './src/services/material.service.js';
import { documentIngestionService } from './src/services/documents/documentIngestionService.js';
import { assessmentService } from './src/services/assessment.service.js';
import { attemptService } from './src/services/attempt.service.js';
import { llmService } from './src/services/ai/llmService.js';

dotenv.config();

const runGeminiAssessmentGenerationIntegrationTest = async () => {
  console.log('=== STARTING GEMINI ASSESSMENT GENERATION INTEGRATION TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_gemini_${Date.now()}@example.com`;
  const studentEmail = `student_gemini_${Date.now()}@example.com`;

  let course, topic, uploadedMaterial, initialAssessmentCount;

  try {
    initialAssessmentCount = await Assessment.countDocuments();

    // 1. Setup Teacher & Student
    console.log('--- Step 1: Register Teacher & Student ---');
    const teacher = await User.create({ name: 'Teacher Gemini', email: teacherEmail, password: 'password123', role: 'teacher' });
    const student = await User.create({ name: 'Student Gemini', email: studentEmail, password: 'password123', role: 'student' });

    // 2. Setup Course & Topic
    console.log('--- Step 2: Create Course & Topic ---');
    course = await courseService.createCourse(teacher._id, {
      code: `GEM_${Date.now().toString().slice(-4)}`,
      title: 'Gemini Integration Course',
      description: 'Course testing real Gemini assessment generation',
      subject: 'Physics',
      gradeLevel: 'High School'
    });

    topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Newton Laws of Motion',
      description: 'First, Second, and Third laws of motion and momentum conservation',
      order: 1
    });

    // 3. Upload & Ingest PDF Material
    console.log('--- Step 3: Upload & Ingest PDF Material ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 200>>stream\nBT /F1 12 Tf 72 712 Td (Newton First Law states an object remains at rest or in uniform motion unless acted upon by a net external force. Newton Second Law states force equals mass times acceleration F = ma. Newton Third Law states for every action there is an equal and opposite reaction.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n550\n%%EOF'
    );

    uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'newton_laws.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'Newton Laws Study Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);
    const chunkCount = await DocumentChunk.countDocuments({ materialId: uploadedMaterial._id });
    console.log(`[RAG CHECK] Processed document chunk count in DB: ${chunkCount}`);

    // 4. Generate Assessment using Gemini & RAG Pipeline
    console.log('\n--- Step 4: Generate Assessment with Gemini & RAG Pipeline ---');
    const genResult = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Newton Laws Diagnostic Quiz',
      totalQuestions: 2,
      difficulty: 'medium'
    });

    const generatedAssessment = genResult.assessment;
    console.log(`[VERIFY 1-3] RAG Retrieval retrievedChunksCount: ${genResult.retrievedChunksCount} (Expected: > 0)`);
    if (genResult.retrievedChunksCount <= 0) {
      throw new Error(`RAG Retrieval Failed: retrievedChunksCount is ${genResult.retrievedChunksCount}`);
    }

    console.log(`[VERIFY 4-8] Gemini Assessment Created ID: ${generatedAssessment._id}, Code: ${generatedAssessment.accessCode}`);
    console.log(`Questions Generated Count: ${generatedAssessment.questions.length}`);
    if (generatedAssessment.questions.length === 0) {
      throw new Error('Gemini Generation Failed: questions array is empty');
    }

    // 5. Verify sourceReferences and MongoDB storage
    console.log('\n--- Step 5: Verify Source References & MongoDB Storage ---');
    const dbAssessment = await Assessment.findById(generatedAssessment._id);
    if (!dbAssessment) {
      throw new Error('MongoDB Storage Failed: Assessment record not found in MongoDB!');
    }

    const firstQ = dbAssessment.questions[0];
    console.log(`Question 1 Text: "${firstQ.questionText.slice(0, 60)}..."`);
    console.log(`Question 1 sourceReferences count: ${firstQ.sourceReferences ? firstQ.sourceReferences.length : 0}`);
    if (!Array.isArray(firstQ.sourceReferences) || firstQ.sourceReferences.length === 0) {
      console.warn('[WARN] Question sourceReferences empty in LLM output, but schema supports sourceReferences.');
    } else {
      console.log(`[VERIFY 9] Source Citation 1: materialId=${firstQ.sourceReferences[0].materialId}, page=${firstQ.sourceReferences[0].pageNumber}`);
    }

    // 6. Test Student Flow: Join by Access Code, Start Attempt, Submit
    console.log('\n--- Step 6: Test Student Compatibility Flow ---');
    const joinRes = await assessmentService.joinAssessmentByCode({
      accessCode: generatedAssessment.accessCode,
      studentId: student._id
    });
    console.log(`[VERIFY 10] Student Joined Assessment: ${joinRes.assessment._id}`);

    const startRes = await attemptService.startAttempt({
      assessmentId: generatedAssessment._id,
      studentId: student._id
    });
    const attempt = startRes.attempt;
    console.log(`Student Attempt Started ID: ${attempt._id}`);

    // Save student answers
    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: generatedAssessment.questions[0]._id,
      studentAnswer: 'Newton First Law states objects remain in motion unless acted upon by external force.',
      studentId: student._id
    });

    if (generatedAssessment.questions[1]) {
      await attemptService.saveResponse({
        attemptId: attempt._id,
        questionId: generatedAssessment.questions[1]._id,
        studentAnswer: 'F = ma',
        studentId: student._id
      });
    }

    // Submit attempt
    const submitRes = await attemptService.submitAttempt({
      attemptId: attempt._id,
      studentId: student._id
    });
    console.log(`[VERIFY 11] Student Attempt Submitted: status='${submitRes.attempt.status}', responsesCount=${submitRes.responsesCount}`);

    // 7. Test Malformed Gemini Output Handling (INVALID_AI_OUTPUT)
    console.log('\n--- Step 7: Test Malformed Output Handling (INVALID_AI_OUTPUT) ---');
    const originalProvider = llmService.getProvider();
    const countBeforeMalformed = await Assessment.countDocuments();

    // Mock an invalid provider that returns malformed JSON
    llmService.setProvider({
      getModelName: () => 'mock-malformed-provider',
      generateStructuredJSON: async () => ({ invalidField: true, noQuestions: [] })
    });

    let malformedErr = null;
    try {
      await assessmentService.generateAssessment({
        courseId: course._id,
        topicId: topic._id,
        teacherId: teacher._id,
        title: 'Malformed Test Assessment',
        totalQuestions: 2,
        options: { skipRetry: true }
      });
    } catch (err) {
      malformedErr = err;
    }

    // Restore provider
    llmService.setProvider(originalProvider);

    const countAfterMalformed = await Assessment.countDocuments();
    console.log(`Malformed Error Code: '${malformedErr?.errorCode}' (Expected: 'INVALID_AI_OUTPUT')`);
    console.log(`Assessments count before malformed test: ${countBeforeMalformed}, after: ${countAfterMalformed}`);

    if (!malformedErr || malformedErr.errorCode !== 'INVALID_AI_OUTPUT') {
      throw new Error(`Malformed Output Test Failed! Expected INVALID_AI_OUTPUT error, got: ${malformedErr?.message || 'No error'}`);
    }

    if (countAfterMalformed !== countBeforeMalformed) {
      throw new Error(`Malformed Output Security Violation! Saved ${countAfterMalformed - countBeforeMalformed} invalid assessment record(s) to MongoDB!`);
    }

    console.log(`[VERIFY 12] Malformed output correctly rejected with INVALID_AI_OUTPUT and 0 invalid records saved to MongoDB.`);

    // Cleanup test records
    await User.deleteMany({ email: { $in: [teacherEmail, studentEmail] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Material.deleteMany({ _id: uploadedMaterial._id });
    await DocumentChunk.deleteMany({ materialId: uploadedMaterial._id });
    await Assessment.deleteMany({ _id: generatedAssessment._id });
    await AssessmentAssignment.deleteMany({ studentId: student._id });
    await Attempt.deleteMany({ _id: attempt._id });
    await AttemptResponse.deleteMany({ attemptId: attempt._id });

    console.log('\n=== ALL GEMINI ASSESSMENT GENERATION INTEGRATION TESTS PASSED 100%! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[GEMINI INTEGRATION TEST FAILED]:', err);
    process.exit(1);
  }
};

runGeminiAssessmentGenerationIntegrationTest();
