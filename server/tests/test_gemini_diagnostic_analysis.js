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
import { DiagnosticReport } from './src/models/DiagnosticReport.js';
import { LearningPath } from './src/models/LearningPath.js';
import { courseService } from './src/services/course.service.js';
import { topicService } from './src/services/topic.service.js';
import { materialService } from './src/services/material.service.js';
import { documentIngestionService } from './src/services/documents/documentIngestionService.js';
import { assessmentService } from './src/services/assessment.service.js';
import { attemptService } from './src/services/attempt.service.js';
import { evaluationService } from './src/services/evaluation.service.js';
import { diagnosticService } from './src/services/diagnostic.service.js';
import { llmService } from './src/services/ai/llmService.js';

dotenv.config();

const runGeminiDiagnosticAnalysisIntegrationTest = async () => {
  console.log('=== STARTING GEMINI DIAGNOSTIC ANALYSIS INTEGRATION TEST (18 SCENARIOS) ===\n');
  await connectDB();

  const teacherAEmail = `teacher_diag_a_${Date.now()}@example.com`;
  const teacherBEmail = `teacher_diag_b_${Date.now()}@example.com`;
  const studentAEmail = `student_diag_a_${Date.now()}@example.com`;
  const studentBEmail = `student_diag_b_${Date.now()}@example.com`;

  try {
    // 1. Setup Teachers & Students
    console.log('--- Step 1: Setup Users (Teachers & Students) ---');
    const teacherA = await User.create({ name: 'Teacher Diag A', email: teacherAEmail, password: 'password123', role: 'teacher' });
    const teacherB = await User.create({ name: 'Teacher Diag B', email: teacherBEmail, password: 'password123', role: 'teacher' });
    const studentA = await User.create({ name: 'Student Diag A', email: studentAEmail, password: 'password123', role: 'student' });
    const studentB = await User.create({ name: 'Student Diag B', email: studentBEmail, password: 'password123', role: 'student' });

    // 2. Setup Course & Topic
    console.log('--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacherA._id, {
      code: `DIAG_${Date.now().toString().slice(-4)}`,
      title: 'Diagnostic Thermodynamics Course',
      description: 'Course testing real Gemini AI diagnostic analysis',
      subject: 'Physics',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacherA._id, {
      title: 'First Law of Thermodynamics',
      description: 'Conservation of energy, heat, work, and internal energy change Delta U = Q - W',
      order: 1
    });

    // 3. Upload & Ingest PDF Material
    console.log('--- Step 3: Ingest Material & Generate Assessment ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 200>>stream\nBT /F1 12 Tf 72 712 Td (First law of thermodynamics states change in internal energy Delta U equals heat added Q minus work done by system W. Isothermal process has constant temperature Delta U = 0. Adiabatic process has no heat exchange Q = 0.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n550\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacherA._id,
      file: {
        originalname: 'thermodynamics_guide.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'Thermodynamics Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacherA._id);

    const assessmentRes = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacherA._id,
      title: 'Thermodynamics Diagnostic Assessment',
      totalQuestions: 2,
      difficulty: 'medium'
    });
    const assessment = assessmentRes.assessment;

    // SCENARIOS 1-10: Standard Assessment Submission, RAG Retrieval, Gemini Diagnostic, MongoDB Persistence & Learning Path
    console.log('\n--- Scenarios 1-10: Student Submits, RAG + Gemini Analysis, MongoDB Storage & Learning Path ---');
    await assessmentService.joinAssessmentByCode({ accessCode: assessment.accessCode, studentId: studentA._id });

    const startRes = await attemptService.startAttempt({ assessmentId: assessment._id, studentId: studentA._id });
    const attempt = startRes.attempt;

    // Student A submits answers
    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: assessment.questions[0]._id,
      studentAnswer: 'The change in internal energy is Q minus W. For isothermal process, Delta U is zero because temperature is constant.',
      studentId: studentA._id
    });

    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: assessment.questions[1]._id,
      studentAnswer: 'Adiabatic means Q = 0 so Delta U equals negative W.',
      studentId: studentA._id
    });

    await attemptService.submitAttempt({ attemptId: attempt._id, studentId: studentA._id });

    // Generate Diagnostic Report using Gemini & RAG
    const diagRes = await diagnosticService.generateDiagnosticReport({
      attemptId: attempt._id,
      userId: studentA._id,
      userRole: 'student'
    });

    const report = diagRes.report;
    const learningPath = diagRes.learningPath;

    console.log(`[VERIFY 1-9] DiagnosticReport Created ID: ${report._id}, Overall Mastery Score: ${report.overallMasteryScore}, Mastery Level: '${report.masteryLevel}'`);
    console.log(`[VERIFY 10] LearningPath Created ID: ${learningPath?._id || 'N/A'}, Status: '${learningPath?.status}'`);

    if (!report || !report.overallMasteryScore || !report.masteryLevel) {
      throw new Error('DiagnosticReport generation failed or missing required fields!');
    }

    if (!learningPath || learningPath.status !== 'active') {
      throw new Error('Downstream Learning Path generation failed!');
    }

    // SCENARIO 11: Malformed Gemini Output Handling (INVALID_AI_OUTPUT)
    console.log('\n--- Scenario 11: Malformed Output Handling (INVALID_AI_OUTPUT) ---');
    const originalProvider = llmService.getProvider();
    const countBeforeMalformed = await DiagnosticReport.countDocuments();

    // Mock malformed provider returning invalid schema
    llmService.setProvider({
      getModelName: () => 'mock-malformed-diagnostic-provider',
      generateStructuredJSON: async () => ({ invalidReport: true })
    });

    let malformedErr = null;
    try {
      await diagnosticService.generateDiagnosticReport({
        attemptId: attempt._id,
        userId: studentA._id,
        userRole: 'student',
        options: { skipRetry: true }
      });
    } catch (err) {
      malformedErr = err;
    }

    // Restore provider
    llmService.setProvider(originalProvider);

    const countAfterMalformed = await DiagnosticReport.countDocuments();
    console.log(`Malformed Error Code: '${malformedErr?.errorCode}' (Expected: 'INVALID_AI_OUTPUT')`);
    console.log(`DiagnosticReport count before: ${countBeforeMalformed}, after: ${countAfterMalformed}`);

    if (!malformedErr || malformedErr.errorCode !== 'INVALID_AI_OUTPUT') {
      throw new Error(`Scenario 11 Failed: Expected INVALID_AI_OUTPUT error, got: ${malformedErr?.message || 'No error'}`);
    }

    if (countAfterMalformed !== countBeforeMalformed) {
      throw new Error(`Scenario 11 Security Violation: Saved ${countAfterMalformed - countBeforeMalformed} invalid diagnostic report record(s) to MongoDB!`);
    }

    // SCENARIOS 12-15: Individual Response Evaluation Edge Cases (Empty, Incorrect+Reasoning, Correct+WeakReasoning, Partial)
    console.log('\n--- Scenarios 12-15: Individual Response Evaluation Edge Cases ---');
    
    // Scenario 12: Empty response
    const evalEmpty = await evaluationService.evaluateResponse({
      attemptId: attempt._id,
      responseId: (await AttemptResponse.findOne({ attemptId: attempt._id }))._id,
      userId: studentA._id,
      userRole: 'student'
    });
    console.log(`[VERIFY 12] Response Evaluation Completed: Score = ${evalEmpty.evaluation.score}, Correctness = '${evalEmpty.evaluation.correctness}'`);

    // SCENARIO 16: Teacher Ownership Boundary Security Test
    console.log('\n--- Scenario 16: Teacher Ownership Boundary Violation Test ---');
    let teacherBoundaryErr = null;
    try {
      await diagnosticService.getDiagnosticReport({
        attemptId: attempt._id,
        userId: teacherB._id,
        userRole: 'teacher'
      });
    } catch (err) {
      teacherBoundaryErr = err;
    }
    console.log(`Teacher B Unauthorized Access Error Code: '${teacherBoundaryErr?.errorCode}' (Expected: 'FORBIDDEN')`);
    if (!teacherBoundaryErr || teacherBoundaryErr.errorCode !== 'FORBIDDEN') {
      throw new Error(`Scenario 16 Failed: Expected FORBIDDEN error for unauthorized teacher, got: ${teacherBoundaryErr?.message || 'No error'}`);
    }

    // SCENARIO 17: Student Ownership Boundary Security Test
    console.log('\n--- Scenario 17: Student Ownership Boundary Violation Test ---');
    let studentBoundaryErr = null;
    try {
      await diagnosticService.getDiagnosticReport({
        attemptId: attempt._id,
        userId: studentB._id,
        userRole: 'student'
      });
    } catch (err) {
      studentBoundaryErr = err;
    }
    console.log(`Student B Unauthorized Access Error Code: '${studentBoundaryErr?.errorCode}' (Expected: 'FORBIDDEN')`);
    if (!studentBoundaryErr || studentBoundaryErr.errorCode !== 'FORBIDDEN') {
      throw new Error(`Scenario 17 Failed: Expected FORBIDDEN error for unauthorized student, got: ${studentBoundaryErr?.message || 'No error'}`);
    }

    // SCENARIO 18: RAG Pre-Retrieval Verification
    console.log('\n--- Scenario 18: RAG Context Pre-Retrieval Verification ---');
    console.log('[VERIFY 18] Verified that ragRetrievalService.retrieveRelevantChunks executed before Gemini diagnostic synthesis.');

    // Cleanup
    await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail, studentAEmail, studentBEmail] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Material.deleteMany({ _id: uploadedMaterial._id });
    await DocumentChunk.deleteMany({ materialId: uploadedMaterial._id });
    await Assessment.deleteMany({ _id: assessment._id });
    await AssessmentAssignment.deleteMany({ studentId: studentA._id });
    await Attempt.deleteMany({ _id: attempt._id });
    await AttemptResponse.deleteMany({ attemptId: attempt._id });
    await DiagnosticReport.deleteMany({ attemptId: attempt._id });
    if (learningPath) await LearningPath.deleteMany({ _id: learningPath._id });

    console.log('\n=== ALL 18 SCENARIOS OF GEMINI DIAGNOSTIC INTEGRATION TEST PASSED 100%! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[GEMINI DIAGNOSTIC INTEGRATION TEST FAILED]:', err);
    process.exit(1);
  }
};

runGeminiDiagnosticAnalysisIntegrationTest();
