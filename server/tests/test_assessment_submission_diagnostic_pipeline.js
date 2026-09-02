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
import { courseService } from './src/services/course.service.js';
import { topicService } from './src/services/topic.service.js';
import { materialService } from './src/services/material.service.js';
import { documentIngestionService } from './src/services/documents/documentIngestionService.js';
import { assessmentService } from './src/services/assessment.service.js';
import { attemptService } from './src/services/attempt.service.js';

dotenv.config();

const runDirectBackendTest = async () => {
  console.log('=== STARTING DIRECT BACKEND ASSESSMENT SUBMISSION & DIAGNOSTIC TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_direct_${Date.now()}@example.com`;
  const studentEmail = `student_direct_${Date.now()}@example.com`;

  try {
    // 1. Create teacher & student

    console.log('--- Step 1: Create Teacher & Student ---');
    const teacher = await User.create({ name: 'Teacher Direct', email: teacherEmail, password: 'password123', role: 'teacher' });
    const student = await User.create({ name: 'Student Direct', email: studentEmail, password: 'password123', role: 'student' });
    console.log(`Teacher ID: ${teacher._id}, Student ID: ${student._id}`);

    // 2. Create course & topic
    console.log('\n--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `CS_${Date.now().toString().slice(-4)}`,
      title: 'Direct Backend Pipeline Test Course',
      description: 'Pipeline Testing',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Polynomial Division Theorem',
      description: 'Polynomial division principles and synthetic division',
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
        originalname: 'polynomial_division.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'Polynomial Division Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);

    const assessmentRes = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Polynomial Division Direct Quiz',
      totalQuestions: 2,
      difficulty: 'medium'
    });

    const assessment = assessmentRes.assessment;
    console.log(`Assessment created. ID: ${assessment._id}, Questions: ${assessment.questions.length}`);

    // 4. Create attempt
    console.log('\n--- Step 4: Create Attempt ---');
    const startRes = await attemptService.startAttempt({
      assessmentId: assessment._id,
      studentId: student._id
    });
    const attempt = startRes.attempt;
    console.log(`Attempt created. ID: ${attempt._id}, Initial status: ${attempt.status}`);

    // 5. Submit responses
    console.log('\n--- Step 5: Save Responses ---');
    const q1 = assessment.questions[0];
    const q2 = assessment.questions[1];

    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: q1._id,
      studentAnswer: 'Use constant c from linear factor x - c and setup synthetic division matrix.',
      studentId: student._id
    });

    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: q2._id,
      studentAnswer: 'The remainder equals P(c) according to polynomial remainder theorem.',
      studentId: student._id
    });

    // 6. Submit attempt
    console.log('\n--- Step 6: Submit Attempt ---');
    await attemptService.submitAttempt({
      attemptId: attempt._id,
      studentId: student._id
    });

    // 7. Wait for processing using intended async mechanism
    console.log('\n--- Step 7 & 8: Polling for Evaluation & Diagnostic Completion ---');
    let completedAttempt = null;
    let reportDoc = null;
    let polls = 0;
    const maxPolls = 30;

    while (polls < maxPolls) {
      await new Promise((res) => setTimeout(res, 500));
      polls++;

      completedAttempt = await Attempt.findById(attempt._id);
      reportDoc = await DiagnosticReport.findOne({ attemptId: attempt._id });

      if ((completedAttempt.status === 'completed' || completedAttempt.status === 'evaluated') && reportDoc) {
        console.log(`Pipeline completed after ${polls} poll iterations (${polls * 500}ms).`);
        break;
      }

      if (completedAttempt.status === 'failed') {
        throw new Error(`Pipeline processing marked attempt as failed: ${completedAttempt.processingError}`);
      }
    }

    // 8. Assert evaluation completes
    console.log('\n--- Step 8: Assert Evaluation Completes ---');
    const responsesInDB = await AttemptResponse.find({ attemptId: attempt._id });
    console.log(`Evaluated Responses Count: ${responsesInDB.length}`);
    responsesInDB.forEach((r, idx) => {
      console.log(`Response #${idx + 1} correctness: ${r.evaluation?.correctness}, score: ${r.evaluation?.score}`);
      if (!r.evaluation || !r.evaluation.correctness) {
        throw new Error(`Response #${idx + 1} was not evaluated!`);
      }
    });

    // 9. Assert attempt status is completed
    console.log('\n--- Step 9: Assert Attempt Status is Completed ---');
    console.log(`Final Attempt Status: ${completedAttempt.status}`);
    if (completedAttempt.status !== 'completed' && completedAttempt.status !== 'evaluated') {
      throw new Error(`Expected attempt status 'completed' or 'evaluated', got '${completedAttempt.status}'`);
    }

    // 10. Assert diagnostic report exists in MongoDB
    console.log('\n--- Step 10: Assert Diagnostic Report in MongoDB ---');
    if (!reportDoc) {
      throw new Error('DiagnosticReport record missing from MongoDB Atlas!');
    }
    console.log(`Diagnostic Report ID: ${reportDoc._id}`);
    console.log(`Overall Mastery Score: ${reportDoc.overallMasteryScore}`);
    console.log(`Mastery Level: ${reportDoc.masteryLevel}`);
    console.log(`AI Summary: ${reportDoc.aiSummary}`);

    // Cleanup
    await User.deleteMany({ email: { $in: [teacherEmail, studentEmail] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Material.deleteMany({ _id: uploadedMaterial._id });
    await DocumentChunk.deleteMany({ materialId: uploadedMaterial._id });
    await Assessment.deleteMany({ _id: assessment._id });
    await Attempt.deleteMany({ _id: attempt._id });
    await AttemptResponse.deleteMany({ attemptId: attempt._id });
    await DiagnosticReport.deleteMany({ attemptId: attempt._id });

    console.log('\n=== DIRECT BACKEND TEST PASSED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[DIRECT BACKEND TEST FAILED]:', err);
    process.exit(1);
  }
};

runDirectBackendTest();
