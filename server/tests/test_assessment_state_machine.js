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

dotenv.config();

const runAssessmentStateMachineTest = async () => {
  console.log('=== STARTING ASSESSMENT STATE MACHINE INTEGRATION TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_sm_${Date.now()}@example.com`;
  const studentAEmail = `student_a_sm_${Date.now()}@example.com`;
  const studentBEmail = `student_b_sm_${Date.now()}@example.com`;

  try {
    // 1. Create Teacher & Students
    console.log('--- Step 1: Register Teacher & Students ---');
    const teacher = await User.create({ name: 'Teacher SM', email: teacherEmail, password: 'password123', role: 'teacher' });
    const studentA = await User.create({ name: 'Student A SM', email: studentAEmail, password: 'password123', role: 'student' });
    const studentB = await User.create({ name: 'Student B SM', email: studentBEmail, password: 'password123', role: 'student' });

    // 2. Create Course & Topic
    console.log('\n--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `CS_${Date.now().toString().slice(-4)}`,
      title: 'State Machine Test Course',
      description: 'Testing assessment state machine transitions',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'State Machine Topic 1',
      description: 'Topic for testing state machine',
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
        originalname: 'sm_test.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'SM Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);

    const assessmentRes = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'State Machine Quiz',
      totalQuestions: 2,
      difficulty: 'medium'
    });

    const assessment = assessmentRes.assessment;

    // 4. Test partially completed attempt shows 'in_progress' (resumable)
    console.log('\n--- Step 4: Test Partially Completed Attempt is Resumable ---');
    await assessmentService.joinAssessmentByCode({ accessCode: assessment.accessCode, studentId: studentA._id });
    const startRes1 = await attemptService.startAttempt({
      assessmentId: assessment._id,
      studentId: studentA._id
    });
    const attempt = startRes1.attempt;
    console.log(`Initial Attempt Created ID: ${attempt._id}, status: ${attempt.status}`);

    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: assessment.questions[0]._id,
      studentAnswer: 'Partial answer for Q1',
      studentId: studentA._id
    });

    let listBeforeSubmit = await assessmentService.getAvailableStudentAssessments(studentA._id);
    console.log(`Assessment List Status before submit: '${listBeforeSubmit[0].userAttemptStatus}' (Expected: 'in_progress')`);
    if (listBeforeSubmit[0].userAttemptStatus !== 'in_progress') {
      throw new Error(`Expected 'in_progress' status before submit, got '${listBeforeSubmit[0].userAttemptStatus}'`);
    }

    // Save Q2 answer
    await attemptService.saveResponse({
      attemptId: attempt._id,
      questionId: assessment.questions[1]._id,
      studentAnswer: 'Answer for Q2',
      studentId: studentA._id
    });

    // 5. Submit Attempt
    console.log('\n--- Step 5: Student A Submits Attempt ---');
    const submitRes = await attemptService.submitAttempt({
      attemptId: attempt._id,
      studentId: studentA._id
    });
    console.log(`Submission Response Attempt Status: '${submitRes.attempt.status}' (Expected: 'submitted')`);
    if (submitRes.attempt.status !== 'submitted') {
      throw new Error(`Expected submitAttempt status 'submitted', got '${submitRes.attempt.status}'`);
    }

    // 6. Verify Attempt State immediately after submission
    console.log('\n--- Step 6: Verify Attempt State Immediately after Submission ---');
    const attemptInDb = await Attempt.findById(attempt._id);
    console.log(`DB Attempt Status: '${attemptInDb.status}'`);
    console.log(`submittedAt Timestamp Exists: ${Boolean(attemptInDb.submittedAt)}`);
    if (!attemptInDb.submittedAt) {
      throw new Error('submittedAt timestamp missing on submitted attempt!');
    }

    // 7. Verify Assessment list marks it as submitted/evaluated (NOT resumable 'in_progress')
    console.log('\n--- Step 7: Verify Assessment List Status Post-Submit ---');
    let listPostSubmit = await assessmentService.getAvailableStudentAssessments(studentA._id);
    const postSubmitStatus = listPostSubmit[0].userAttemptStatus;
    console.log(`Assessment List Status post-submit: '${postSubmitStatus}' (Expected: 'submitted' or 'evaluated')`);
    if (postSubmitStatus === 'in_progress' || postSubmitStatus === 'not_started') {
      throw new Error(`State Machine Failure: Post-submit assessment list status is '${postSubmitStatus}', expected submitted or evaluated!`);
    }

    // 8. Verify Progress reports Completed Assessments = 1
    console.log('\n--- Step 8: Verify Progress Report Count Post-Submit ---');
    const completedCount = listPostSubmit.filter((a) => a.userAttemptStatus === 'submitted' || a.userAttemptStatus === 'evaluated').length;
    console.log(`Completed Assessments Count: ${completedCount} (Expected: 1)`);
    if (completedCount !== 1) {
      throw new Error(`Expected Completed Assessments = 1, got ${completedCount}`);
    }

    // 9. Verify re-calling startAttempt returns existing attempt (does NOT create duplicate in_progress attempt)
    console.log('\n--- Step 9: Verify startAttempt does NOT create duplicate attempt ---');
    const reStartRes = await attemptService.startAttempt({
      assessmentId: assessment._id,
      studentId: studentA._id
    });
    console.log(`reStartRes isExisting: ${reStartRes.isExisting} (Expected: true)`);
    console.log(`reStartRes Attempt ID: ${reStartRes.attempt._id} (Expected: ${attempt._id})`);
    if (!reStartRes.isExisting || reStartRes.attempt._id.toString() !== attempt._id.toString()) {
      throw new Error('Duplicate Attempt Failure: startAttempt created a new attempt for a submitted assessment!');
    }

    const totalAttemptsInDb = await Attempt.countDocuments({ assessmentId: assessment._id, studentId: studentA._id });
    console.log(`Total Attempts in DB for Student A: ${totalAttemptsInDb} (Expected: 1)`);
    if (totalAttemptsInDb !== 1) {
      throw new Error(`Expected 1 total attempt in DB, found ${totalAttemptsInDb}!`);
    }

    // 10. Verify second submission of the SAME attempt is REJECTED
    console.log('\n--- Step 10: Verify Second Submission Attempt is REJECTED ---');
    let secondSubmitErr = null;
    try {
      await attemptService.submitAttempt({
        attemptId: attempt._id,
        studentId: studentA._id
      });
    } catch (err) {
      secondSubmitErr = err;
    }
    console.log(`Second Submit Error Status: ${secondSubmitErr?.statusCode} (Expected: 400)`);
    console.log(`Second Submit Error Code: ${secondSubmitErr?.errorCode} (Expected: ATTEMPT_ALREADY_SUBMITTED)`);
    if (!secondSubmitErr || secondSubmitErr.statusCode !== 400 || secondSubmitErr.errorCode !== 'ATTEMPT_ALREADY_SUBMITTED') {
      throw new Error('Security Failure: Second submission of submitted attempt was not rejected!');
    }

    // 11. Verify locked responses remain unchanged
    console.log('\n--- Step 11: Verify Response Modification Rejected ---');
    let modifyErr = null;
    try {
      await attemptService.saveResponse({
        attemptId: attempt._id,
        questionId: assessment.questions[0]._id,
        studentAnswer: 'Attempted edit after submission',
        studentId: studentA._id
      });
    } catch (err) {
      modifyErr = err;
    }
    console.log(`Modify Locked Response Error Status: ${modifyErr?.statusCode} (Expected: 400)`);
    if (!modifyErr || modifyErr.statusCode !== 400) {
      throw new Error('Security Failure: Responses allowed to be modified on submitted attempt!');
    }

    // 12. Await evaluation, diagnostic, and learning path pipeline completion
    console.log('\n--- Step 12: Await Background Evaluation, Diagnostic & LearningPath ---');
    let polls = 0;
    const maxPolls = 30;
    let reportDoc = null;
    let pathDoc = null;
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

    if (!reportDoc) throw new Error('DiagnosticReport not generated!');
    if (!pathDoc) throw new Error('LearningPath not generated!');

    console.log(`Diagnostic Report ID: ${reportDoc._id}`);
    console.log(`Learning Path ID: ${pathDoc._id}`);

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

    console.log('\n=== ASSESSMENT STATE MACHINE INTEGRATION TEST PASSED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[ASSESSMENT STATE MACHINE TEST FAILED]:', err);
    process.exit(1);
  }
};

runAssessmentStateMachineTest();
