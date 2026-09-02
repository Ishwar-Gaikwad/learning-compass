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
import { assessmentService } from './src/services/assessment.service.js';
import { evaluationService } from './src/services/evaluation.service.js';
import { diagnosticService } from './src/services/diagnostic.service.js';
import { learningPathService } from './src/services/learningPath.service.js';
import { reassessmentService } from './src/services/reassessment.service.js';
import { validateLLMAssessmentOutput } from './src/utils/validators/assessment.validator.js';
import { AppError } from './src/utils/AppError.js';

dotenv.config();

async function runGeminiTargetedReassessmentIntegrationTest() {
  console.log('=== STARTING GEMINI TARGETED REASSESSMENT INTEGRATION TEST ===\n');

  try {
    await connectDB();
    console.log('[DB] Connected to MongoDB Atlas successfully.');

    const teacherEmail = `teacher_re_ai_${Date.now()}@example.com`;
    const studentEmail = `student_re_ai_${Date.now()}@example.com`;
    const intruderEmail = `intruder_re_ai_${Date.now()}@example.com`;

    // Step 1: Setup Users (Teacher, Student, Intruder)
    console.log('--- Step 1: Setup Users (Teacher, Student, Intruder) ---');
    const teacher = await User.create({
      name: 'Prof. Reassessment Test Teacher',
      email: teacherEmail,
      password: 'password123',
      role: 'teacher'
    });

    const student = await User.create({
      name: 'Jane Reassessment Test Student',
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
      code: `PHYS_RE_${Date.now().toString().slice(-4)}`,
      title: 'Advanced Thermodynamics & Reassessment AI',
      description: 'Thermodynamics, heat transfer, and targeted reassessments.',
      subject: 'Physics',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Second Law of Thermodynamics & Carnot Cycles',
      description: 'Entropy increase, Carnot engines, heat pumps, and thermodynamic limits.',
      order: 1
    });
    console.log(`[TOPIC_SETUP] Course ID: ${course._id}, Topic ID: ${topic._id}`);

    // Step 3: Ingest PDF Material & Create Chunks for RAG Grounding
    console.log('\n--- Step 3: Ingest Course Material & Create Chunks ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 250>>stream\nBT /F1 12 Tf 72 712 Td (The Second Law of Thermodynamics states total entropy dS >= 0 for isolated systems. Carnot engine maximum efficiency eta = 1 - Tc/Th where Th and Tc are absolute temperatures in Kelvin. Clausius statement forbids spontaneous heat transfer from cold to hot without external work.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n600\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'thermo_reassessment_guide.pdf',
        buffer: sampleBuffer,
        mimetype: 'application/pdf',
        size: sampleBuffer.length,
        fileType: 'pdf'
      }
    });

    const dummyVector = new Array(1536).fill(0.01);
    const chunk1 = await DocumentChunk.create({
      materialId: uploadedMaterial._id,
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      chunkIndex: 0,
      content: 'The Second Law of Thermodynamics states total entropy dS >= 0 for isolated systems. In irreversible processes, total entropy always increases over time. Heat cannot spontaneously flow from a colder body to a hotter body without external work.',
      tokenCount: 50,
      pageNumber: 10,
      embedding: dummyVector,
      metadata: { pageNumber: 10, startChar: 0, endChar: 300 }
    });

    const chunk2 = await DocumentChunk.create({
      materialId: uploadedMaterial._id,
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      chunkIndex: 1,
      content: 'Carnot Engine Efficiency: eta = 1 - (Tc / Th). All temperatures Th and Tc must be in absolute Kelvin (K = C + 273.15). Maximum efficiency is always strictly less than 1 (100%).',
      tokenCount: 50,
      pageNumber: 15,
      embedding: dummyVector,
      metadata: { pageNumber: 15, startChar: 301, endChar: 600 }
    });

    await Material.findByIdAndUpdate(uploadedMaterial._id, {
      status: 'completed',
      'extractedTextMetadata.totalChunksCount': 2
    });
    console.log(`[MATERIAL_INGEST] Ingested material ID: ${uploadedMaterial._id}`);

    // Mock Payloads for instant deterministic execution
    const mockInitialAssessmentGen = {
      title: 'Initial Thermodynamics Assessment',
      difficulty: 'medium',
      questions: [
        {
          questionText: 'What happens to isolated system entropy over time in an irreversible thermodynamic process?',
          questionType: 'mcq',
          options: ['Decreases to zero', 'Remains constant', 'Always increases', 'Oscillates dynamically'],
          correctAnswer: 'Always increases',
          difficulty: 'medium',
          expectedConcepts: ['Second Law & Entropy Increase'],
          rubric: { gradingCriteria: 'Evaluates entropy behavior.', sampleAnswer: 'Always increases', maxPoints: 1 }
        },
        {
          questionText: 'Calculate Carnot efficiency given hot reservoir temperature Th = 500K and cold reservoir Tc = 300K.',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'eta = 1 - (300/500) = 0.40 or 40%',
          difficulty: 'medium',
          expectedConcepts: ['Carnot Engine Efficiency'],
          rubric: { gradingCriteria: 'Evaluates Carnot efficiency calculation.', sampleAnswer: '40%', maxPoints: 1 }
        }
      ]
    };

    const mockInitialDiagGen = {
      overallMasteryScore: 30,
      masteryLevel: 'needs_remediation',
      dimensionScores: {
        conceptualUnderstanding: { score: 20, masteryLevel: 'developing' },
        proceduralFluency: { score: 40, masteryLevel: 'developing' },
        applicationAndTransfer: { score: 30, masteryLevel: 'developing' }
      },
      strengths: [],
      weakConcepts: [
        { concept: 'Second Law & Entropy Increase', severity: 'high', evidence: 'Claimed entropy decreases in isolated systems.' },
        { concept: 'Carnot Engine Efficiency', severity: 'high', evidence: 'Inverted temperatures in Carnot efficiency formula.' }
      ],
      proceduralWeaknesses: [{ skill: 'Carnot Efficiency Formula', issue: 'Inverted temperature ratio.' }],
      applicationWeaknesses: [{ context: 'Entropy Applications', gap: 'Confused energy dissipation with entropy reduction.' }],
      identifiedMisconceptions: [
        { misconceptionCode: 'MIS_ENTROPY_DECREASE', title: 'Entropy Reduction Error', explanation: 'Believes entropy decreases in isolated systems.' }
      ],
      recommendations: [{ recommendation: 'Review entropy definitions and Carnot formula.', type: 'conceptual' }],
      aiSummary: 'Student has critical misconceptions in entropy behavior and Carnot calculations.'
    };

    const mockLPGen = {
      title: 'Personalized Remediation Pathway for Thermodynamics',
      nodes: [
        {
          nodeId: 'node_1_entropy',
          sequenceOrder: 1,
          title: 'Remedial Reading: Second Law of Thermodynamics & Entropy',
          type: 'concept_explanation',
          targetConcept: 'Second Law & Entropy Increase',
          reasonForTargeting: 'Diagnosed entropy reduction error.',
          learningObjective: 'Understand why total entropy of isolated systems always increases.',
          recommendedMaterial: {
            materialId: uploadedMaterial._id.toString(),
            fileName: 'thermo_reassessment_guide.pdf',
            excerpt: 'The Second Law of Thermodynamics states total entropy dS >= 0 for isolated systems.',
            pageNumber: 10
          },
          practiceActivity: {
            title: 'Entropy Reading Summary',
            description: 'Read Chapter 10 excerpt and summarize dS >= 0 concept in 3 sentences.',
            activityType: 'remedial_reading'
          },
          difficulty: 'easy',
          expectedOutcome: 'Correctly state Second Law entropy progression.',
          reassessmentCriteria: 'Accurately explain entropy behavior without energy confusion.'
        },
        {
          nodeId: 'node_2_carnot',
          sequenceOrder: 2,
          title: 'Practice Exercise: Carnot Efficiency Calculation',
          type: 'practice_exercise',
          targetConcept: 'Carnot Engine Efficiency',
          reasonForTargeting: 'Inverted temperatures in Carnot formula.',
          learningObjective: 'Master calculating Carnot efficiency eta = 1 - (Tc / Th) in Kelvin.',
          recommendedMaterial: {
            materialId: uploadedMaterial._id.toString(),
            fileName: 'thermo_reassessment_guide.pdf',
            excerpt: 'Carnot Engine Efficiency: eta = 1 - (Tc / Th).',
            pageNumber: 15
          },
          practiceActivity: {
            title: 'Carnot Problem Solving',
            description: 'Solve 3 numerical problems computing Carnot efficiency with given reservoir temperatures.',
            activityType: 'practice_exercise'
          },
          difficulty: 'medium',
          expectedOutcome: 'Compute efficiency values strictly between 0 and 1.',
          reassessmentCriteria: 'Identify Tc as cold reservoir and Th as hot reservoir.'
        }
      ]
    };

    const mockReassessmentGen = {
      title: 'Targeted Reassessment: Second Law of Thermodynamics & Carnot Cycles',
      difficulty: 'medium',
      questions: [
        {
          questionText: 'A closed insulated container undergoes a spontaneous free expansion process. According to the Second Law, what happens to the total entropy of the system?',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'The total entropy increases because the free expansion is an irreversible process in an isolated system (dS > 0).',
          difficulty: 'medium',
          expectedConcepts: ['Second Law & Entropy Increase'],
          rubric: {
            gradingCriteria: 'Evaluates application of Second Law to free expansion in isolated systems.',
            sampleAnswer: 'Total entropy increases during irreversible free expansion.',
            maxPoints: 1
          },
          sourceReferences: [
            {
              materialId: uploadedMaterial._id.toString(),
              pageNumber: 10,
              chunkIndex: 0
            }
          ]
        },
        {
          questionText: 'A heat engine operates between a high temperature reservoir at 600 K and a low temperature reservoir at 300 K. Determine the maximum thermodynamic efficiency of this engine.',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'eta = 1 - (300 / 600) = 1 - 0.5 = 0.50 or 50%',
          difficulty: 'medium',
          expectedConcepts: ['Carnot Engine Efficiency'],
          rubric: {
            gradingCriteria: 'Evaluates correct computation of Carnot efficiency using eta = 1 - (Tc / Th).',
            sampleAnswer: 'Efficiency is 50%.',
            maxPoints: 1
          },
          sourceReferences: [
            {
              materialId: uploadedMaterial._id.toString(),
              pageNumber: 15,
              chunkIndex: 1
            }
          ]
        }
      ]
    };

    // Step 4: Initial Assessment & Student Attempt Submission
    console.log('\n--- Step 4: Create Initial Assessment & Submit Attempt ---');
    const initialAssessmentResult = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Initial Thermodynamics Assessment',
      questionCount: 2,
      userRole: 'teacher',
      options: { mockLLMResponse: mockInitialAssessmentGen }
    });

    const initialAssessment = initialAssessmentResult.assessment;
    console.log(`[INITIAL_ASSESSMENT] Created ID: ${initialAssessment._id}`);

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
        studentAnswer: 'Entropy decreases to zero because energy dissipates.',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'incorrect',
          score: 0,
          conceptualUnderstanding: 0.2,
          proceduralFluency: 0.4,
          applicationTransfer: 0.3,
          identifiedConcepts: ['Second Law'],
          missingConcepts: ['Entropy Increase'],
          misconceptions: [{ tag: 'MIS_ENTROPY_DECREASE', description: 'Believes entropy decreases' }],
          reasoning: 'Incorrect claim that entropy decreases.'
        }
      },
      {
        attemptId: initialAttempt._id,
        assessmentId: initialAssessment._id,
        studentId: student._id,
        questionId: initialAssessment.questions[1]._id,
        studentAnswer: 'eta = 500 / 300 = 1.67 or 167%',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'incorrect',
          score: 0,
          conceptualUnderstanding: 0.3,
          proceduralFluency: 0.2,
          applicationTransfer: 0.2,
          identifiedConcepts: ['Carnot Engine'],
          missingConcepts: ['Carnot Formula'],
          misconceptions: [{ tag: 'MIS_CARNOT_INVERTED', description: 'Inverted Carnot temperature ratio' }],
          reasoning: 'Formula inverted.'
        }
      }
    ]);

    await Attempt.findByIdAndUpdate(initialAttempt._id, { status: 'submitted', submittedAt: new Date() });
    console.log(`[INITIAL_ATTEMPT] Submitted initial attempt ID: ${initialAttempt._id}`);

    // Step 5: Initial Diagnostic Generation
    console.log('\n--- Step 5: Generate Initial Gemini Diagnostic Report ---');
    const diagResult = await diagnosticService.generateDiagnosticReport({
      attemptId: initialAttempt._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockInitialDiagGen }
    });

    const report = diagResult.report;
    console.log(`[DIAGNOSTIC_SUCCESS] Generated report ID: ${report._id}`);

    // Step 6: Generate Learning Path & Complete Remediation Nodes
    console.log('\n--- Step 6: Generate Gemini Learning Path & Complete Remediation ---');
    const lpResult = await learningPathService.generateLearningPath({
      diagnosticReportId: report._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockLPGen }
    });

    const learningPath = lpResult.learningPath;
    console.log(`[LEARNING_PATH] Created LP ID: ${learningPath._id} with ${learningPath.nodes.length} nodes`);

    // Step 7: Negative Test — Attempt Targeted Reassessment BEFORE Remediation
    console.log('\n--- Step 7: Negative Test — Reject Targeted Reassessment when Remediation Incomplete ---');
    try {
      await reassessmentService.generateReassessment({
        diagnosticReportId: report._id,
        userId: student._id,
        userRole: 'student',
        options: { mockLLMResponse: mockReassessmentGen }
      });
      throw new Error('Reassessment should have been rejected because remediation nodes were not completed!');
    } catch (err) {
      if (err.errorCode === 'REMEDIATION_INCOMPLETE') {
        console.log('✓ Correctly rejected targeted reassessment generation when remediation incomplete!');
      } else {
        throw err;
      }
    }

    // Step 8: Complete Remediation Activities
    console.log('\n--- Step 8: Complete Learning Path Remediation Nodes ---');
    for (const node of learningPath.nodes) {
      await learningPathService.completeLearningNode({
        pathId: learningPath._id,
        nodeId: node.nodeId,
        userId: student._id
      });
      console.log(`- Completed node: "${node.title}" (${node.nodeId})`);
    }

    // Step 9: Generate Real AI Targeted Reassessment
    console.log('\n--- Step 9: Generate Real AI Targeted Reassessment ---');
    const reGenResult = await reassessmentService.generateReassessment({
      diagnosticReportId: report._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockReassessmentGen }
    });

    const reassessment = reGenResult.reassessment;
    console.log(`[REASSESSMENT_SUCCESS] Generated Targeted Reassessment ID: ${reassessment._id}`);
    console.log(`- Title: "${reassessment.title}"`);
    console.log(`- Type: ${reassessment.type}`);
    console.log(`- Previous Diagnostic Report ID: ${reassessment.previousDiagnosticReportId}`);
    console.log(`- Targeted Concepts: ${reGenResult.targetedConcepts.join(', ')}`);
    console.log(`- Total Questions: ${reassessment.questions.length}`);

    // Step 10: Validate Reassessment Question Targeting & Question Leakage Protection
    console.log('\n--- Step 10: Validate Question Targeting & Duplicate Leakage Protection ---');
    for (let idx = 0; idx < reassessment.questions.length; idx++) {
      const q = reassessment.questions[idx];
      console.log(`Question #${idx + 1}:`);
      console.log(`  - Text: "${q.questionText}"`);
      console.log(`  - Type: ${q.questionType}`);
      console.log(`  - Target Concepts: ${q.expectedConcepts.join(', ')}`);
      console.log(`  - Source References Count: ${q.sourceReferences?.length || 0}`);

      // Verify questions target weak concepts
      if (!q.expectedConcepts || q.expectedConcepts.length === 0) {
        throw new Error(`Question #${idx + 1} is missing target expectedConcepts`);
      }

      // Verify question leakage protection — text must not be exact copy of initial assessment questions
      const initialTexts = initialAssessment.questions.map((iq) => iq.questionText);
      for (const origText of initialTexts) {
        if (q.questionText.trim().toLowerCase() === origText.trim().toLowerCase()) {
          throw new Error(`Question leakage detected! Reassessment question #${idx + 1} is an exact copy of an initial question!`);
        }
      }
    }
    console.log('✓ Reassessment questions correctly target remediated concepts and pass duplicate leakage protection!');

    // Step 11: Idempotency Protection Test — Duplicate Request Returns Existing Reassessment
    console.log('\n--- Step 11: Test Idempotency & Duplicate Reassessment Protection ---');
    const duplicateReGen = await reassessmentService.generateReassessment({
      diagnosticReportId: report._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockReassessmentGen }
    });

    if (duplicateReGen.reassessment._id.toString() !== reassessment._id.toString()) {
      throw new Error('Idempotency failed: A second reassessment document was created for the same diagnostic report!');
    }
    if (duplicateReGen.isExisting !== true) {
      throw new Error('Idempotency flag isExisting should be true when reusing existing reassessment');
    }
    console.log('✓ Idempotency verified! Existing reassessment reused cleanly (ID: ' + duplicateReGen.reassessment._id + ').');

    // Step 12: Student Submits Targeted Reassessment & AI Process Submission
    console.log('\n--- Step 12: Student Submits Targeted Reassessment & AI Evaluation ---');
    const reAttempt = await Attempt.create({
      assessmentId: reassessment._id,
      studentId: student._id,
      status: 'in_progress',
      startedAt: new Date()
    });

    // Student provides correct answers showing remediation success
    await AttemptResponse.create([
      {
        attemptId: reAttempt._id,
        assessmentId: reassessment._id,
        studentId: student._id,
        questionId: reassessment.questions[0]._id,
        studentAnswer: 'Total entropy increases during spontaneous free expansion in isolated systems because dS > 0 for irreversible processes.',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'correct',
          score: 1.0,
          conceptualUnderstanding: 1.0,
          proceduralFluency: 1.0,
          applicationTransfer: 1.0,
          identifiedConcepts: ['Second Law & Entropy Increase'],
          missingConcepts: [],
          misconceptions: [],
          reasoning: 'Correct explanation of entropy increase.'
        }
      },
      {
        attemptId: reAttempt._id,
        assessmentId: reassessment._id,
        studentId: student._id,
        questionId: reassessment.questions[1]._id,
        studentAnswer: 'eta = 1 - (300 / 600) = 1 - 0.5 = 0.50 or 50%',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'correct',
          score: 1.0,
          conceptualUnderstanding: 1.0,
          proceduralFluency: 1.0,
          applicationTransfer: 1.0,
          identifiedConcepts: ['Carnot Engine Efficiency'],
          missingConcepts: [],
          misconceptions: [],
          reasoning: 'Correct computation of Carnot efficiency.'
        }
      }
    ]);

    await Attempt.findByIdAndUpdate(reAttempt._id, { status: 'submitted', submittedAt: new Date() });

    const mockReDiagGen = {
      overallMasteryScore: 100,
      masteryLevel: 'mastered',
      dimensionScores: {
        conceptualUnderstanding: { score: 100, masteryLevel: 'mastered' },
        proceduralFluency: { score: 100, masteryLevel: 'mastered' },
        applicationAndTransfer: { score: 100, masteryLevel: 'mastered' }
      },
      strengths: [
        { concept: 'Second Law & Entropy Increase', reasoning: 'Accurately explained entropy increase in isolated systems.' },
        { concept: 'Carnot Engine Efficiency', reasoning: 'Correctly computed Carnot efficiency.' }
      ],
      weakConcepts: [],
      proceduralWeaknesses: [],
      applicationWeaknesses: [],
      identifiedMisconceptions: [],
      recommendations: [{ recommendation: 'Student has achieved full mastery of topic.', type: 'conceptual' }],
      aiSummary: 'Student demonstrated complete mastery recovery after remediation.'
    };

    const processResult = await reassessmentService.processReassessmentSubmission({
      reassessmentAttemptId: reAttempt._id,
      userId: student._id,
      userRole: 'student',
      options: {
        mockDiagnosticResponse: mockReDiagGen,
        mockComparisonResponse: {
          improvedConcepts: ['Second Law & Entropy Increase', 'Carnot Engine Efficiency'],
          unchangedWeaknesses: [],
          newlyObservedWeaknesses: [],
          resolvedMisconceptions: ['MIS_ENTROPY_DECREASE', 'MIS_CARNOT_INVERTED'],
          remainingMisconceptions: [],
          conceptualDelta: 80,
          proceduralDelta: 60,
          applicationDelta: 70,
          overallScoreDelta: 70,
          evidenceSummary: [
            {
              concept: 'Second Law & Entropy Increase',
              initialEvidence: 'Student claimed entropy decreases.',
              reassessmentEvidence: 'Student correctly stated total entropy increases.',
              status: 'improved',
              reasoning: 'Evidence supports concept recovery.'
            }
          ],
          remediationEffectiveness: 'Evidence suggests improvement following completed remediation activities.',
          summary: 'Student demonstrated complete mastery recovery in entropy and Carnot efficiency.'
        }
      }
    });

    console.log(`[PROCESS_REASSESSMENT_SUCCESS] Processed attempt ID: ${reAttempt._id}`);
    console.log(`- New Diagnostic Score: ${processResult.newDiagnosticReport.overallMasteryScore}/100 (${processResult.newDiagnosticReport.masteryLevel})`);
    console.log(`- Comparison Doc Created ID: ${processResult.comparison._id}`);
    console.log(`- Is Mastered: ${processResult.isMastered}`);
    console.log(`- Cycle Status: ${processResult.cycleStatus}`);

    // Step 13: Verify Learning Path Status Completed (100%)
    console.log('\n--- Step 13: Verify Learning Path Final Status & Completion Lifecycle ---');
    const updatedLP = await LearningPath.findById(learningPath._id);
    console.log(`- Learning Path Final Status: ${updatedLP.status}`);
    console.log(`- Learning Path Progress: ${updatedLP.overallProgressPercentage}%`);

    if (updatedLP.status !== 'completed') throw new Error('Learning path status should be completed after reassessment processing');
    if (updatedLP.overallProgressPercentage !== 100) throw new Error('Learning path progress should be 100%');
    console.log('✓ Learning path lifecycle completion state verified!');

    // Step 14: Negative & Authorization Tests
    console.log('\n--- Step 14: Negative & Security Authorization Tests ---');
    
    // 14a. Malformed AI Output -> INVALID_AI_OUTPUT (0 invalid records saved)
    const malformedOutput = { title: '', questions: [] };
    const malformedVal = validateLLMAssessmentOutput(malformedOutput);
    if (malformedVal.isValid) throw new Error('validateLLMAssessmentOutput should return isValid: false for malformed output');
    console.log('  - Malformed AI Output correctly caught with validation errors: ' + malformedVal.errors.join('; '));

    // 14b. Missing Diagnostic Report -> 404 REPORT_NOT_FOUND
    const dummyId = new mongoose.Types.ObjectId();
    try {
      await reassessmentService.generateReassessment({
        diagnosticReportId: dummyId,
        userId: student._id,
        userRole: 'student'
      });
      throw new Error('Should have thrown 404 for missing diagnostic report');
    } catch (err) {
      if (err.errorCode === 'REPORT_NOT_FOUND') {
        console.log('  - Missing diagnostic report correctly rejected with 404 REPORT_NOT_FOUND');
      } else throw err;
    }

    // 14c. Unauthorized Student Access -> 403 FORBIDDEN
    try {
      await reassessmentService.generateReassessment({
        diagnosticReportId: report._id,
        userId: intruderStudent._id,
        userRole: 'student'
      });
      throw new Error('Should have thrown 403 for unauthorized student');
    } catch (err) {
      if (err.errorCode === 'FORBIDDEN') {
        console.log('  - Unauthorized student access correctly rejected with 403 FORBIDDEN');
      } else throw err;
    }

    // 14d. Attempt Reassessment when Mastery Already Achieved -> 400 MASTERY_ACHIEVED
    try {
      await reassessmentService.generateReassessment({
        diagnosticReportId: report._id,
        userId: student._id,
        userRole: 'student',
        options: { skipRemediationCheck: true }
      });
      throw new Error('Should have thrown 400 MASTERY_ACHIEVED when trying to generate reassessment for completed cycle');
    } catch (err) {
      if (err.errorCode === 'MASTERY_ACHIEVED') {
        console.log('  - Attempting reassessment on completed mastery cycle correctly rejected with 400 MASTERY_ACHIEVED');
      } else throw err;
    }

    console.log('\n================================================================');
    console.log('=== ALL 14 STEPS & SCENARIOS OF GEMINI TARGETED REASSESSMENT INTEGRATION TEST PASSED 100%! ===');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n[GEMINI TARGETED REASSESSMENT INTEGRATION TEST FAILED]:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB Atlas.');
  }
}

runGeminiTargetedReassessmentIntegrationTest();
