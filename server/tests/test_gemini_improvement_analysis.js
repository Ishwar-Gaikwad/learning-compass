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
import { assessmentService } from './src/services/assessment.service.js';
import { diagnosticService } from './src/services/diagnostic.service.js';
import { learningPathService } from './src/services/learningPath.service.js';
import { reassessmentService } from './src/services/reassessment.service.js';
import { comparisonService } from './src/services/comparison.service.js';
import { validateComparisonOutput } from './src/utils/validators/comparison.validator.js';

dotenv.config();

async function runGeminiImprovementAnalysisIntegrationTest() {
  console.log('=== STARTING GEMINI IMPROVEMENT ANALYSIS INTEGRATION TEST ===\n');

  try {
    await connectDB();
    console.log('[DB] Connected to MongoDB Atlas successfully.');

    const teacherEmail = `teacher_imp_ai_${Date.now()}@example.com`;
    const studentEmail = `student_imp_ai_${Date.now()}@example.com`;
    const intruderEmail = `intruder_imp_ai_${Date.now()}@example.com`;

    // Step 1: Setup Users (Teacher, Student, Intruder)
    console.log('--- Step 1: Setup Users (Teacher, Student, Intruder) ---');
    const teacher = await User.create({
      name: 'Prof. Improvement Test Teacher',
      email: teacherEmail,
      password: 'password123',
      role: 'teacher'
    });

    const student = await User.create({
      name: 'Jane Improvement Test Student',
      email: studentEmail,
      password: 'password123',
      role: 'student'
    });

    const intruderStudent = await User.create({
      name: 'Bob Intruder Student',
      email: intruderEmail,
      password: 'password123',
      role: 'student'
    });
    console.log(`[USER_SETUP] Teacher ID: ${teacher._id}, Student ID: ${student._id}`);

    // Step 2: Create Course & Topic
    console.log('\n--- Step 2: Setup Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `MATH_IMP_${Date.now().toString().slice(-4)}`,
      title: 'Advanced Calculus & AI Improvement Analysis',
      description: 'Calculus, differentiation, integration, and improvement analysis.',
      subject: 'Mathematics',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Limits & Derivatives Fundamentals',
      description: 'Understanding limits, slope of tangent lines, and derivative rules.',
      order: 1
    });
    console.log(`[TOPIC_SETUP] Course ID: ${course._id}, Topic ID: ${topic._id}`);

    // Step 3: Ingest PDF Material & Create Chunks for RAG Grounding
    console.log('\n--- Step 3: Ingest Course Material & Create Chunks ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 250>>stream\nBT /F1 12 Tf 72 712 Td (The derivative of f(x) = x^n is f\'(x) = n*x^(n-1) according to the Power Rule. Product Rule states d/dx[u*v] = u\'*v + u*v\'. Quotient Rule states d/dx[u/v] = (u\'*v - u*v\') / v^2.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n600\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'calculus_derivatives_guide.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      }
    });

    const dummyVector = new Array(1536).fill(0.01);
    await DocumentChunk.create({
      materialId: uploadedMaterial._id,
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      chunkIndex: 0,
      content: 'Power Rule for Differentiation: d/dx(x^n) = n * x^(n-1). For example, derivative of x^3 is 3x^2. Product Rule: d/dx(u*v) = u\'*v + u*v\'. Quotient Rule: d/dx(u/v) = (u\'*v - u*v\') / (v^2).',
      tokenCount: 50,
      pageNumber: 5,
      embedding: dummyVector,
      metadata: { pageNumber: 5, startChar: 0, endChar: 300 }
    });

    await Material.findByIdAndUpdate(uploadedMaterial._id, {
      status: 'completed',
      'extractedTextMetadata.totalChunksCount': 1
    });
    console.log(`[MATERIAL_INGEST] Ingested material ID: ${uploadedMaterial._id}`);

    // Mock AI Payloads for deterministic testing
    const mockInitialAssessmentGen = {
      title: 'Calculus Diagnostic Assessment',
      difficulty: 'medium',
      questions: [
        {
          questionText: 'Find the derivative of f(x) = x^4 using the Power Rule.',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'f\'(x) = 4x^3',
          difficulty: 'medium',
          expectedConcepts: ['Power Rule Differentiation'],
          rubric: { gradingCriteria: 'Evaluates power rule.', sampleAnswer: '4x^3', maxPoints: 1 }
        },
        {
          questionText: 'State the Product Rule for differentiating two functions u(x) and v(x).',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'd/dx[u*v] = u\'*v + u*v\'',
          difficulty: 'medium',
          expectedConcepts: ['Product Rule Differentiation'],
          rubric: { gradingCriteria: 'Evaluates product rule.', sampleAnswer: 'u\'v + uv\'', maxPoints: 1 }
        }
      ]
    };

    const mockInitialDiagGen = {
      overallMasteryScore: 25,
      masteryLevel: 'needs_remediation',
      dimensionScores: {
        conceptualUnderstanding: { score: 20, masteryLevel: 'developing' },
        proceduralFluency: { score: 30, masteryLevel: 'developing' },
        applicationAndTransfer: { score: 25, masteryLevel: 'developing' }
      },
      strengths: [],
      weakConcepts: [
        { concept: 'Power Rule Differentiation', severity: 'high', evidence: 'Student added exponent to coefficient: x^4 -> 4x^4.' },
        { concept: 'Product Rule Differentiation', severity: 'high', evidence: 'Student simply multiplied individual derivatives: (u*v)\' = u\' * v\'.' }
      ],
      proceduralWeaknesses: [{ skill: 'Power Rule Exponent Reduction', issue: 'Forgot to subtract 1 from exponent.' }],
      applicationWeaknesses: [{ context: 'Product Rule Application', gap: 'Direct product of derivatives instead of sum rule.' }],
      identifiedMisconceptions: [
        { misconceptionCode: 'MIS_PRODUCT_MULTIPLICATION', title: 'Naive Derivative Multiplication', explanation: 'Believes derivative of product equals product of derivatives.' }
      ],
      recommendations: [{ recommendation: 'Practice Power Rule exponent reduction and Product Rule summation.', type: 'procedural' }],
      aiSummary: 'Student demonstrates critical misconceptions in Power Rule and Product Rule application.'
    };

    const mockLPGen = {
      title: 'Personalized Remediation Pathway for Differentiation',
      nodes: [
        {
          nodeId: 'node_1_power',
          sequenceOrder: 1,
          title: 'Remedial Drill: Power Rule Exponent Reduction',
          type: 'practice_exercise',
          targetConcept: 'Power Rule Differentiation',
          reasonForTargeting: 'Diagnosed failure to decrement exponent.',
          learningObjective: 'Consistently apply d/dx(x^n) = n*x^(n-1).',
          practiceActivity: { title: 'Power Rule Drill', description: 'Complete 5 power rule derivative problems.', activityType: 'practice_exercise' },
          difficulty: 'easy',
          expectedOutcome: 'Correctly reduce power by 1.',
          reassessmentCriteria: 'Subtract 1 from exponent for any power n.'
        },
        {
          nodeId: 'node_2_product',
          sequenceOrder: 2,
          title: 'Concept Video: Product Rule Formula & Proof',
          type: 'concept_explanation',
          targetConcept: 'Product Rule Differentiation',
          reasonForTargeting: 'Naive derivative multiplication error.',
          learningObjective: 'Understand why (u*v)\' = u\'v + uv\' rather than u\'v\'.',
          practiceActivity: { title: 'Product Rule Concept Reading', description: 'Read Product Rule proof and complete 3 examples.', activityType: 'remedial_reading' },
          difficulty: 'medium',
          expectedOutcome: 'Apply u\'v + uv\' correctly.',
          reassessmentCriteria: 'Evaluate product rule without naive multiplication.'
        }
      ]
    };

    const mockReassessmentGen = {
      title: 'Targeted Reassessment: Limits & Derivatives Fundamentals',
      difficulty: 'medium',
      questions: [
        {
          questionText: 'Differentiate g(x) = 5x^6 with respect to x.',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'g\'(x) = 30x^5',
          difficulty: 'medium',
          expectedConcepts: ['Power Rule Differentiation'],
          rubric: { gradingCriteria: 'Evaluates 5 * 6x^5 = 30x^5.', sampleAnswer: '30x^5', maxPoints: 1 }
        },
        {
          questionText: 'Find the derivative of h(x) = x^2 * sin(x).',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'h\'(x) = 2x*sin(x) + x^2*cos(x)',
          difficulty: 'medium',
          expectedConcepts: ['Product Rule Differentiation'],
          rubric: { gradingCriteria: 'Evaluates product rule application.', sampleAnswer: '2x sin(x) + x^2 cos(x)', maxPoints: 1 }
        }
      ]
    };

    const mockReDiagGen = {
      overallMasteryScore: 100,
      masteryLevel: 'mastered',
      dimensionScores: {
        conceptualUnderstanding: { score: 100, masteryLevel: 'mastered' },
        proceduralFluency: { score: 100, masteryLevel: 'mastered' },
        applicationAndTransfer: { score: 100, masteryLevel: 'mastered' }
      },
      strengths: [
        { concept: 'Power Rule Differentiation', reasoning: 'Accurately reduced exponent n-1.' },
        { concept: 'Product Rule Differentiation', reasoning: 'Correctly applied u\'v + uv\' sum.' }
      ],
      weakConcepts: [],
      proceduralWeaknesses: [],
      applicationWeaknesses: [],
      identifiedMisconceptions: [],
      recommendations: [{ recommendation: 'Student has achieved full mastery.', type: 'conceptual' }],
      aiSummary: 'Student demonstrated complete mastery recovery in derivative rules.'
    };

    const mockAIImprovementAnalysis = {
      improvedConcepts: ['Power Rule Differentiation', 'Product Rule Differentiation'],
      unchangedWeaknesses: [],
      newlyObservedWeaknesses: [],
      resolvedMisconceptions: ['Naive Derivative Multiplication'],
      remainingMisconceptions: [],
      conceptualDelta: 80,
      proceduralDelta: 70,
      applicationDelta: 75,
      overallScoreDelta: 75,
      evidenceSummary: [
        {
          concept: 'Power Rule Differentiation',
          initialEvidence: 'Student wrote f\'(x) = 4x^4 (forgot to decrement power).',
          reassessmentEvidence: 'Student wrote g\'(x) = 30x^5 (correctly multiplied coefficient and reduced exponent to 5).',
          status: 'improved',
          reasoning: 'Response evidence confirms student now correctly decrements the exponent according to d/dx(x^n) = n*x^(n-1).'
        },
        {
          concept: 'Product Rule Differentiation',
          initialEvidence: 'Student wrote (u*v)\' = u\' * v\' (naive multiplication).',
          reassessmentEvidence: 'Student wrote h\'(x) = 2x*sin(x) + x^2*cos(x) (applied u\'v + uv\').',
          status: 'improved',
          reasoning: 'Response evidence confirms resolution of naive multiplication misconception with full application of product rule.'
        }
      ],
      remediationEffectiveness: 'Evidence suggests substantial improvement in derivative rules following completed remediation drills.',
      summary: 'The student demonstrated complete concept recovery across both Power Rule and Product Rule differentiation. Initial misconceptions regarding naive derivative multiplication were successfully resolved as evidenced by novel problem solutions.'
    };

    // Step 4: Create Initial Assessment & Submit Attempt
    console.log('\n--- Step 4: Create Initial Assessment & Submit Attempt ---');
    const initialAssessmentResult = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Calculus Diagnostic Assessment',
      questionCount: 2,
      userRole: 'teacher',
      options: { mockLLMResponse: mockInitialAssessmentGen }
    });

    const initialAssessment = initialAssessmentResult.assessment;
    const initialAttempt = await Attempt.create({
      assessmentId: initialAssessment._id,
      studentId: student._id,
      status: 'in_progress',
      startedAt: new Date()
    });

    await AttemptResponse.create([
      {
        attemptId: initialAttempt._id,
        assessmentId: initialAssessment._id,
        studentId: student._id,
        questionId: initialAssessment.questions[0]._id,
        studentAnswer: 'f\'(x) = 4x^4',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'incorrect',
          score: 0,
          conceptualUnderstanding: 0.2,
          proceduralFluency: 0.3,
          applicationTransfer: 0.2,
          identifiedConcepts: ['Power Rule'],
          missingConcepts: ['Exponent Reduction'],
          misconceptions: [],
          reasoning: 'Forgot to subtract 1 from exponent.'
        }
      },
      {
        attemptId: initialAttempt._id,
        assessmentId: initialAssessment._id,
        studentId: student._id,
        questionId: initialAssessment.questions[1]._id,
        studentAnswer: 'd/dx[u*v] = u\' * v\'',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'incorrect',
          score: 0,
          conceptualUnderstanding: 0.1,
          proceduralFluency: 0.2,
          applicationTransfer: 0.1,
          identifiedConcepts: ['Product Rule'],
          missingConcepts: ['Product Rule Formula'],
          misconceptions: [{ tag: 'MIS_PRODUCT_MULTIPLICATION', description: 'Naive derivative multiplication' }],
          reasoning: 'Naively multiplied individual derivatives.'
        }
      }
    ]);

    await Attempt.findByIdAndUpdate(initialAttempt._id, { status: 'submitted', submittedAt: new Date() });
    console.log(`[INITIAL_ATTEMPT] Submitted initial attempt ID: ${initialAttempt._id}`);

    // Step 5: Initial Diagnostic Generation
    console.log('\n--- Step 5: Generate Initial Diagnostic Report ---');
    const diagResult = await diagnosticService.generateDiagnosticReport({
      attemptId: initialAttempt._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockInitialDiagGen }
    });
    const report1 = diagResult.report;
    console.log(`[DIAGNOSTIC_1] Generated report ID: ${report1._id}`);

    // Step 6: Generate Learning Path & Complete Remediation
    console.log('\n--- Step 6: Generate Learning Path & Complete Remediation ---');
    const lpResult = await learningPathService.generateLearningPath({
      diagnosticReportId: report1._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockLPGen }
    });
    const learningPath = lpResult.learningPath;

    for (const node of learningPath.nodes) {
      await learningPathService.completeLearningNode({
        pathId: learningPath._id,
        nodeId: node.nodeId,
        userId: student._id
      });
    }
    console.log(`[REMEDIATION] Completed all ${learningPath.nodes.length} remediation nodes.`);

    // Step 7: Generate Targeted Reassessment & Submit Attempt
    console.log('\n--- Step 7: Generate Targeted Reassessment & Submit Attempt ---');
    const reGenResult = await reassessmentService.generateReassessment({
      diagnosticReportId: report1._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockReassessmentGen }
    });
    const reassessment = reGenResult.reassessment;

    const reAttempt = await Attempt.create({
      assessmentId: reassessment._id,
      studentId: student._id,
      status: 'in_progress',
      startedAt: new Date()
    });

    await AttemptResponse.create([
      {
        attemptId: reAttempt._id,
        assessmentId: reassessment._id,
        studentId: student._id,
        questionId: reassessment.questions[0]._id,
        studentAnswer: 'g\'(x) = 30x^5',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'correct',
          score: 1.0,
          conceptualUnderstanding: 1.0,
          proceduralFluency: 1.0,
          applicationTransfer: 1.0,
          identifiedConcepts: ['Power Rule Differentiation'],
          missingConcepts: [],
          misconceptions: [],
          reasoning: 'Correctly multiplied coefficient and reduced exponent to 5.'
        }
      },
      {
        attemptId: reAttempt._id,
        assessmentId: reassessment._id,
        studentId: student._id,
        questionId: reassessment.questions[1]._id,
        studentAnswer: 'h\'(x) = 2x*sin(x) + x^2*cos(x)',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'correct',
          score: 1.0,
          conceptualUnderstanding: 1.0,
          proceduralFluency: 1.0,
          applicationTransfer: 1.0,
          identifiedConcepts: ['Product Rule Differentiation'],
          missingConcepts: [],
          misconceptions: [],
          reasoning: 'Correctly applied product rule u\'v + uv\'.'
        }
      }
    ]);

    await Attempt.findByIdAndUpdate(reAttempt._id, { status: 'submitted', submittedAt: new Date() });
    console.log(`[REASSESSMENT_ATTEMPT] Submitted reassessment attempt ID: ${reAttempt._id}`);

    // Step 8: Process Reassessment Submission (Generates Report #2 & AI Improvement Analysis)
    console.log('\n--- Step 8: Process Reassessment Submission & Generate AI Improvement Analysis ---');
    const processResult = await reassessmentService.processReassessmentSubmission({
      reassessmentAttemptId: reAttempt._id,
      userId: student._id,
      userRole: 'student',
      options: {
        mockDiagnosticResponse: mockReDiagGen,
        mockComparisonResponse: mockAIImprovementAnalysis
      }
    });

    const comparison = processResult.comparison;
    console.log(`[COMPARISON_SUCCESS] Generated DiagnosticComparison ID: ${comparison._id}`);

    // Step 9: Validate AI Improvement Analysis Output Fields
    console.log('\n--- Step 9: Validate AI Improvement Analysis Fields & Evidence ---');
    console.log(`- Improved Concepts: ${comparison.improvedConcepts.join(', ')}`);
    console.log(`- Resolved Misconceptions: ${comparison.resolvedMisconceptions.join(', ')}`);
    console.log(`- Overall Score Delta: +${comparison.overallScoreDelta}%`);
    console.log(`- Conceptual Delta: +${comparison.conceptualDelta}`);
    console.log(`- Procedural Delta: +${comparison.proceduralDelta}`);
    console.log(`- Remediation Effectiveness: "${comparison.remediationEffectiveness}"`);
    console.log(`- Summary: "${comparison.summary}"`);

    if (!Array.isArray(comparison.improvedConcepts) || comparison.improvedConcepts.length === 0) {
      throw new Error('improvedConcepts array is missing or empty!');
    }

    if (!Array.isArray(comparison.resolvedMisconceptions) || comparison.resolvedMisconceptions.length === 0) {
      throw new Error('resolvedMisconceptions array is missing or empty!');
    }

    if (!Array.isArray(comparison.evidenceSummary) || comparison.evidenceSummary.length === 0) {
      throw new Error('evidenceSummary array is missing or empty!');
    }

    const evItem = comparison.evidenceSummary[0];
    console.log(`\nEvidence Traceability for Concept "${evItem.concept}":`);
    console.log(`  - Initial Evidence: "${evItem.initialEvidence}"`);
    console.log(`  - Reassessment Evidence: "${evItem.reassessmentEvidence}"`);
    console.log(`  - Status: ${evItem.status}`);
    console.log(`  - Reasoning: "${evItem.reasoning}"`);

    if (!evItem.initialEvidence || !evItem.reassessmentEvidence) {
      throw new Error('Evidence traceability item must contain both initialEvidence and reassessmentEvidence!');
    }
    console.log('✓ Evidence-based concept comparison verified!');

    // Step 10: Idempotency & Duplicate Protection Test
    console.log('\n--- Step 10: Test Idempotency & Re-Retrieval ---');
    const retrievedComparison = await comparisonService.getComparisonByAttemptId(
      reAttempt._id,
      student._id,
      'student'
    );

    if (retrievedComparison._id.toString() !== comparison._id.toString()) {
      throw new Error('Idempotency failed: Retrieved comparison ID does not match generated comparison ID!');
    }
    console.log('✓ Idempotency verified! Existing DiagnosticComparison reused cleanly.');

    // Step 11: Teacher Access Verification
    console.log('\n--- Step 11: Verify Teacher Access to Diagnostic Comparison ---');
    const teacherRetrieved = await comparisonService.getComparisonByAttemptId(
      reAttempt._id,
      teacher._id,
      'teacher'
    );
    if (!teacherRetrieved) throw new Error('Teacher could not access student diagnostic comparison!');
    console.log('✓ Teacher authorization and retrieval verified!');

    // Step 12: Negative & Prerequisite State Tests
    console.log('\n--- Step 12: Negative & Prerequisite State Tests ---');

    // 12a. Malformed AI Output -> INVALID_AI_OUTPUT (0 invalid records saved)
    const malformedOutput = { summary: '' };
    const valResult = validateComparisonOutput(malformedOutput);
    if (valResult.isValid) throw new Error('validateComparisonOutput should fail for malformed output!');
    console.log('  - Malformed AI comparison output correctly caught with errors: ' + valResult.errors.join('; '));

    // 12b. Missing Diagnostic Report -> 404 REPORT_NOT_FOUND
    const dummyId = new mongoose.Types.ObjectId();
    try {
      await comparisonService.compareDiagnostics({
        previousReportId: dummyId,
        newReportId: report1._id,
        reassessmentAttemptId: reAttempt._id,
        userId: student._id,
        userRole: 'student'
      });
      throw new Error('Should have thrown 404 for missing diagnostic report');
    } catch (err) {
      if (err.errorCode === 'REPORT_NOT_FOUND') {
        console.log('  - Missing diagnostic report correctly rejected with 404 REPORT_NOT_FOUND');
      } else throw err;
    }

    // 12c. Unauthorized Student Access -> 403 FORBIDDEN
    try {
      await comparisonService.getComparisonByAttemptId(
        reAttempt._id,
        intruderStudent._id,
        'student'
      );
      throw new Error('Should have thrown 403 for unauthorized student');
    } catch (err) {
      if (err.errorCode === 'FORBIDDEN') {
        console.log('  - Unauthorized student access correctly rejected with 403 FORBIDDEN');
      } else throw err;
    }

    console.log('\n================================================================');
    console.log('=== ALL 14 STEPS & SCENARIOS OF GEMINI IMPROVEMENT ANALYSIS INTEGRATION TEST PASSED 100%! ===');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n[GEMINI IMPROVEMENT ANALYSIS INTEGRATION TEST FAILED]:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB Atlas.');
  }
}

runGeminiImprovementAnalysisIntegrationTest();
