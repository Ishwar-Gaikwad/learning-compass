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
import { reassessmentService } from './src/services/reassessment.service.js';

dotenv.config();

const runAccessCodeFlowTest = async () => {
  console.log('=== STARTING ASSESSMENT ACCESS CODE & ASSIGNMENT INTEGRATION TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_ac_${Date.now()}@example.com`;
  const student1Email = `student1_ac_${Date.now()}@example.com`;
  const student2Email = `student2_ac_${Date.now()}@example.com`;

  try {
    // 1. Create Teacher & Students
    console.log('--- Step 1: Register Teacher & 2 Students ---');
    const teacher = await User.create({ name: 'Teacher AC', email: teacherEmail, password: 'password123', role: 'teacher' });
    const student1 = await User.create({ name: 'Student AC 1', email: student1Email, password: 'password123', role: 'student' });
    const student2 = await User.create({ name: 'Student AC 2', email: student2Email, password: 'password123', role: 'student' });

    // 2. Create Course & Topic
    console.log('\n--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `AC_${Date.now().toString().slice(-4)}`,
      title: 'Access Code Test Course',
      description: 'Testing access code architecture',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Polynomial Access Code Topic',
      description: 'Topic for access code testing',
      order: 1
    });

    // 3. Ingest Material
    console.log('\n--- Step 3: Ingest Material ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 140>>stream\nBT /F1 12 Tf 72 712 Td (Synthetic division simplifies dividing a polynomial by a linear binomial (x - c). Use constant c and bring down leading coefficient.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n508\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'ac_test.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'AC Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);

    // 4. Generate 2 Assessments & Verify Access Codes
    console.log('\n--- Step 4: Teacher Generates 2 Assessments ---');
    const ass1Res = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Assessment 1 (AC)',
      totalQuestions: 2
    });

    const ass2Res = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Assessment 2 (AC)',
      totalQuestions: 2
    });

    const assessment1 = ass1Res.assessment;
    const assessment2 = ass2Res.assessment;

    console.log(`Assessment 1 ID: ${assessment1._id}, Code: ${ass1Res.accessCode}`);
    console.log(`Assessment 2 ID: ${assessment2._id}, Code: ${ass2Res.accessCode}`);

    // ASSERT: Unique uppercase access codes
    if (!ass1Res.accessCode || !ass2Res.accessCode || !ass1Res.accessCode.startsWith('LC-') || !ass2Res.accessCode.startsWith('LC-')) {
      throw new Error('TEST FAILED: Access code format invalid (must start with LC-)');
    }
    if (ass1Res.accessCode === ass2Res.accessCode) {
      throw new Error('TEST FAILED: Access codes must be unique across assessments!');
    }
    console.log('[ASSERT PASS] Unique access codes generated.');

    // 5. Verify Student Cannot See Assessments Before Joining
    console.log('\n--- Step 5: Verify Student Cannot See Assessment Before Joining ---');
    const preJoinList1 = await assessmentService.getAvailableStudentAssessments(student1._id);
    const preJoinList2 = await assessmentService.getAvailableStudentAssessments(student2._id);
    console.log(`Student 1 pre-join available count: ${preJoinList1.length} (Expected: 0)`);
    console.log(`Student 2 pre-join available count: ${preJoinList2.length} (Expected: 0)`);
    if (preJoinList1.length !== 0 || preJoinList2.length !== 0) {
      throw new Error('TEST FAILED: Students should NOT see unjoined assessments!');
    }
    console.log('[ASSERT PASS] Unjoined assessments hidden from students.');

    // 6. Verify Unassigned Attempt Blocked
    console.log('\n--- Step 6: Verify Attempting Unjoined Assessment Fails ---');
    let unassignedErr = null;
    try {
      await attemptService.startAttempt({ assessmentId: assessment1._id, studentId: student1._id });
    } catch (err) {
      unassignedErr = err;
    }
    console.log(`Unjoined startAttempt Error Code: ${unassignedErr?.errorCode} (Expected: NOT_ASSIGNED)`);
    if (!unassignedErr || unassignedErr.errorCode !== 'NOT_ASSIGNED') {
      throw new Error('TEST FAILED: Student was able to attempt unjoined assessment!');
    }
    console.log('[ASSERT PASS] Unassigned attempt rejected with HTTP 403 / NOT_ASSIGNED.');

    // 7. Verify Invalid Code Handling
    console.log('\n--- Step 7: Verify Invalid Code Handling ---');
    let invalidCodeErr = null;
    try {
      await assessmentService.joinAssessmentByCode({ accessCode: 'LC-INVALID999', studentId: student1._id });
    } catch (err) {
      invalidCodeErr = err;
    }
    console.log(`Invalid Code Error Code: ${invalidCodeErr?.errorCode} (Expected: INVALID_ACCESS_CODE)`);
    if (!invalidCodeErr || invalidCodeErr.errorCode !== 'INVALID_ACCESS_CODE') {
      throw new Error('TEST FAILED: Invalid access code was accepted!');
    }
    console.log('[ASSERT PASS] Invalid access code rejected with HTTP 404 / INVALID_ACCESS_CODE.');

    // 8. Student 1 Joins Assessment 1
    console.log('\n--- Step 8: Student 1 Joins Assessment 1 ---');
    const joinRes1 = await assessmentService.joinAssessmentByCode({ accessCode: ass1Res.accessCode, studentId: student1._id });
    console.log(`Join Message: '${joinRes1.message}', isExisting: ${joinRes1.isExisting}`);

    // Verify AssessmentAssignment record
    const assignmentDoc1 = await AssessmentAssignment.findOne({ studentId: student1._id, assessmentId: assessment1._id });
    if (!assignmentDoc1 || assignmentDoc1.status !== 'assigned') {
      throw new Error('TEST FAILED: AssessmentAssignment record not created with status assigned!');
    }
    console.log('[ASSERT PASS] AssessmentAssignment created.');

    // 9. Duplicate Join (Idempotency)
    console.log('\n--- Step 9: Verify Duplicate Join (Idempotent) ---');
    const joinRes1Dup = await assessmentService.joinAssessmentByCode({ accessCode: ass1Res.accessCode, studentId: student1._id });
    console.log(`Duplicate Join isExisting: ${joinRes1Dup.isExisting} (Expected: true)`);
    const totalAssignmentsS1 = await AssessmentAssignment.countDocuments({ studentId: student1._id, assessmentId: assessment1._id });
    if (totalAssignmentsS1 !== 1 || !joinRes1Dup.isExisting) {
      throw new Error('TEST FAILED: Duplicate join created duplicate assignment document!');
    }
    console.log('[ASSERT PASS] Duplicate join is idempotent.');

    // 10. Verify Student 1 Now Sees Assessment 1 ONLY
    console.log('\n--- Step 10: Verify Student 1 Sees Joined Assessment Only ---');
    const postJoinList1 = await assessmentService.getAvailableStudentAssessments(student1._id);
    console.log(`Student 1 post-join available count: ${postJoinList1.length} (Expected: 1)`);
    if (postJoinList1.length !== 1 || postJoinList1[0]._id.toString() !== assessment1._id.toString()) {
      throw new Error('TEST FAILED: Student 1 does not see expected joined assessment!');
    }
    console.log('[ASSERT PASS] Joined assessment visible to Student 1.');

    // 11. Student 1 Starts and Submits Assessment 1
    console.log('\n--- Step 11: Student 1 Starts & Submits Joined Assessment ---');
    const startRes = await attemptService.startAttempt({ assessmentId: assessment1._id, studentId: student1._id });
    const attempt1 = startRes.attempt;

    await attemptService.saveResponse({ attemptId: attempt1._id, questionId: assessment1.questions[0]._id, studentAnswer: 'Answer 1', studentId: student1._id });
    await attemptService.saveResponse({ attemptId: attempt1._id, questionId: assessment1.questions[1]._id, studentAnswer: 'Answer 2', studentId: student1._id });
    await attemptService.submitAttempt({ attemptId: attempt1._id, studentId: student1._id });

    // Verify assignment status updated to submitted
    const updatedAssignmentDoc = await AssessmentAssignment.findOne({ studentId: student1._id, assessmentId: assessment1._id });
    console.log(`Post-Submit Assignment Status: '${updatedAssignmentDoc.status}' (Expected: 'submitted')`);
    if (updatedAssignmentDoc.status !== 'submitted') {
      throw new Error('TEST FAILED: AssessmentAssignment status not updated to submitted!');
    }

    // 12. Verify Background Diagnostic & Learning Path Pipeline
    console.log('\n--- Step 12: Verify Background Diagnostic & Learning Path Pipeline ---');
    let diagDoc = null;
    let pathDoc = null;
    let polls = 0;
    while (polls < 30) {
      await new Promise((res) => setTimeout(res, 500));
      polls++;
      diagDoc = await DiagnosticReport.findOne({ attemptId: attempt1._id });
      if (diagDoc) {
        pathDoc = await LearningPath.findOne({ diagnosticReportId: diagDoc._id });
      }
      if (diagDoc && pathDoc) break;
    }

    if (!diagDoc) throw new Error('TEST FAILED: DiagnosticReport not generated!');
    if (!pathDoc) throw new Error('TEST FAILED: LearningPath not generated!');
    console.log(`[ASSERT PASS] Diagnostic Report ${diagDoc._id} and Learning Path ${pathDoc._id} generated.`);

    // 13. Verify Targeted Reassessment Flow
    console.log('\n--- Step 13: Verify Targeted Reassessment Auto-Assignment ---');
    const reassessRes = await reassessmentService.generateReassessment({ diagnosticReportId: diagDoc._id, userId: student1._id, userRole: 'student' });
    const reassessmentObj = reassessRes.reassessment;

    const startReassessRes = await attemptService.startAttempt({ assessmentId: reassessmentObj._id, studentId: student1._id });
    console.log(`Reassessment Attempt Created ID: ${startReassessRes.attempt._id}`);
    console.log('[ASSERT PASS] Targeted reassessment auto-assignment and attempt start succeeded.');

    // Cleanup
    await User.deleteMany({ email: { $in: [teacherEmail, student1Email, student2Email] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Material.deleteMany({ _id: uploadedMaterial._id });
    await DocumentChunk.deleteMany({ materialId: uploadedMaterial._id });
    await Assessment.deleteMany({ topicId: topic._id });
    await AssessmentAssignment.deleteMany({ assessmentId: { $in: [assessment1._id, assessment2._id, reassessmentObj._id] } });
    await Attempt.deleteMany({ _id: { $in: [attempt1._id, startReassessRes.attempt._id] } });
    await AttemptResponse.deleteMany({ attemptId: { $in: [attempt1._id, startReassessRes.attempt._id] } });
    await DiagnosticReport.deleteMany({ topicId: topic._id });
    await LearningPath.deleteMany({ _id: pathDoc._id });

    console.log('\n=== ASSESSMENT ACCESS CODE INTEGRATION TEST PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[ACCESS CODE INTEGRATION TEST FAILED]:', err);
    process.exit(1);
  }
};

runAccessCodeFlowTest();
