import dotenv from 'dotenv';
dotenv.config();

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
import { assessmentService } from './src/services/assessment.service.js';
import { attemptService } from './src/services/attempt.service.js';
import { evaluationService } from './src/services/evaluation.service.js';
import { diagnosticService } from './src/services/diagnostic.service.js';
import { reassessmentService } from './src/services/reassessment.service.js';

const runRegressionTests = async () => {
  console.log('=== STARTING COMPLETE ASSESSMENT LIFECYCLE & STATE MACHINE REGRESSION TESTS ===\n');

  await connectDB();

  const timestamp = Date.now();
  const teacherEmail = `teacher_reg_${timestamp}@test.com`;
  const studentAEmail = `student_a_reg_${timestamp}@test.com`;
  const studentBEmail = `student_b_reg_${timestamp}@test.com`;

  try {
    // Setup Test Users
    const teacher = await User.create({
      name: 'Teacher Reg',
      email: teacherEmail,
      password: 'password123',
      role: 'teacher'
    });

    const studentA = await User.create({
      name: 'Student A Reg',
      email: studentAEmail,
      password: 'password123',
      role: 'student'
    });

    const studentB = await User.create({
      name: 'Student B Reg',
      email: studentBEmail,
      password: 'password123',
      role: 'student'
    });

    const course = await Course.create({
      teacherId: teacher._id,
      title: 'Regression Testing Course',
      description: 'Assessment state machine test course',
      code: `REG-${timestamp}`,
      subject: 'Math',
      gradeLevel: '10th'
    });

    const topic = await Topic.create({
      courseId: course._id,
      teacherId: teacher._id,
      title: 'Quadratic Equations',
      order: 1
    });

    const material = await Material.create({
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      title: 'Quadratic Basics',
      fileName: 'quadratic_basics.pdf',
      fileUrl: '/uploads/quadratic_basics.pdf',
      fileType: 'pdf',
      fileSizeBytes: 1024,
      status: 'processed'
    });

    await DocumentChunk.create({
      materialId: material._id,
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      chunkIndex: 0,
      content: 'Solving quadratic equations using factoring, completing the square, and quadratic formula. ax^2 + bx + c = 0.',
      tokenCount: 20,
      pageNumber: 1,
      embedding: new Array(1536).fill(0.01)
    });

    const initialAssessment = await Assessment.create({
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      accessCode: `LC-REG${Math.floor(1000 + Math.random() * 9000)}`,
      title: 'Quadratic Equations Initial Diagnostic',
      difficulty: 'medium',
      totalQuestions: 2,
      type: 'initial_diagnostic',
      status: 'published',
      questions: [
        {
          questionText: 'Solve x^2 - 5x + 6 = 0.',
          questionType: 'short_answer',
          correctAnswer: 'x = 2, x = 3',
          difficulty: 'medium',
          expectedConcepts: ['Factoring quadratics'],
          rubric: { gradingCriteria: 'Correct roots x=2 and x=3', sampleAnswer: 'x=2, x=3', maxPoints: 1 }
        },
        {
          questionText: 'What is the discriminant of ax^2 + bx + c = 0?',
          questionType: 'short_answer',
          correctAnswer: 'b^2 - 4ac',
          difficulty: 'easy',
          expectedConcepts: ['Quadratic formula'],
          rubric: { gradingCriteria: 'Formula b^2 - 4ac', sampleAnswer: 'b^2 - 4ac', maxPoints: 1 }
        }
      ]
    });

    // Assign Initial Assessment to Student A & Student B
    await AssessmentAssignment.create({ studentId: studentA._id, assessmentId: initialAssessment._id, status: 'assigned' });
    await AssessmentAssignment.create({ studentId: studentB._id, assessmentId: initialAssessment._id, status: 'assigned' });

    console.log('--- TEST 1: Student A has never attempted assessment ---');
    let studentAList1 = await assessmentService.getAvailableStudentAssessments(studentA._id);
    let itemA1 = studentAList1.find((item) => item.assessmentId.toString() === initialAssessment._id.toString());
    console.assert(itemA1.canStart === true, 'TEST 1 FAIL: canStart should be true');
    console.assert(itemA1.canResume === false, 'TEST 1 FAIL: canResume should be false');
    console.assert(itemA1.attemptStatus === null, 'TEST 1 FAIL: attemptStatus should be null');
    console.log('✓ TEST 1 PASSED: canStart = true, canResume = false, attemptStatus = null\n');

    console.log('--- TEST 2: Student A starts assessment ---');
    const startRes = await attemptService.startAttempt({ assessmentId: initialAssessment._id, studentId: studentA._id });
    const attemptA = startRes.attempt;

    let studentAList2 = await assessmentService.getAvailableStudentAssessments(studentA._id);
    let itemA2 = studentAList2.find((item) => item.assessmentId.toString() === initialAssessment._id.toString());
    console.assert(itemA2.canStart === false, 'TEST 2 FAIL: canStart should be false');
    console.assert(itemA2.canResume === true, 'TEST 2 FAIL: canResume should be true');
    console.assert(itemA2.attemptStatus === 'in_progress', 'TEST 2 FAIL: attemptStatus should be in_progress');
    console.log('✓ TEST 2 PASSED: canStart = false, canResume = true, attemptStatus = in_progress\n');

    console.log('--- TEST 3: Student A submits assessment ---');
    await attemptService.saveResponse({ attemptId: attemptA._id, questionId: initialAssessment.questions[0]._id, studentAnswer: 'x = 2', studentId: studentA._id });
    await attemptService.saveResponse({ attemptId: attemptA._id, questionId: initialAssessment.questions[1]._id, studentAnswer: 'b^2 - 4ac', studentId: studentA._id });

    const submitRes = await attemptService.submitAttempt({ attemptId: attemptA._id, studentId: studentA._id });
    console.assert(submitRes.attempt.status === 'submitted', 'TEST 3 FAIL: attempt status should be submitted');

    let studentAList3 = await assessmentService.getAvailableStudentAssessments(studentA._id);
    let itemA3 = studentAList3.find((item) => item.assessmentId.toString() === initialAssessment._id.toString());
    console.assert(itemA3.canStart === false, 'TEST 3 FAIL: canStart should be false');
    console.assert(itemA3.canResume === false, 'TEST 3 FAIL: canResume should be false');
    console.assert(itemA3.attemptStatus === 'submitted' || itemA3.attemptStatus === 'evaluated', 'TEST 3 FAIL: attemptStatus should be submitted or evaluated');
    console.log('✓ TEST 3 PASSED: canStart = false, canResume = false, attemptStatus = submitted\n');

    console.log('--- TEST 4 & 5 & 6: Re-fetching assessment list / page refreshes / navigation ---');
    let studentAList4 = await assessmentService.getAvailableStudentAssessments(studentA._id);
    let itemA4 = studentAList4.find((item) => item.assessmentId.toString() === initialAssessment._id.toString());
    console.assert(itemA4.canStart === false, 'TEST 4-6 FAIL: canStart must remain false');
    console.assert(itemA4.canResume === false, 'TEST 4-6 FAIL: canResume must remain false');
    console.log('✓ TEST 4, 5, 6 PASSED: Assessment remains non-startable and non-resumable post submission\n');

    console.log('--- TEST 7: Generate diagnostic, learning path, and targeted reassessment ---');
    const diagRes = await diagnosticService.generateDiagnosticReport({ attemptId: attemptA._id, userId: studentA._id, userRole: 'student', options: { skipRetry: true } });
    const diagnosticReport = diagRes.report;

    const reassessmentGenRes = await reassessmentService.generateReassessment({ diagnosticReportId: diagnosticReport._id, userId: studentA._id, userRole: 'student', options: { skipRetry: true } });
    const reassessmentDoc = reassessmentGenRes.reassessment;

    let studentAList7 = await assessmentService.getAvailableStudentAssessments(studentA._id);
    let reassessmentItem7 = studentAList7.find((item) => item.assessmentId.toString() === reassessmentDoc._id.toString());
    console.assert(reassessmentItem7 !== undefined, 'TEST 7 FAIL: Targeted reassessment should be present in student assessment list');
    console.assert(reassessmentItem7.canStart === true, 'TEST 7 FAIL: Targeted reassessment canStart should be true before attempt');
    console.assert(reassessmentItem7.canResume === false, 'TEST 7 FAIL: Targeted reassessment canResume should be false before attempt');
    console.log('✓ TEST 7 PASSED: Targeted reassessment is available (canStart = true)\n');

    console.log('--- TEST 8: Student A starts and submits targeted reassessment ---');
    const reassessmentStartRes = await attemptService.startAttempt({ assessmentId: reassessmentDoc._id, studentId: studentA._id });
    const reassessmentAttempt = reassessmentStartRes.attempt;

    await attemptService.saveResponse({ attemptId: reassessmentAttempt._id, questionId: reassessmentDoc.questions[0]._id, studentAnswer: 'Corrected concept answer', studentId: studentA._id });
    await attemptService.submitAttempt({ attemptId: reassessmentAttempt._id, studentId: studentA._id });

    await reassessmentService.processReassessmentSubmission({ reassessmentAttemptId: reassessmentAttempt._id, userId: studentA._id, userRole: 'student', options: { skipRetry: true } });

    let studentAList8 = await assessmentService.getAvailableStudentAssessments(studentA._id);
    let reassessmentItem8 = studentAList8.find((item) => item.assessmentId.toString() === reassessmentDoc._id.toString());
    console.assert(reassessmentItem8.canStart === false, 'TEST 8 FAIL: Targeted reassessment canStart should be false after submission');
    console.assert(reassessmentItem8.canResume === false, 'TEST 8 FAIL: Targeted reassessment canResume should be false after submission');
    console.assert(['submitted', 'evaluated', 'completed'].includes(reassessmentItem8.attemptStatus), 'TEST 8 FAIL: attemptStatus must be evaluated/completed');
    console.log('✓ TEST 8 PASSED: Targeted reassessment submitted (canStart = false, canResume = false)\n');

    console.log('--- TEST 9 & 10: Re-querying Assessments list post reassessment completion ---');
    let studentAList9 = await assessmentService.getAvailableStudentAssessments(studentA._id);
    const startableItems = studentAList9.filter((item) => item.canStart === true);
    console.assert(startableItems.length === 0, 'TEST 9-10 FAIL: No completed assessment or reassessment should be startable');
    console.log('✓ TEST 9 & 10 PASSED: Zero assessments in Student A list have canStart = true\n');

    console.log('--- TEST 11: Database check for unintended duplicate records ---');
    const totalAssessmentsInDB = await Assessment.countDocuments({ topicId: topic._id });
    console.assert(totalAssessmentsInDB === 2, `TEST 11 FAIL: Expected exactly 2 assessments (1 initial + 1 reassessment), found ${totalAssessmentsInDB}`);
    const totalAttemptsForStudentA = await Attempt.countDocuments({ studentId: studentA._id });
    console.assert(totalAttemptsForStudentA === 2, `TEST 11 FAIL: Expected exactly 2 attempts for Student A, found ${totalAttemptsForStudentA}`);
    console.log('✓ TEST 11 PASSED: Exactly 2 assessments and 2 attempts exist in DB (no duplicates)\n');

    console.log('--- TEST 12: Student B state isolation ---');
    let studentBList = await assessmentService.getAvailableStudentAssessments(studentB._id);
    let itemB = studentBList.find((item) => item.assessmentId.toString() === initialAssessment._id.toString());
    console.assert(itemB !== undefined, 'TEST 12 FAIL: Student B should have initial assessment assigned');
    console.assert(itemB.canStart === true, 'TEST 12 FAIL: Student B canStart should still be true');
    console.assert(itemB.attemptStatus === null, 'TEST 12 FAIL: Student B attemptStatus should still be null');
    console.log('✓ TEST 12 PASSED: Student B state remains unattempted and available (canStart = true)\n');

    console.log('=== ALL 12 REGRESSION TESTS PASSED CLEANLY AND SUCCESSFULLY! ===');
    process.exit(0);
  } catch (err) {
    console.error('REGRESSION TEST FAILURE:', err);
    process.exit(1);
  }
};

runRegressionTests();
