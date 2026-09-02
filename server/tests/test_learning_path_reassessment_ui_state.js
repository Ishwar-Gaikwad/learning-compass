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

const createMockNode = (id, order, title, isCompleted = false) => ({
  nodeId: id,
  sequenceOrder: order,
  title,
  type: 'remedial_reading',
  targetConcept: 'Synthetic Division',
  reasonForTargeting: 'Concept identified as weak',
  learningObjective: 'Master synthetic division steps',
  expectedOutcome: 'Accurate division calculations',
  reassessmentCriteria: 'Solve polynomial division accurately',
  isCompleted
});

const runUIStateTest = async () => {
  console.log('=== STARTING LEARNING PATH REASSESSMENT UI STATE INTEGRATION TEST ===\n');
  await connectDB();

  const teacherEmail = `teacher_ui_${Date.now()}@example.com`;
  const studentEmail = `student_ui_${Date.now()}@example.com`;

  try {
    // 1. Register Teacher & Student
    console.log('--- Step 1: Register Teacher & Student ---');
    const teacher = await User.create({ name: 'Teacher UI', email: teacherEmail, password: 'password123', role: 'teacher' });
    const student = await User.create({ name: 'Student UI', email: studentEmail, password: 'password123', role: 'student' });

    // 2. Create Course & Topic
    console.log('\n--- Step 2: Create Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `CS_${Date.now().toString().slice(-4)}`,
      title: 'UI State Test Course',
      description: 'Testing learning path reassessment UI state representation',
      subject: 'Computer Science',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'UI State Topic',
      description: 'Topic for testing UI state',
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
        originalname: 'ui_test.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      },
      title: 'UI Guide'
    });

    await documentIngestionService.processMaterialDocument(uploadedMaterial._id, teacher._id);

    const initialAssessmentRes = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Initial Diagnostic Quiz UI',
      totalQuestions: 2,
      difficulty: 'medium'
    });
    const initialAssessment = initialAssessmentRes.assessment;

    await assessmentService.joinAssessmentByCode({ accessCode: initialAssessment.accessCode, studentId: student._id });
    const startRes1 = await attemptService.startAttempt({ assessmentId: initialAssessment._id, studentId: student._id });
    const dummyAttempt1 = startRes1.attempt;

    const dummyAttempt2 = await Attempt.create({
      assessmentId: initialAssessment._id,
      studentId: student._id,
      status: 'submitted',
      score: 8,
      maxScore: 10,
      percentage: 80
    });

    // -------------------------------------------------------------
    // TEST CASE 4: INCOMPLETE TASKS -> REASSESSMENT UNAVAILABLE
    // -------------------------------------------------------------
    console.log('\n--- TEST CASE 4: Incomplete Tasks -> Reassessment Unavailable ---');
    const diagReportUncompleted = await DiagnosticReport.create({
      assessmentId: initialAssessment._id,
      attemptId: dummyAttempt1._id,
      studentId: student._id,
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      overallMasteryScore: 40,
      masteryLevel: 'developing',
      aiSummary: 'Diagnostic report for uncompleted path',
      weakConcepts: [{ concept: 'Synthetic Division', severity: 'medium', evidence: 'Weak calculation' }]
    });

    const uncompletedPathDoc = await LearningPath.create({
      diagnosticReportId: diagReportUncompleted._id,
      attemptId: dummyAttempt1._id,
      studentId: student._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Incomplete Learning Path',
      status: 'active',
      overallProgressPercentage: 0,
      nodes: [
        createMockNode('node_1', 1, 'Task 1', false),
        createMockNode('node_2', 2, 'Task 2', false)
      ]
    });

    const incompletePathState = await learningPathService.getLearningPathById({ pathId: uncompletedPathDoc._id, userId: student._id, userRole: 'student' });
    console.log(`Incomplete path activitiesCompleted: ${incompletePathState.activitiesCompleted} (Expected: false)`);
    console.log(`Incomplete path isReadyForReassessment: ${incompletePathState.isReadyForReassessment} (Expected: false)`);
    if (incompletePathState.isReadyForReassessment !== false || incompletePathState.activitiesCompleted !== false) {
      throw new Error('Test Case 4 Failed: Incomplete tasks should have isReadyForReassessment = false');
    }

    // -------------------------------------------------------------
    // TEST CASE 2: 100% TASKS + MASTERY AT/ABOVE THRESHOLD -> REASSESSMENT UNAVAILABLE
    // -------------------------------------------------------------
    console.log('\n--- TEST CASE 2: 100% Tasks + Mastery at/above Threshold (85%) -> Reassessment Unavailable ---');
    const diagReportMastered = await DiagnosticReport.create({
      assessmentId: initialAssessment._id,
      attemptId: dummyAttempt2._id,
      studentId: student._id,
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      overallMasteryScore: 85,
      masteryLevel: 'mastered',
      aiSummary: 'Diagnostic report for mastered student',
      weakConcepts: []
    });

    const masteredPathDoc = await LearningPath.create({
      diagnosticReportId: diagReportMastered._id,
      attemptId: dummyAttempt2._id,
      studentId: student._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Mastered Learning Path',
      status: 'active',
      overallProgressPercentage: 100,
      nodes: [
        createMockNode('node_m1', 1, 'Task 1', true)
      ]
    });

    const masteredPathState = await learningPathService.getLearningPathById({ pathId: masteredPathDoc._id, userId: student._id, userRole: 'student' });
    console.log(`Mastered path status: '${masteredPathState.status}' (Expected: 'completed')`);
    console.log(`Mastered path isMastered: ${masteredPathState.isMastered} (Expected: true)`);
    console.log(`Mastered path isReadyForReassessment: ${masteredPathState.isReadyForReassessment} (Expected: false)`);

    if (masteredPathState.isReadyForReassessment !== false || masteredPathState.status !== 'completed' || !masteredPathState.isMastered) {
      throw new Error('Test Case 2 Failed: Mastered path should have isReadyForReassessment = false and status = completed');
    }

    // Verify backend generateReassessment rejects reassessment request
    let backendRejectedErr = null;
    try {
      await reassessmentService.generateReassessment({ diagnosticReportId: diagReportMastered._id, userId: student._id, userRole: 'student' });
    } catch (err) {
      backendRejectedErr = err;
    }
    console.log(`Mastered path reassessment generation error code: '${backendRejectedErr?.errorCode}' (Expected: 'MASTERY_ACHIEVED')`);
    if (!backendRejectedErr || backendRejectedErr.errorCode !== 'MASTERY_ACHIEVED') {
      throw new Error('Test Case 2 Failed: generateReassessment did not reject mastered report with MASTERY_ACHIEVED');
    }

    // -------------------------------------------------------------
    // TEST CASE 6: MASTERED PATH IS NOT COUNTED AS ACTIVE LEARNING PATH
    // -------------------------------------------------------------
    console.log('\n--- TEST CASE 6: Mastered Path is Not Counted as Active Learning Path ---');
    const allStudentPaths = await learningPathService.getStudentLearningPaths(student._id);
    const activeStudentPaths = allStudentPaths.filter((p) => p.status === 'active' && !p.isMastered);
    const completedStudentPaths = allStudentPaths.filter((p) => p.status === 'completed' || p.isMastered);

    console.log(`Total Student Paths: ${allStudentPaths.length}, Active Count: ${activeStudentPaths.length}, Completed Count: ${completedStudentPaths.length}`);
    const isMasteredPathInActive = activeStudentPaths.some((p) => p._id.toString() === masteredPathDoc._id.toString());
    console.log(`Is Mastered Path included in Active Paths list? ${isMasteredPathInActive} (Expected: false)`);
    if (isMasteredPathInActive) {
      throw new Error('Test Case 6 Failed: Mastered learning path should NOT be counted as active learning path');
    }

    // -------------------------------------------------------------
    // TEST CASE 1: 100% TASKS + MASTERY BELOW THRESHOLD -> REASSESSMENT AVAILABLE
    // -------------------------------------------------------------
    console.log('\n--- TEST CASE 1: 100% Tasks + Mastery Below Threshold -> Reassessment Available ---');
    await attemptService.saveResponse({ attemptId: dummyAttempt1._id, questionId: initialAssessment.questions[0]._id, studentAnswer: 'Answer 1', studentId: student._id });
    await attemptService.saveResponse({ attemptId: dummyAttempt1._id, questionId: initialAssessment.questions[1]._id, studentAnswer: 'Answer 2', studentId: student._id });
    await attemptService.submitAttempt({ attemptId: dummyAttempt1._id, studentId: student._id });

    // Await DiagnosticReport & LearningPath
    let initialDiag = null;
    let initialPath = null;
    let polls = 0;
    while (polls < 30) {
      await new Promise((res) => setTimeout(res, 500));
      polls++;
      initialDiag = await DiagnosticReport.findOne({ attemptId: dummyAttempt1._id });
      if (initialDiag) {
        initialPath = await LearningPath.findOne({ diagnosticReportId: initialDiag._id });
      }
      if (initialDiag && initialPath) break;
    }

    if (!initialDiag || !initialPath) throw new Error('Initial diagnostic/learning path generation failed!');

    // Ensure report is below mastery threshold for test
    initialDiag.overallMasteryScore = 50;
    initialDiag.masteryLevel = 'developing';
    initialDiag.weakConcepts = [{ concept: 'Synthetic Division', severity: 'high', evidence: 'Needs work' }];
    await initialDiag.save();

    // Complete all learning nodes
    for (const node of initialPath.nodes) {
      await learningPathService.completeLearningNode({ pathId: initialPath._id, nodeId: node.nodeId || node._id, userId: student._id });
    }

    const availablePathState = await learningPathService.getLearningPathById({ pathId: initialPath._id, userId: student._id, userRole: 'student' });
    console.log(`100% Tasks + Weak concepts: isReadyForReassessment = ${availablePathState.isReadyForReassessment} (Expected: true)`);
    console.log(`100% Tasks + Weak concepts: status = '${availablePathState.status}' (Expected: 'active')`);
    console.log(`100% Tasks + Weak concepts: isMastered = ${availablePathState.isMastered} (Expected: false)`);

    if (!availablePathState.isReadyForReassessment || availablePathState.isMastered || availablePathState.status !== 'active') {
      throw new Error('Test Case 1 Failed: 100% tasks with low mastery should be ready for reassessment');
    }

    // Generate Targeted Reassessment
    const reassessRes = await reassessmentService.generateReassessment({ diagnosticReportId: initialDiag._id, userId: student._id, userRole: 'student' });
    const reassessmentObj = reassessRes.reassessment;

    // -------------------------------------------------------------
    // TEST CASE 5: FRONTEND STATUS MATCHES BACKEND ELIGIBILITY
    // -------------------------------------------------------------
    console.log('\n--- TEST CASE 5: Frontend Status Matches Backend Eligibility ---');
    const preSubmitPathState = await learningPathService.getLearningPathById({ pathId: initialPath._id, userId: student._id, userRole: 'student' });
    console.log(`Pre-Submit reassessmentStatus: '${preSubmitPathState.reassessmentStatus}' (Expected: 'available')`);
    console.log(`Pre-Submit isReadyForReassessment: ${preSubmitPathState.isReadyForReassessment} (Expected: true)`);
    if (preSubmitPathState.reassessmentStatus !== 'available' || !preSubmitPathState.isReadyForReassessment) {
      throw new Error('Test Case 5 Failed: Pre-submit assertion failed');
    }

    // -------------------------------------------------------------
    // TEST CASE 3: REASSESSMENT ALREADY COMPLETED -> UNAVAILABLE
    // -------------------------------------------------------------
    console.log('\n--- TEST CASE 3: Reassessment Already Completed -> Unavailable ---');
    const startReassessRes = await attemptService.startAttempt({ assessmentId: reassessmentObj._id, studentId: student._id });
    const reassessAttempt = startReassessRes.attempt;

    await attemptService.saveResponse({ attemptId: reassessAttempt._id, questionId: reassessmentObj.questions[0]._id, studentAnswer: 'Reassessment Answer 1', studentId: student._id });
    await attemptService.saveResponse({ attemptId: reassessAttempt._id, questionId: reassessmentObj.questions[1]._id, studentAnswer: 'Reassessment Answer 2', studentId: student._id });
    await attemptService.submitAttempt({ attemptId: reassessAttempt._id, studentId: student._id });

    // Process reassessment submission with skipRemediationCheck for test pipeline consistency
    await reassessmentService.processReassessmentSubmission({ reassessmentAttemptId: reassessAttempt._id, userId: student._id, userRole: 'student', options: { skipRemediationCheck: true } });

    // Fetch Learning Path via API POST-Reassessment Submission
    const postSubmitPathState = await learningPathService.getLearningPathById({ pathId: initialPath._id, userId: student._id, userRole: 'student' });
    console.log(`Post-Submit reassessmentStatus: '${postSubmitPathState.reassessmentStatus}' (Expected: 'completed')`);
    console.log(`Post-Submit isReadyForReassessment: ${postSubmitPathState.isReadyForReassessment} (Expected: false)`);
    console.log(`Post-Submit status: '${postSubmitPathState.status}' (Expected: 'completed')`);

    if (postSubmitPathState.reassessmentStatus !== 'completed' || postSubmitPathState.isReadyForReassessment !== false || postSubmitPathState.status !== 'completed') {
      throw new Error('Test Case 3 Failed: Post-submit reassessment should be unavailable');
    }

    // Verify backend generateReassessment rejects generating second reassessment
    let secondReassessErr = null;
    try {
      await reassessmentService.generateReassessment({ diagnosticReportId: initialDiag._id, userId: student._id, userRole: 'student' });
    } catch (err) {
      secondReassessErr = err;
    }
    console.log(`Second reassessment error code: '${secondReassessErr?.errorCode}' (Expected: 'MASTERY_ACHIEVED')`);
    if (!secondReassessErr || secondReassessErr.errorCode !== 'MASTERY_ACHIEVED') {
      throw new Error('Test Case 3 Failed: Should reject generating second reassessment when completed');
    }

    // Cleanup
    await User.deleteMany({ email: { $in: [teacherEmail, studentEmail] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Material.deleteMany({ _id: uploadedMaterial._id });
    await DocumentChunk.deleteMany({ materialId: uploadedMaterial._id });
    await Assessment.deleteMany({ topicId: topic._id });
    await Attempt.deleteMany({ _id: { $in: [dummyAttempt1._id, dummyAttempt2._id, reassessAttempt._id] } });
    await AttemptResponse.deleteMany({ attemptId: { $in: [dummyAttempt1._id, dummyAttempt2._id, reassessAttempt._id] } });
    await DiagnosticReport.deleteMany({ topicId: topic._id });
    await LearningPath.deleteMany({ _id: { $in: [initialPath._id, uncompletedPathDoc._id, masteredPathDoc._id] } });
    await DiagnosticComparison.deleteMany({ topicId: topic._id });

    console.log('\n=== ALL 6 REASSESSMENT ELIGIBILITY & UI STATE TEST CASES PASSED 100%! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[UI STATE INTEGRATION TEST FAILED]:', err);
    process.exit(1);
  }
};

runUIStateTest();
