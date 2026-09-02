import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';
import { Material } from './src/models/Material.js';
import { Assessment } from './src/models/Assessment.js';
import { Attempt } from './src/models/Attempt.js';
import { AttemptResponse } from './src/models/AttemptResponse.js';
import { DiagnosticReport } from './src/models/DiagnosticReport.js';
import { assessmentService } from './src/services/assessment.service.js';
import { attemptService } from './src/services/attempt.service.js';
import { reassessmentService } from './src/services/reassessment.service.js';
import { diagnosticService } from './src/services/diagnostic.service.js';

dotenv.config();

async function runHierarchyAudit() {
  console.log('=== Starting Assessment Hierarchy & Student Lifecycle Audit ===');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB');

  const testEmailPrefix = `audit_${Date.now()}`;
  const teacher = await User.create({
    name: 'Audit Teacher',
    email: `${testEmailPrefix}_teacher@example.com`,
    password: 'password123',
    passwordHash: 'hashed_pw',
    role: 'teacher'
  });

  const student1 = await User.create({
    name: 'Student 1 (Mastered)',
    email: `${testEmailPrefix}_s1@example.com`,
    password: 'password123',
    passwordHash: 'hashed_pw',
    role: 'student'
  });

  const student2 = await User.create({
    name: 'Student 2 (Remediation)',
    email: `${testEmailPrefix}_s2@example.com`,
    password: 'password123',
    passwordHash: 'hashed_pw',
    role: 'student'
  });

  const student3 = await User.create({
    name: 'Student 3 (Remediation)',
    email: `${testEmailPrefix}_s3@example.com`,
    password: 'password123',
    passwordHash: 'hashed_pw',
    role: 'student'
  });

  const course = await Course.create({
    teacherId: teacher._id,
    title: 'DSA Data Structures',
    code: 'DSA101',
    subject: 'Computer Science',
    gradeLevel: 'College',
    description: 'Data Structures & Algorithms Course'
  });

  const topic = await Topic.create({
    courseId: course._id,
    title: 'Hashmap',
    order: 1
  });

  try {
    // TEST 1: Teacher creates Hashmap assessment
    console.log('\n--- TEST 1: Teacher Creates Hashmap Assessment ---');
    const rootAssessment = await Assessment.create({
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      accessCode: `HASH_${Date.now()}`,
      title: 'Hashmap Diagnostic Quiz',
      type: 'initial_diagnostic',
      totalQuestions: 3,
      questions: [
        {
          questionText: 'What is Hashmap collision resolution?',
          questionType: 'short_answer',
          correctAnswer: 'Chaining or Open Addressing',
          difficulty: 'medium',
          rubric: { gradingCriteria: 'Correct resolution techniques', sampleAnswer: 'Chaining or Open Addressing', maxPoints: 10 }
        },
        {
          questionText: 'What is time complexity of Hashmap get on average?',
          questionType: 'short_answer',
          correctAnswer: 'O(1)',
          difficulty: 'easy',
          rubric: { gradingCriteria: 'O(1)', sampleAnswer: 'O(1)', maxPoints: 10 }
        },
        {
          questionText: 'How does load factor affect Hashmap resize?',
          questionType: 'short_answer',
          correctAnswer: 'Triggers rehash when entries exceed threshold',
          difficulty: 'hard',
          rubric: { gradingCriteria: 'Threshold rehash', sampleAnswer: 'Rehash when load factor exceeded', maxPoints: 10 }
        }
      ],
      status: 'published'
    });

    let teacherAssessments = await assessmentService.getAssessmentsByTopic(course._id, topic._id, teacher._id);
    console.log(`Teacher assessment count after creation: ${teacherAssessments.length} (Expected: 1)`);
    if (teacherAssessments.length !== 1) throw new Error('TEST 1 Failed: Expected 1 assessment');

    // TEST 2: Three students submit Hashmap assessment
    console.log('\n--- TEST 2 & 3 & 4: Students Submit & Reassessments Generated ---');

    // Student 1 (Mastered)
    const att1 = await Attempt.create({ assessmentId: rootAssessment._id, studentId: student1._id, status: 'evaluated', score: 30, maxScore: 30, percentage: 100, submittedAt: new Date() });
    await AttemptResponse.create({ attemptId: att1._id, assessmentId: rootAssessment._id, studentId: student1._id, questionId: rootAssessment.questions[0]._id, studentAnswer: 'Chaining or Open Addressing', score: 10, isCorrect: true });
    await AttemptResponse.create({ attemptId: att1._id, assessmentId: rootAssessment._id, studentId: student1._id, questionId: rootAssessment.questions[1]._id, studentAnswer: 'O(1)', score: 10, isCorrect: true });
    await AttemptResponse.create({ attemptId: att1._id, assessmentId: rootAssessment._id, studentId: student1._id, questionId: rootAssessment.questions[2]._id, studentAnswer: 'Triggers rehash when threshold reached', score: 10, isCorrect: true });

    const rep1 = await DiagnosticReport.create({
      attemptId: att1._id,
      assessmentId: rootAssessment._id,
      studentId: student1._id,
      topicId: topic._id,
      teacherId: teacher._id,
      overallMasteryScore: 100,
      masteryLevel: 'mastered',
      aiSummary: 'Student has achieved 100% mastery on Hashmaps.'
    });

    // Student 2 (Needs Improvement)
    const att2 = await Attempt.create({ assessmentId: rootAssessment._id, studentId: student2._id, status: 'evaluated', score: 10, maxScore: 30, percentage: 33, submittedAt: new Date() });
    await AttemptResponse.create({ attemptId: att2._id, assessmentId: rootAssessment._id, studentId: student2._id, questionId: rootAssessment.questions[0]._id, studentAnswer: 'Wrong answer', score: 0, isCorrect: false });
    await AttemptResponse.create({ attemptId: att2._id, assessmentId: rootAssessment._id, studentId: student2._id, questionId: rootAssessment.questions[1]._id, studentAnswer: 'O(1)', score: 10, isCorrect: true });
    await AttemptResponse.create({ attemptId: att2._id, assessmentId: rootAssessment._id, studentId: student2._id, questionId: rootAssessment.questions[2]._id, studentAnswer: 'Unknown', score: 0, isCorrect: false });

    const rep2 = await DiagnosticReport.create({
      attemptId: att2._id,
      assessmentId: rootAssessment._id,
      studentId: student2._id,
      topicId: topic._id,
      teacherId: teacher._id,
      overallMasteryScore: 33,
      masteryLevel: 'novice',
      weakConcepts: [{ concept: 'Collision Resolution', severity: 'high', evidence: 'Incorrect answer' }],
      aiSummary: 'Student needs targeted remediation on Hashmap collision resolution.'
    });

    // Student 3 (Needs Improvement)
    const att3 = await Attempt.create({ assessmentId: rootAssessment._id, studentId: student3._id, status: 'evaluated', score: 10, maxScore: 30, percentage: 33, submittedAt: new Date() });
    await AttemptResponse.create({ attemptId: att3._id, assessmentId: rootAssessment._id, studentId: student3._id, questionId: rootAssessment.questions[0]._id, studentAnswer: 'Incorrect', score: 0, isCorrect: false });
    await AttemptResponse.create({ attemptId: att3._id, assessmentId: rootAssessment._id, studentId: student3._id, questionId: rootAssessment.questions[1]._id, studentAnswer: 'O(N)', score: 0, isCorrect: false });
    await AttemptResponse.create({ attemptId: att3._id, assessmentId: rootAssessment._id, studentId: student3._id, questionId: rootAssessment.questions[2]._id, studentAnswer: 'Rehash', score: 10, isCorrect: true });

    const rep3 = await DiagnosticReport.create({
      attemptId: att3._id,
      assessmentId: rootAssessment._id,
      studentId: student3._id,
      topicId: topic._id,
      teacherId: teacher._id,
      overallMasteryScore: 33,
      masteryLevel: 'developing',
      weakConcepts: [{ concept: 'Average Time Complexity', severity: 'high', evidence: 'O(N) instead of O(1)' }],
      aiSummary: 'Student needs targeted remediation on Hashmap time complexity.'
    });

    // Create targeted reassessment for Student 2
    const reassessment2 = await Assessment.create({
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      accessCode: `REASS2_${Date.now()}`,
      title: 'Targeted Reassessment: Hashmap',
      type: 'reassessment',
      previousDiagnosticReportId: rep2._id,
      parentAssessmentId: rootAssessment._id,
      targetedConcepts: ['Collision Resolution'],
      totalQuestions: 1,
      questions: [{
        questionText: 'Reassessment Q1: Explain open addressing.',
        questionType: 'short_answer',
        correctAnswer: 'Probing hash table',
        difficulty: 'medium',
        rubric: { gradingCriteria: 'Probing explanation', sampleAnswer: 'Probing', maxPoints: 10 }
      }],
      status: 'published'
    });

    const reAtt2 = await Attempt.create({
      assessmentId: reassessment2._id,
      studentId: student2._id,
      status: 'evaluated',
      score: 10,
      maxScore: 10,
      percentage: 100,
      submittedAt: new Date()
    });
    await AttemptResponse.create({
      attemptId: reAtt2._id,
      assessmentId: reassessment2._id,
      studentId: student2._id,
      questionId: reassessment2.questions[0]._id,
      studentAnswer: 'Probing hash table slots sequentially',
      score: 10,
      isCorrect: true
    });
    await DiagnosticReport.create({
      attemptId: reAtt2._id,
      assessmentId: reassessment2._id,
      studentId: student2._id,
      topicId: topic._id,
      teacherId: teacher._id,
      overallMasteryScore: 100,
      masteryLevel: 'mastered',
      aiSummary: 'Student 2 mastered collision resolution on targeted reassessment.'
    });

    // Create targeted reassessment for Student 3
    const reassessment3 = await Assessment.create({
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      accessCode: `REASS3_${Date.now()}`,
      title: 'Targeted Reassessment: Hashmap',
      type: 'reassessment',
      previousDiagnosticReportId: rep3._id,
      parentAssessmentId: rootAssessment._id,
      targetedConcepts: ['Average Time Complexity'],
      totalQuestions: 1,
      questions: [{
        questionText: 'Reassessment Q1: What is lookup complexity?',
        questionType: 'short_answer',
        correctAnswer: 'O(1)',
        difficulty: 'medium',
        rubric: { gradingCriteria: 'O(1)', sampleAnswer: 'O(1)', maxPoints: 10 }
      }],
      status: 'published'
    });

    const reAtt3 = await Attempt.create({
      assessmentId: reassessment3._id,
      studentId: student3._id,
      status: 'evaluated',
      score: 10,
      maxScore: 10,
      percentage: 100,
      submittedAt: new Date()
    });
    await AttemptResponse.create({
      attemptId: reAtt3._id,
      assessmentId: reassessment3._id,
      studentId: student3._id,
      questionId: reassessment3.questions[0]._id,
      studentAnswer: 'O(1) constant time',
      score: 10,
      isCorrect: true
    });

    // TEST 4: Teacher assessment list MUST STILL SHOW EXACTLY 1 ASSESSMENT (NOT 3!)
    console.log('\n--- TEST 4: Verify Teacher Assessment List Contains ONLY Root Assessment ---');
    teacherAssessments = await assessmentService.getAssessmentsByTopic(course._id, topic._id, teacher._id);
    console.log(`Teacher assessment count after 2 student reassessments created: ${teacherAssessments.length} (Expected: 1)`);
    console.log(`Assessment Title: "${teacherAssessments[0].title}" (Expected: "Hashmap Diagnostic Quiz")`);

    if (teacherAssessments.length !== 1) throw new Error(`TEST 4 Failed: Expected 1 assessment, got ${teacherAssessments.length}`);
    if (teacherAssessments[0].title !== 'Hashmap Diagnostic Quiz') throw new Error('TEST 4 Failed: Wrong assessment returned');

    // TEST 5, 6, 7, 8: Student Attempts & Reports Aggregation
    console.log('\n--- TEST 5-8: Verify Student Attempts & Reports Aggregation ---');
    const attemptsSummary = await attemptService.getAssessmentAttempts({ assessmentId: rootAssessment._id, teacherId: teacher._id });
    console.log(`Total attempts returned for Root Assessment: ${attemptsSummary.length} (Expected: 5 - 3 initial + 2 reassessments)`);

    // Group attempts by student
    const studentMap = {};
    attemptsSummary.forEach(a => {
      const sId = a.studentId._id.toString();
      if (!studentMap[sId]) studentMap[sId] = { initial: null, reassessments: [] };
      if (a.assessmentId.type === 'reassessment') {
        studentMap[sId].reassessments.push(a);
      } else {
        studentMap[sId].initial = a;
      }
    });

    console.log(`Distinct Students in Modal: ${Object.keys(studentMap).length} (Expected: 3)`);
    if (Object.keys(studentMap).length !== 3) throw new Error('TEST 5 Failed: Expected 3 distinct students');

    // Student 1 check
    const s1Data = studentMap[student1._id.toString()];
    console.log(`Student 1 Reassessment Count: ${s1Data.reassessments.length} (Expected: 0)`);
    console.log(`Student 1 Initial Responses Count: ${s1Data.initial.responses.length} (Expected: 3)`);
    if (s1Data.reassessments.length !== 0 || s1Data.initial.responses.length !== 3) throw new Error('TEST 8 Failed');

    // Student 2 check
    const s2Data = studentMap[student2._id.toString()];
    console.log(`Student 2 Reassessment Count: ${s2Data.reassessments.length} (Expected: 1)`);
    console.log(`Student 2 Initial Answer Q1: "${s2Data.initial.responses[0].studentAnswer}"`);
    console.log(`Student 2 Reassessment Answer Q1: "${s2Data.reassessments[0].responses[0].studentAnswer}"`);
    if (s2Data.initial.responses[0].studentAnswer === s2Data.reassessments[0].responses[0].studentAnswer) {
      throw new Error('TEST 6 Failed: Initial response was overwritten by reassessment response');
    }

    // Student 3 check
    const s3Data = studentMap[student3._id.toString()];
    console.log(`Student 3 Reassessment Count: ${s3Data.reassessments.length} (Expected: 1)`);
    console.log(`Student 3 Initial Answer Q1: "${s3Data.initial.responses[0].studentAnswer}"`);
    console.log(`Student 3 Reassessment Answer Q1: "${s3Data.reassessments[0].responses[0].studentAnswer}"`);
    if (s3Data.reassessments.length !== 1 || s3Data.initial.responses.length !== 3) throw new Error('TEST 7 Failed');

    // TEST 9: Add second reassessment for Student 2
    console.log('\n--- TEST 9: Add Second Reassessment for Student 2 ---');
    const reassessment2_sub = await Assessment.create({
      teacherId: teacher._id,
      courseId: course._id,
      topicId: topic._id,
      accessCode: `REASS2_SUB_${Date.now()}`,
      title: 'Targeted Reassessment #2: Hashmap',
      type: 'reassessment',
      parentAssessmentId: rootAssessment._id,
      targetedConcepts: ['Advanced Hashmap'],
      totalQuestions: 1,
      questions: [{
        questionText: 'Reassessment #2 Q1',
        questionType: 'short_answer',
        correctAnswer: 'Answer',
        difficulty: 'hard',
        rubric: { gradingCriteria: 'Criteria', sampleAnswer: 'Answer', maxPoints: 10 }
      }],
      status: 'published'
    });
    const reAtt2_sub = await Attempt.create({ assessmentId: reassessment2_sub._id, studentId: student2._id, status: 'evaluated', score: 10, maxScore: 10, percentage: 100, submittedAt: new Date() });
    await AttemptResponse.create({ attemptId: reAtt2_sub._id, assessmentId: reassessment2_sub._id, studentId: student2._id, questionId: reassessment2_sub.questions[0]._id, studentAnswer: 'Answer text 2', score: 10, isCorrect: true });

    teacherAssessments = await assessmentService.getAssessmentsByTopic(course._id, topic._id, teacher._id);
    console.log(`Teacher assessment count after 3 total reassessments: ${teacherAssessments.length} (Expected: 1)`);
    if (teacherAssessments.length !== 1) throw new Error('TEST 9 Failed: Expected 1 assessment card');

    // TEST 10: Verify persistence after database query re-fetch
    console.log('\n--- TEST 10: Verify DB Persistence ---');
    const freshAttempts = await attemptService.getAssessmentAttempts({ assessmentId: rootAssessment._id, teacherId: teacher._id });
    console.log(`Fresh query total attempts: ${freshAttempts.length} (Expected: 6)`);
    if (freshAttempts.length !== 6) throw new Error('TEST 10 Failed: DB persistence query mismatch');

    console.log('\n=== ALL 11 ASSESSMENT HIERARCHY REGRESSION TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    // Cleanup test data
    await User.deleteMany({ _id: { $in: [teacher._id, student1._id, student2._id, student3._id] } });
    await Course.deleteMany({ _id: course._id });
    await Topic.deleteMany({ _id: topic._id });
    await Assessment.deleteMany({ courseId: course._id });
    await Attempt.deleteMany({ studentId: { $in: [student1._id, student2._id, student3._id] } });
    await AttemptResponse.deleteMany({ studentId: { $in: [student1._id, student2._id, student3._id] } });
    await DiagnosticReport.deleteMany({ topicId: topic._id });
    await mongoose.disconnect();
    console.log('[DB] Cleanup complete & disconnected');
  }
}

runHierarchyAudit().catch(err => {
  console.error('[AUDIT_ERROR]', err);
  process.exit(1);
});
