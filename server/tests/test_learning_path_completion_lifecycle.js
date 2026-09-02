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
import { DiagnosticComparison } from './src/models/DiagnosticComparison.js';
import { courseService } from './src/services/course.service.js';
import { topicService } from './src/services/topic.service.js';
import { materialService } from './src/services/material.service.js';
import { documentIngestionService } from './src/services/documents/documentIngestionService.js';
import { assessmentService } from './src/services/assessment.service.js';
import { attemptService } from './src/services/attempt.service.js';
import { learningPathService } from './src/services/learningPath.service.js';
import { reassessmentService } from './src/services/reassessment.service.js';

dotenv.config();

const runLearningPathCompletionLifecycleTest = async () => {
  console.log('=== STARTING LEARNING PATH COMPLETION LIFECYCLE INTEGRATION TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_lifecycle_${Date.now()}@example.com`;
  const studentEmail = `student_lifecycle_${Date.now()}@example.com`;

  try {
    // 1. Create Teacher & Student
    console.log('--- Step 1: Register Teacher & Student ---');
    const teacher = await User.create({ name: 'Teacher Lifecycle', email: teacherEmail, password: 'password123', role: 'teacher' });
    const student = await User.create({ name: 'Student Lifecycle', email: studentEmail, password: 'password123', role: 'student' });

    // 2. Create Course & Topic
    console.log('\n--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `LIFE_${Date.now().toString().slice(-4)}`,
      title: 'Lifecycle Test Course',
      description: 'Testing complete learning path completion lifecycle',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Polynomial Division Lifecycle Topic',
      description: 'Topic for lifecycle completion testing',
      order: 1
    });

    // 3. Ingest Material & Create Initial Assessment
    console.log('\n--- Step 3: Ingest Material & Create Initial Assessment ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 140>>stream\nBT /F1 12 Tf 72 712 Td (Synthetic division simplifies dividing a polynomial by a linear binomial (x - c). Use constant c and bring down leading coefficient.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n508\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'lifecycle_test.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'Lifecycle Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);

    const initialAssessmentRes = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Initial Diagnostic Quiz',
      totalQuestions: 2,
      difficulty: 'medium'
    });
    const initialAssessment = initialAssessmentRes.assessment;

    // 4. Student Joins & Submits Initial Assessment
    console.log('\n--- Step 4: Student Joins & Submits Initial Assessment ---');
    await assessmentService.joinAssessmentByCode({ accessCode: initialAssessment.accessCode, studentId: student._id });
    const startRes = await attemptService.startAttempt({ assessmentId: initialAssessment._id, studentId: student._id });
    const attempt1 = startRes.attempt;

    await attemptService.saveResponse({ attemptId: attempt1._id, questionId: initialAssessment.questions[0]._id, studentAnswer: 'Partial synthetic division constant.', studentId: student._id });
    await attemptService.saveResponse({ attemptId: attempt1._id, questionId: initialAssessment.questions[1]._id, studentAnswer: 'P(c) remainder answer.', studentId: student._id });
    await attemptService.submitAttempt({ attemptId: attempt1._id, studentId: student._id });

    // Await Diagnostic & Initial Learning Path
    let initialDiag = null;
    let initialPath = null;
    let polls = 0;
    while (polls < 30) {
      await new Promise((res) => setTimeout(res, 500));
      polls++;
      initialDiag = await DiagnosticReport.findOne({ attemptId: attempt1._id });
      if (initialDiag) {
        initialPath = await LearningPath.findOne({ diagnosticReportId: initialDiag._id });
      }
      if (initialDiag && initialPath) break;
    }

    if (!initialDiag || !initialPath) throw new Error('Initial diagnostic/learning path generation failed!');
    console.log(`[ASSERT] Initial Learning Path status: '${initialPath.status}' (Expected: 'active')`);
    if (initialPath.status !== 'active') {
      throw new Error(`Expected initial LearningPath status to be 'active', got '${initialPath.status}'`);
    }

    // 5. Verify Active Learning Paths Before Reassessment = 1
    console.log('\n--- Step 5: Check Active Learning Paths Count Before Reassessment ---');
    let studentPaths = await learningPathService.getStudentLearningPaths(student._id);
    let activeCountBefore = studentPaths.filter((p) => p.status === 'active').length;
    console.log(`Active Learning Paths Before Reassessment = ${activeCountBefore} (Expected: 1)`);
    if (activeCountBefore !== 1) {
      throw new Error(`Expected Active Learning Paths before reassessment = 1, got ${activeCountBefore}`);
    }

    // 6. Complete All Activities
    console.log('\n--- Step 6: Complete All Learning Path Activities ---');
    for (const node of initialPath.nodes) {
      await learningPathService.completeLearningNode({ pathId: initialPath._id, nodeId: node.nodeId || node._id, userId: student._id });
    }

    // 7. Generate Targeted Reassessment
    console.log('\n--- Step 7: Generate Targeted Reassessment ---');
    const reassessRes = await reassessmentService.generateReassessment({ diagnosticReportId: initialDiag._id, userId: student._id, userRole: 'student' });
    const reassessmentObj = reassessRes.reassessment;

    // 8. Submit Reassessment & Process
    console.log('\n--- Step 8: Submit Targeted Reassessment & Generate Final Diagnostic Report ---');
    const startReassessRes = await attemptService.startAttempt({ assessmentId: reassessmentObj._id, studentId: student._id });
    const reassessAttempt = startReassessRes.attempt;

    await attemptService.saveResponse({ attemptId: reassessAttempt._id, questionId: reassessmentObj.questions[0]._id, studentAnswer: 'Complete synthetic division explanation.', studentId: student._id });
    await attemptService.saveResponse({ attemptId: reassessAttempt._id, questionId: reassessmentObj.questions[1]._id, studentAnswer: 'Full proof of remainder theorem P(c).', studentId: student._id });
    await attemptService.submitAttempt({ attemptId: reassessAttempt._id, studentId: student._id });

    const procResult = await reassessmentService.processReassessmentSubmission({
      reassessmentAttemptId: reassessAttempt._id,
      userId: student._id,
      userRole: 'student'
    });

    console.log(`Reassessment Processed. New Diagnostic ID: ${procResult.newDiagnosticReport._id}`);

    // 9. Assert LearningPath status in MongoDB = 'completed'
    console.log('\n--- Step 9: Verify LearningPath Database Record ---');
    const updatedPathDoc = await LearningPath.findById(initialPath._id);
    console.log(`Post-Reassessment DB LearningPath status: '${updatedPathDoc.status}' (Expected: 'completed')`);
    console.log(`Post-Reassessment DB overallProgressPercentage: ${updatedPathDoc.overallProgressPercentage}% (Expected: 100)`);

    if (updatedPathDoc.status !== 'completed') {
      throw new Error(`Expected LearningPath status in DB to be 'completed', got '${updatedPathDoc.status}'`);
    }
    if (updatedPathDoc.overallProgressPercentage !== 100) {
      throw new Error(`Expected overallProgressPercentage in DB to be 100, got ${updatedPathDoc.overallProgressPercentage}`);
    }

    // 10. Verify Active Learning Paths After Reassessment = 0
    console.log('\n--- Step 10: Check Active Learning Paths Count After Reassessment ---');
    studentPaths = await learningPathService.getStudentLearningPaths(student._id);
    let activeCountAfter = studentPaths.filter((p) => p.status === 'active').length;
    let totalPathsCount = studentPaths.length;
    console.log(`Student Total Learning Paths = ${totalPathsCount} (Remains in history)`);
    console.log(`Active Learning Paths After Reassessment = ${activeCountAfter} (Expected: 0)`);

    if (activeCountAfter !== 0) {
      throw new Error(`Expected Active Learning Paths after reassessment = 0, got ${activeCountAfter}`);
    }
    if (totalPathsCount !== 1) {
      throw new Error(`Expected Total Learning Paths = 1 (visible in history), got ${totalPathsCount}`);
    }

    // 11. Idempotency Check: Second processing call maintains completed status
    console.log('\n--- Step 11: Idempotency Check for Reassessment Processing ---');
    const procResult2 = await reassessmentService.processReassessmentSubmission({
      reassessmentAttemptId: reassessAttempt._id,
      userId: student._id,
      userRole: 'student'
    });

    const recheckedPathDoc = await LearningPath.findById(initialPath._id);
    console.log(`Idempotent DB LearningPath status: '${recheckedPathDoc.status}' (Expected: 'completed')`);
    if (recheckedPathDoc.status !== 'completed') {
      throw new Error(`Idempotency check failed: LearningPath status corrupted to '${recheckedPathDoc.status}'`);
    }

    // Cleanup
    await User.deleteMany({ email: { $in: [teacherEmail, studentEmail] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Material.deleteMany({ _id: uploadedMaterial._id });
    await DocumentChunk.deleteMany({ materialId: uploadedMaterial._id });
    await Assessment.deleteMany({ topicId: topic._id });
    await AssessmentAssignment.deleteMany({ studentId: student._id });
    await Attempt.deleteMany({ _id: { $in: [attempt1._id, reassessAttempt._id] } });
    await AttemptResponse.deleteMany({ attemptId: { $in: [attempt1._id, reassessAttempt._id] } });
    await DiagnosticReport.deleteMany({ topicId: topic._id });
    await LearningPath.deleteMany({ _id: initialPath._id });
    await DiagnosticComparison.deleteMany({ topicId: topic._id });

    console.log('\n=== LEARNING PATH COMPLETION LIFECYCLE INTEGRATION TEST PASSED 100%! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[LEARNING PATH COMPLETION LIFECYCLE TEST FAILED]:', err);
    process.exit(1);
  }
};

runLearningPathCompletionLifecycleTest();
