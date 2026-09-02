import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';
import { Material } from './src/models/Material.js';
import { DocumentChunk } from './src/models/DocumentChunk.js';
import { Assessment } from './src/models/Assessment.js';
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
import { learningPathService } from './src/services/learningPath.service.js';

dotenv.config();

const runLearningPathPipelineTest = async () => {
  console.log('=== STARTING AUTOMATIC LEARNING PATH GENERATION PIPELINE INTEGRATION TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_lp_pipe_${Date.now()}@example.com`;
  const studentAEmail = `student_a_lp_pipe_${Date.now()}@example.com`;
  const studentBEmail = `student_b_lp_pipe_${Date.now()}@example.com`;

  try {
    // 1. Register Teacher & Students
    console.log('--- Step 1: Register Teacher & Students ---');
    const teacher = await User.create({ name: 'Teacher LP Pipe', email: teacherEmail, password: 'password123', role: 'teacher' });
    const studentA = await User.create({ name: 'Student A LP Pipe', email: studentAEmail, password: 'password123', role: 'student' });
    const studentB = await User.create({ name: 'Student B LP Pipe', email: studentBEmail, password: 'password123', role: 'student' });

    // 2. Create Course & Topic
    console.log('\n--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `CS_${Date.now().toString().slice(-4)}`,
      title: 'Learning Path Pipeline Test Course',
      description: 'Testing automatic learning path generation',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Polynomial Division Remediation',
      description: 'Topic for testing learning path pipeline',
      order: 1
    });

    // 3. Ingest Material & Create Assessment
    console.log('\n--- Step 3: Ingest Material & Create Assessment ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 140>>stream\nBT /F1 12 Tf 72 712 Td (Synthetic division simplifies dividing a polynomial by a linear binomial (x - c). Use constant c and bring down leading coefficient.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n508\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'lp_test.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'LP Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);

    const assessmentRes = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'LP Pipeline Quiz',
      totalQuestions: 2,
      difficulty: 'medium'
    });

    const assessment = assessmentRes.assessment;

    // 4. Student A starts attempt, saves answers, and submits
    console.log('\n--- Step 4: Student A Submits Assessment ---');
    const startRes = await attemptService.startAttempt({
      assessmentId: assessment._id,
      studentId: studentA._id
    });
    const attempt = startRes.attempt;

    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: assessment.questions[0]._id,
      studentAnswer: 'Use divisor constant c for synthetic division.',
      studentId: studentA._id
    });

    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: assessment.questions[1]._id,
      studentAnswer: 'Remainder equals P(c).',
      studentId: studentA._id
    });

    await attemptService.submitAttempt({
      attemptId: attempt._id,
      studentId: studentA._id
    });

    // 5. Poll for processing completion
    console.log('\n--- Step 5: Await Diagnostic & LearningPath Generation ---');
    let reportDoc = null;
    let pathDoc = null;
    let polls = 0;
    const maxPolls = 30;

    while (polls < maxPolls) {
      await new Promise((res) => setTimeout(res, 500));
      polls++;
      
      reportDoc = await DiagnosticReport.findOne({ attemptId: attempt._id });
      if (reportDoc) {
        pathDoc = await LearningPath.findOne({ diagnosticReportId: reportDoc._id });
      }

      if (reportDoc && pathDoc) {
        console.log(`Pipeline completed after ${polls * 500}ms.`);
        break;
      }
    }

    // Assertion 1: DiagnosticReport exists
    console.log('\n--- Step 6: Assertion 1 — DiagnosticReport Exists ---');
    if (!reportDoc) {
      throw new Error('DiagnosticReport record missing from MongoDB Atlas!');
    }
    console.log(`DiagnosticReport ID: ${reportDoc._id}`);

    // Assertion 2: LearningPath exists
    console.log('\n--- Step 7: Assertion 2 — LearningPath Exists ---');
    if (!pathDoc) {
      throw new Error('LearningPath record missing from MongoDB Atlas after diagnostic creation!');
    }
    console.log(`LearningPath ID: ${pathDoc._id}`);
    console.log(`LearningPath Title: "${pathDoc.title}"`);
    console.log(`LearningPath Nodes Count: ${pathDoc.nodes.length}`);

    // Assertion 3 & 4: Belongs to correct student and references correct diagnostic/topic
    console.log('\n--- Step 8: Assertion 3 & 4 — References & Ownership ---');
    if (pathDoc.studentId.toString() !== studentA._id.toString()) {
      throw new Error(`LearningPath studentId mismatch: Expected ${studentA._id}, got ${pathDoc.studentId}`);
    }
    if (pathDoc.topicId.toString() !== topic._id.toString()) {
      throw new Error(`LearningPath topicId mismatch: Expected ${topic._id}, got ${pathDoc.topicId}`);
    }
    if (pathDoc.diagnosticReportId.toString() !== reportDoc._id.toString()) {
      throw new Error(`LearningPath diagnosticReportId mismatch: Expected ${reportDoc._id}, got ${pathDoc.diagnosticReportId}`);
    }
    console.log('Student ID, Topic ID, and DiagnosticReport ID verified.');

    // Assertion 5: Tenant isolation for Student B
    console.log('\n--- Step 9: Assertion 5 — Student B Tenant Isolation ---');
    let studentBPathErr = null;
    try {
      await learningPathService.getLearningPath({
        diagnosticReportId: reportDoc._id,
        userId: studentB._id,
        userRole: 'student'
      });
    } catch (err) {
      studentBPathErr = err;
    }
    console.log(`Student B Access Error Code: ${studentBPathErr?.errorCode} (Expected: FORBIDDEN)`);
    if (!studentBPathErr || studentBPathErr.statusCode !== 403) {
      throw new Error('Security failure: Student B accessed Student A learning path!');
    }

    // Assertion 6: Duplicate generation idempotency
    console.log('\n--- Step 10: Assertion 6 — Idempotency ---');
    const duplicateRes = await learningPathService.generateLearningPath({
      diagnosticReportId: reportDoc._id,
      userId: studentA._id,
      userRole: 'student'
    });
    const totalPathsInDB = await LearningPath.countDocuments({ diagnosticReportId: reportDoc._id });
    console.log(`LearningPath count in DB for diagnostic: ${totalPathsInDB} (Expected: 1)`);
    if (totalPathsInDB !== 1) {
      throw new Error(`Idempotency failure: Found ${totalPathsInDB} duplicate LearningPath documents!`);
    }
    if (duplicateRes.learningPath._id.toString() !== pathDoc._id.toString()) {
      throw new Error('Idempotency failure: Re-generation created a new ID instead of updating existing document!');
    }

    // Assertion 7 & 8: Student Learning Paths API returns path
    console.log('\n--- Step 11: Assertion 7 & 8 — Student Learning Paths API ---');
    const studentPaths = await learningPathService.getStudentLearningPaths(studentA._id);
    console.log(`Active Learning Paths returned for Student A: ${studentPaths.length} (Expected: 1)`);
    if (studentPaths.length !== 1) {
      throw new Error(`Expected 1 active learning path for Student A, got ${studentPaths.length}`);
    }

    // Cleanup
    await User.deleteMany({ email: { $in: [teacherEmail, studentAEmail, studentBEmail] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Material.deleteMany({ _id: uploadedMaterial._id });
    await DocumentChunk.deleteMany({ materialId: uploadedMaterial._id });
    await Assessment.deleteMany({ _id: assessment._id });
    await Attempt.deleteMany({ _id: attempt._id });
    await AttemptResponse.deleteMany({ attemptId: attempt._id });
    await DiagnosticReport.deleteMany({ attemptId: reportDoc._id });
    await LearningPath.deleteMany({ _id: pathDoc._id });

    console.log('\n=== AUTOMATIC LEARNING PATH PIPELINE TEST PASSED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[LEARNING PATH PIPELINE TEST FAILED]:', err);
    process.exit(1);
  }
};

runLearningPathPipelineTest();
