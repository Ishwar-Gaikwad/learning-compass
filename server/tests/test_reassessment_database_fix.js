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

const runReassessmentDatabaseFixTest = async () => {
  console.log('=== STARTING REASSESSMENT DATABASE FIX REGRESSION TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_fix_${Date.now()}@example.com`;
  const studentEmail = `student_fix_${Date.now()}@example.com`;

  try {
    // 1. Create Teacher & Student
    console.log('--- Step 1: Register Teacher & Student ---');
    const teacher = await User.create({ name: 'Teacher Fix', email: teacherEmail, password: 'password123', role: 'teacher' });
    const student = await User.create({ name: 'Student Fix', email: studentEmail, password: 'password123', role: 'student' });

    // 2. Create Course & Topic
    console.log('\n--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `FIX_${Date.now().toString().slice(-4)}`,
      title: 'DB Fix Test Course',
      description: 'Testing reassessment submission database fix',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Polynomial Reassessment Fix Topic',
      description: 'Topic for testing DB fix',
      order: 1
    });

    // 3. Ingest Material & Generate Assessment
    console.log('\n--- Step 3: Ingest Material & Create Assessment ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 140>>stream\nBT /F1 12 Tf 72 712 Td (Synthetic division simplifies dividing a polynomial by a linear binomial (x - c). Use constant c and bring down leading coefficient.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n508\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'fix_test.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'Fix Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);

    const initialAssessmentRes = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Initial Diagnostic DB Fix Quiz',
      totalQuestions: 2
    });
    const initialAssessment = initialAssessmentRes.assessment;

    // 4. Student Joins & Submits Initial Assessment
    console.log('\n--- Step 4: Student Joins & Submits Initial Assessment ---');
    await assessmentService.joinAssessmentByCode({ accessCode: initialAssessment.accessCode, studentId: student._id });
    const startRes = await attemptService.startAttempt({ assessmentId: initialAssessment._id, studentId: student._id });
    const attempt1 = startRes.attempt;

    await attemptService.saveResponse({ attemptId: attempt1._id, questionId: initialAssessment.questions[0]._id, studentAnswer: 'Partial synthetic division constant c.', studentId: student._id });
    await attemptService.saveResponse({ attemptId: attempt1._id, questionId: initialAssessment.questions[1]._id, studentAnswer: 'P(c) remainder answer.', studentId: student._id });
    await attemptService.submitAttempt({ attemptId: attempt1._id, studentId: student._id });

    // Await Diagnostic & Learning Path
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

    // 5. Complete All Required Activities
    console.log('\n--- Step 5: Complete All Required Learning Activities ---');
    for (const node of initialPath.nodes) {
      await learningPathService.completeLearningNode({ pathId: initialPath._id, nodeId: node.nodeId || node._id, userId: student._id });
    }

    // 6. Generate Targeted Reassessment
    console.log('\n--- Step 6: Generate Targeted Reassessment ---');
    const reassessRes = await reassessmentService.generateReassessment({ diagnosticReportId: initialDiag._id, userId: student._id, userRole: 'student' });
    const reassessmentObj = reassessRes.reassessment;

    // 7. Student Submits Targeted Reassessment (CRITICAL OPERATION)
    console.log('\n--- Step 7: Student Starts & Submits Targeted Reassessment ---');
    const startReassessRes = await attemptService.startAttempt({ assessmentId: reassessmentObj._id, studentId: student._id });
    const reassessAttempt = startReassessRes.attempt;

    await attemptService.saveResponse({ attemptId: reassessAttempt._id, questionId: reassessmentObj.questions[0]._id, studentAnswer: 'Correct synthetic division coefficients.', studentId: student._id });
    await attemptService.saveResponse({ attemptId: reassessAttempt._id, questionId: reassessmentObj.questions[1]._id, studentAnswer: 'Correct remainder theorem proof.', studentId: student._id });
    
    // Submit Attempt
    await attemptService.submitAttempt({ attemptId: reassessAttempt._id, studentId: student._id });

    // Process Reassessment Submission
    console.log('Processing targeted reassessment submission...');
    const procResult = await reassessmentService.processReassessmentSubmission({
      reassessmentAttemptId: reassessAttempt._id,
      userId: student._id,
      userRole: 'student'
    });

    console.log(`Reassessment Submission Processed Successfully! isMastered: ${procResult.isMastered}`);
    console.log('[ASSERT PASS] Targeted reassessment submission completed without StudentId duplicate key error.');

    // 8. Verify Post-Submission API Learning Path State
    console.log('\n--- Step 8: Verify Post-Submission Learning Path API State ---');
    const pathStatePostSubmit = await learningPathService.getLearningPathById({ pathId: initialPath._id, userId: student._id, userRole: 'student' });
    console.log(`Post-Submit reassessmentStatus: '${pathStatePostSubmit.reassessmentStatus}' (Expected: 'completed')`);
    console.log(`Post-Submit isReadyForReassessment: ${pathStatePostSubmit.isReadyForReassessment} (Expected: false)`);
    if (pathStatePostSubmit.reassessmentStatus !== 'completed' || pathStatePostSubmit.isReadyForReassessment !== false) {
      throw new Error(`Post-submit API assertion failed: status='${pathStatePostSubmit.reassessmentStatus}', isReady=${pathStatePostSubmit.isReadyForReassessment}`);
    }
    console.log('[ASSERT PASS] Learning Path API returns reassessmentStatus = completed and isReadyForReassessment = false.');

    // 9. Assert No Duplicate Collections Created
    console.log('\n--- Step 9: Verify Entity Uniqueness & Duplication ---');
    const totalReassessments = await Assessment.countDocuments({ previousDiagnosticReportId: initialDiag._id });
    const totalLearningPaths = await LearningPath.countDocuments({ studentId: student._id, topicId: topic._id });
    const totalComparisons = await DiagnosticComparison.countDocuments({ reassessmentAttemptId: reassessAttempt._id });
    const totalAssignments = await AssessmentAssignment.countDocuments({ studentId: student._id, assessmentId: reassessmentObj._id });

    console.log(`Total Reassessments: ${totalReassessments} (Expected: 1)`);
    console.log(`Total Learning Paths: ${totalLearningPaths} (Expected: 1)`);
    console.log(`Total Comparisons: ${totalComparisons} (Expected: 1)`);
    console.log(`Total Assignments: ${totalAssignments} (Expected: 1)`);

    if (totalReassessments !== 1 || totalLearningPaths !== 1 || totalComparisons !== 1 || totalAssignments !== 1) {
      throw new Error('TEST FAILED: Duplicate entities created during reassessment submission!');
    }
    console.log('[ASSERT PASS] No duplicate entities created.');

    // 10. Verify MongoDB Indexes
    console.log('\n--- Step 10: Verify MongoDB Indexes ---');
    const db = mongoose.connection.db;
    const collections = ['diagnosticreports', 'learningpaths', 'diagnosticcomparisons', 'attempts', 'assessmentassignments'];
    for (const colName of collections) {
      const indexes = await db.collection(colName).indexes();
      for (const idx of indexes) {
        const keys = Object.keys(idx.key || {});
        if (idx.unique && keys.length === 1 && keys[0] === 'studentId') {
          throw new Error(`TEST FAILED: Found incorrect standalone unique index '${idx.name}' on collection '${colName}'!`);
        }
      }
    }
    console.log('[ASSERT PASS] Verified NO standalone unique index exists on studentId alone for multi-record collections.');

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

    console.log('\n=== REASSESSMENT DATABASE FIX REGRESSION TEST PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[REASSESSMENT DATABASE FIX TEST FAILED]:', err);
    process.exit(1);
  }
};

runReassessmentDatabaseFixTest();
