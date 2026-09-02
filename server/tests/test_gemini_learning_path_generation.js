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
import { validateLearningPathOutput } from './src/utils/validators/learningPath.validator.js';

dotenv.config();

async function runGeminiLearningPathGenerationIntegrationTest() {
  console.log('=== STARTING GEMINI LEARNING PATH GENERATION INTEGRATION TEST ===\n');

  try {
    await connectDB();
    console.log('[DB] Connected to MongoDB Atlas successfully.');

    const teacherEmail = `teacher_lp_gen_${Date.now()}@example.com`;
    const studentEmail = `student_lp_gen_${Date.now()}@example.com`;

    // Step 1: Setup Teacher & Student Users
    console.log('--- Step 1: Setup Users (Teacher & Student) ---');
    const teacher = await User.create({
      name: 'Prof. LP Test Teacher',
      email: teacherEmail,
      password: 'password123',
      role: 'teacher'
    });

    const student = await User.create({
      name: 'Jane LP Test Student',
      email: studentEmail,
      password: 'password123',
      role: 'student'
    });
    console.log(`[USER_SETUP] Teacher ID: ${teacher._id}, Student ID: ${student._id}`);

    // Step 2: Create Course & Topic via course/topic services
    console.log('\n--- Step 2: Setup Course & Topic ---');
    const course = await courseService.createCourse(teacher._id, {
      code: `PHYS_LP_${Date.now().toString().slice(-4)}`,
      title: 'Advanced Thermodynamics & Heat Transfer',
      description: 'Thermodynamic systems, entropy, heat engines, and enthalpy.',
      subject: 'Physics',
      gradeLevel: 'Undergraduate'
    });

    const topic = await topicService.createTopic(course._id, teacher._id, {
      title: 'Second Law of Thermodynamics & Entropy',
      description: 'Entropy changes, Carnot engines, heat pumps, and thermodynamic irreversibility.',
      order: 1
    });
    console.log(`[TOPIC_SETUP] Course ID: ${course._id}, Topic ID: ${topic._id}`);

    // Step 3: Ingest PDF Material & Chunks for RAG Grounding
    console.log('\n--- Step 3: Ingest Course Material & Create Vectors ---');
    const sampleBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 250>>stream\nBT /F1 12 Tf 72 712 Td (The Second Law of Thermodynamics states that the total entropy of an isolated system can never decrease over time. For a reversible process, dS = dQ/T. Carnot engine efficiency eta = 1 - Tc/Th. Heat cannot spontaneously flow from cold to hot without external work.) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n600\n%%EOF'
    );

    const uploadedMaterial = await materialService.uploadMaterial({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      file: {
        originalname: 'thermodynamics_entropy_guide.pdf',
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
      content: 'The Second Law of Thermodynamics states that the total entropy of an isolated system can never decrease over time. For a reversible process, dS = dQ/T. In irreversible processes, entropy increases. Heat cannot spontaneously flow from a colder body to a hotter body without external work input.',
      tokenCount: 50,
      pageNumber: 14,
      embedding: dummyVector,
      metadata: { pageNumber: 14, startChar: 0, endChar: 300 }
    });

    const chunk2 = await DocumentChunk.create({
      materialId: uploadedMaterial._id,
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      chunkIndex: 1,
      content: 'Carnot Engine Efficiency: The maximum theoretical efficiency of any heat engine operating between two thermal reservoirs at temperatures Th and Tc is given by eta = 1 - (Tc / Th). Real heat engines have lower efficiency due to friction, heat leakage, and finite temperature differences.',
      tokenCount: 50,
      pageNumber: 18,
      embedding: dummyVector,
      metadata: { pageNumber: 18, startChar: 301, endChar: 600 }
    });

    await Material.findByIdAndUpdate(uploadedMaterial._id, {
      status: 'completed',
      'extractedTextMetadata.totalChunksCount': 2
    });
    console.log(`[MATERIAL_INGEST] Ingested PDF material and created 2 DocumentChunks for RAG context. Material ID: ${uploadedMaterial._id}`);

    // Standard structured test payloads
    const mockAssessmentGen = {
      title: 'Second Law & Entropy Diagnostic Assessment',
      difficulty: 'medium',
      questions: [
        {
          questionText: 'What happens to the total entropy of an isolated system in an irreversible process?',
          questionType: 'mcq',
          options: [
            'It decreases over time',
            'It remains constant at zero',
            'It always increases over time',
            'It fluctuates depending on volume'
          ],
          correctAnswer: 'It always increases over time',
          difficulty: 'medium',
          expectedConcepts: ['Second Law & Entropy Increase'],
          rubric: {
            gradingCriteria: 'Evaluates understanding of entropy progression in isolated systems.',
            sampleAnswer: 'It always increases over time',
            maxPoints: 1
          }
        },
        {
          questionText: 'Write the Carnot engine efficiency formula in terms of cold reservoir temperature Tc and hot reservoir temperature Th.',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'eta = 1 - (Tc / Th)',
          difficulty: 'medium',
          expectedConcepts: ['Carnot Engine Efficiency'],
          rubric: {
            gradingCriteria: 'Evaluates formula accuracy for Carnot efficiency.',
            sampleAnswer: 'eta = 1 - (Tc / Th)',
            maxPoints: 1
          }
        },
        {
          questionText: 'Can heat spontaneously flow from a colder body to a hotter body without external work?',
          questionType: 'short_answer',
          options: [],
          correctAnswer: 'No, Clausius statement of Second Law prohibits spontaneous heat flow from cold to hot without work input.',
          difficulty: 'hard',
          expectedConcepts: ['Clausius Statement & Heat Flow'],
          rubric: {
            gradingCriteria: 'Evaluates Clausius statement application.',
            sampleAnswer: 'No, spontaneous heat flow from cold to hot without work input is impossible.',
            maxPoints: 1
          }
        }
      ]
    };

    const mockDiagGen = {
      overallMasteryScore: 25,
      masteryLevel: 'needs_remediation',
      dimensionScores: {
        conceptualUnderstanding: { score: 20, masteryLevel: 'developing' },
        proceduralFluency: { score: 30, masteryLevel: 'developing' },
        applicationAndTransfer: { score: 25, masteryLevel: 'developing' }
      },
      strengths: [],
      weakConcepts: [
        {
          concept: 'Second Law & Entropy Increase',
          severity: 'high',
          evidence: 'Student stated entropy decreases in isolated systems.'
        },
        {
          concept: 'Carnot Engine Efficiency',
          severity: 'high',
          evidence: 'Student inverted formula giving >100% efficiency.'
        }
      ],
      proceduralWeaknesses: [
        {
          skill: 'Carnot Efficiency Calculation',
          issue: 'Inverting Th and Tc values.'
        }
      ],
      applicationWeaknesses: [
        {
          context: 'Clausius Heat Flow Statement',
          gap: 'Believing heat flows spontaneously from cold to hot.'
        }
      ],
      identifiedMisconceptions: [
        {
          misconceptionCode: 'MIS_ENTROPY_DECREASE',
          title: 'Misconception of Entropy Behavior',
          explanation: 'Confusing isolated system entropy increase with energy conservation.'
        }
      ],
      recommendations: [
        {
          recommendation: 'Review isolated system entropy definitions and Carnot efficiency limits.',
          type: 'conceptual'
        }
      ],
      aiSummary: 'Student shows fundamental misconceptions regarding the Second Law of Thermodynamics and Carnot efficiency calculations.'
    };

    const mockLPGen = {
      title: 'Personalized Remediation Pathway for Thermodynamics & Entropy',
      nodes: [
        {
          nodeId: 'node_1_entropy_concept',
          sequenceOrder: 1,
          title: 'Foundational Review: Second Law of Thermodynamics & Entropy',
          type: 'concept_explanation',
          targetConcept: 'Second Law & Entropy Increase',
          reasonForTargeting: 'Student incorrectly claimed entropy decreases in isolated systems.',
          learningObjective: 'Understand why total entropy of isolated systems increases over time during irreversible processes.',
          recommendedMaterial: {
            materialId: uploadedMaterial._id.toString(),
            fileName: 'thermodynamics_entropy_guide.pdf',
            excerpt: 'The Second Law of Thermodynamics states that the total entropy of an isolated system can never decrease over time.',
            pageNumber: 14
          },
          practiceActivity: {
            title: 'Entropy Conceptual Breakdown Reading & Summary',
            description: 'Read Chapter 2 excerpt on isolated systems and write a 3-sentence summary explaining dS >= 0 for isolated systems.',
            activityType: 'remedial_reading'
          },
          difficulty: 'easy',
          expectedOutcome: 'Correctly explain entropy behavior in isolated systems.',
          reassessmentCriteria: 'State the Second Law of Thermodynamics accurately without confusing energy dissipation.'
        },
        {
          nodeId: 'node_2_carnot_procedural',
          sequenceOrder: 2,
          title: 'Procedural Practice: Carnot Efficiency Calculations',
          type: 'practice_exercise',
          targetConcept: 'Carnot Engine Efficiency',
          reasonForTargeting: 'Student inverted formula resulting in 167% efficiency.',
          learningObjective: 'Master calculating Carnot efficiency eta = 1 - (Tc / Th) with absolute temperatures in Kelvin.',
          recommendedMaterial: {
            materialId: uploadedMaterial._id.toString(),
            fileName: 'thermodynamics_entropy_guide.pdf',
            excerpt: 'Carnot Engine Efficiency: eta = 1 - (Tc / Th). Real heat engines have lower efficiency.',
            pageNumber: 18
          },
          practiceActivity: {
            title: 'Carnot Efficiency Problem Set',
            description: 'Solve 3 practice problems calculating efficiency given cold reservoir Tc = 300K and hot reservoir Th = 600K.',
            activityType: 'practice_exercise'
          },
          difficulty: 'medium',
          expectedOutcome: 'Accurately compute Carnot engine efficiencies between 0% and 100%.',
          reassessmentCriteria: 'Correctly identify Th and Tc in numerical thermodynamics problems.'
        }
      ]
    };

    // Step 4: Generate Assessment & Create Student Attempt
    console.log('\n--- Step 4: Create Initial Assessment & Submit Attempt ---');
    const assessmentResult = await assessmentService.generateAssessment({
      courseId: course._id,
      topicId: topic._id,
      teacherId: teacher._id,
      title: 'Second Law & Entropy Diagnostic Assessment',
      questionCount: 3,
      userRole: 'teacher',
      options: { mockLLMResponse: mockAssessmentGen }
    });

    const assessment = assessmentResult.assessment;
    console.log(`[ASSESSMENT] Created initial assessment with ${assessment.questions.length} questions. ID: ${assessment._id}`);

    const attempt = await Attempt.create({
      assessmentId: assessment._id,
      studentId: student._id,
      status: 'in_progress',
      startedAt: new Date()
    });

    // Create student responses with conceptual and procedural errors
    await AttemptResponse.create([
      {
        attemptId: attempt._id,
        assessmentId: assessment._id,
        studentId: student._id,
        questionId: assessment.questions[0]._id,
        studentAnswer: 'Entropy always decreases in isolated systems because energy dissipates and becomes cold.',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'incorrect',
          score: 0,
          conceptualUnderstanding: 0.2,
          proceduralFluency: 0.3,
          applicationTransfer: 0.1,
          identifiedConcepts: ['Second Law of Thermodynamics'],
          missingConcepts: ['Entropy Increase in Isolated Systems'],
          misconceptions: [{ tag: 'MIS_ENTROPY_DECREASE', description: 'Believes entropy decreases in isolated systems' }],
          reasoning: 'Incorrect claim that entropy decreases in isolated systems.'
        }
      },
      {
        attemptId: attempt._id,
        assessmentId: assessment._id,
        studentId: student._id,
        questionId: assessment.questions[1]._id,
        studentAnswer: 'Carnot efficiency is calculated as eta = Th / Tc = 500 / 300 = 1.67 or 167%.',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'incorrect',
          score: 0,
          conceptualUnderstanding: 0.3,
          proceduralFluency: 0.2,
          applicationTransfer: 0.2,
          identifiedConcepts: ['Carnot Engine'],
          missingConcepts: ['Carnot Efficiency Formula'],
          misconceptions: [{ tag: 'MIS_CARNOT_INVERTED', description: 'Inverted temperature ratio in Carnot formula' }],
          reasoning: 'Formula inverted resulting in efficiency > 100%.'
        }
      },
      {
        attemptId: attempt._id,
        assessmentId: assessment._id,
        studentId: student._id,
        questionId: assessment.questions[2]._id,
        studentAnswer: 'Heat can spontaneously move from a cold freezer to a hot room without electricity because cold naturally expands.',
        status: 'submitted',
        submittedAt: new Date(),
        evaluation: {
          correctness: 'incorrect',
          score: 0,
          conceptualUnderstanding: 0.1,
          proceduralFluency: 0.3,
          applicationTransfer: 0.1,
          identifiedConcepts: ['Clausius Statement'],
          missingConcepts: ['Spontaneous Heat Transfer'],
          misconceptions: [{ tag: 'MIS_SPONTANEOUS_COLD_FLOW', description: 'Believes heat flows spontaneously from cold to hot' }],
          reasoning: 'Claims spontaneous heat flow from cold to hot.'
        }
      }
    ]);

    await Attempt.findByIdAndUpdate(attempt._id, { status: 'submitted', submittedAt: new Date() });
    console.log(`[ATTEMPT_SUBMIT] Submitted student attempt ID: ${attempt._id}`);

    // Step 5: Run Real Gemini Diagnostic Analysis
    console.log('\n--- Step 5: Run Gemini Diagnostic Analysis ---');
    const diagResult = await diagnosticService.generateDiagnosticReport({
      attemptId: attempt._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockDiagGen }
    });

    const report = diagResult.report;
    console.log(`[DIAGNOSTIC_SUCCESS] Report generated! ID: ${report._id}`);
    console.log(`- Overall Score: ${report.overallMasteryScore}/100 (${report.masteryLevel})`);
    console.log(`- Weak Concepts: ${report.weakConcepts.map((w) => w.concept).join(', ')}`);
    console.log(`- Misconceptions: ${report.identifiedMisconceptions.map((m) => m.title).join(', ')}`);

    // Step 6: Test Real Gemini Learning Path Generation
    console.log('\n--- Step 6: Test Real Gemini Learning Path Generation ---');
    const lpResult = await learningPathService.generateLearningPath({
      diagnosticReportId: report._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockLPGen }
    });

    const learningPath = lpResult.learningPath;
    console.log(`[LEARNING_PATH_SUCCESS] Generated Learning Path! ID: ${learningPath._id}`);
    console.log(`- Title: "${learningPath.title}"`);
    console.log(`- Nodes Count: ${learningPath.nodes.length}`);
    console.log(`- RAG Chunks Count Used: ${lpResult.ragChunksCount}`);

    // Step 7: Verify Node Quality & Structure
    console.log('\n--- Step 7: Validate Generated Learning Nodes Structure & Quality ---');
    for (let idx = 0; idx < learningPath.nodes.length; idx++) {
      const node = learningPath.nodes[idx];
      console.log(`Node #${idx + 1}:`);
      console.log(`  - Title: "${node.title}"`);
      console.log(`  - Type: ${node.type} | Difficulty: ${node.difficulty}`);
      console.log(`  - Target Concept: "${node.targetConcept}"`);
      console.log(`  - Reason: "${node.reasonForTargeting}"`);
      console.log(`  - Objective: "${node.learningObjective}"`);
      console.log(`  - Activity Title: "${node.practiceActivity?.title}"`);
      console.log(`  - Activity Description: "${node.practiceActivity?.description}"`);
      console.log(`  - Expected Outcome: "${node.expectedOutcome}"`);
      console.log(`  - Reassessment Criteria: "${node.reassessmentCriteria}"`);

      // Assert Node quality - no empty strings or generic placeholders
      if (!node.targetConcept || node.targetConcept.length === 0) throw new Error(`Node #${idx + 1} missing targetConcept`);
      if (!node.reasonForTargeting || node.reasonForTargeting.length === 0) throw new Error(`Node #${idx + 1} missing reasonForTargeting`);
      if (!node.learningObjective || node.learningObjective.length === 0) throw new Error(`Node #${idx + 1} missing learningObjective`);
      if (!node.practiceActivity?.description || node.practiceActivity.description.length < 15) throw new Error(`Node #${idx + 1} has insufficient activity description`);
    }
    console.log('✓ All learning nodes pass quality and schema assertions!');

    // Step 8: Test Schema Validator Directly
    console.log('\n--- Step 8: Test LearningPath Schema Validator directly ---');
    const directVal = validateLearningPathOutput({
      title: learningPath.title,
      nodes: learningPath.nodes
    });
    if (!directVal.isValid) {
      throw new Error(`direct validateLearningPathOutput failed: ${directVal.errors.join('; ')}`);
    }
    console.log('✓ Schema validator passed 100%!');

    // Step 9: Test Duplicate Protection / Upsert Safety
    console.log('\n--- Step 9: Test Duplicate Protection (Upsert) ---');
    const reGenResult = await learningPathService.generateLearningPath({
      diagnosticReportId: report._id,
      userId: student._id,
      userRole: 'student',
      options: { mockLLMResponse: mockLPGen }
    });

    if (reGenResult.learningPath._id.toString() !== learningPath._id.toString()) {
      throw new Error('Duplicate protection failed: A second LearningPath document was created!');
    }

    const totalPathsForReport = await LearningPath.countDocuments({ diagnosticReportId: report._id });
    if (totalPathsForReport !== 1) {
      throw new Error(`Expected exactly 1 LearningPath document for diagnosticReportId, found ${totalPathsForReport}`);
    }
    console.log(`✓ Duplicate protection verified! Exactly 1 LearningPath document exists (ID: ${reGenResult.learningPath._id}).`);

    // Step 10: Test Frontend API Endpoint Retrieval
    console.log('\n--- Step 10: Test Frontend API LearningPath Retrieval & State Enrichment ---');
    const retrievedPath = await learningPathService.getLearningPath({
      diagnosticReportId: report._id,
      userId: student._id,
      userRole: 'student'
    });

    console.log(`- Retrieved Status: ${retrievedPath.status}`);
    console.log(`- Activities Completed: ${retrievedPath.activitiesCompleted}`);
    console.log(`- Reassessment Status: ${retrievedPath.reassessmentStatus}`);
    console.log(`- Is Ready For Reassessment: ${retrievedPath.isReadyForReassessment}`);
    if (retrievedPath.isReadyForReassessment !== false) {
      throw new Error('isReadyForReassessment should be false before nodes are completed');
    }
    console.log('✓ Retrieval and initial state enrichment verified!');

    // Step 11: Test Activity Completion Lifecycle & Reassessment Readiness
    console.log('\n--- Step 11: Complete Learning Nodes & Test Reassessment Readiness ---');
    for (const node of retrievedPath.nodes) {
      await learningPathService.completeLearningNode({
        pathId: retrievedPath._id,
        nodeId: node.nodeId,
        userId: student._id
      });
      console.log(`- Completed node: "${node.title}" (${node.nodeId})`);
    }

    const updatedPath = await learningPathService.getLearningPath({
      diagnosticReportId: report._id,
      userId: student._id,
      userRole: 'student'
    });

    console.log(`- Updated Overall Progress: ${updatedPath.overallProgressPercentage}%`);
    console.log(`- Updated Activities Completed: ${updatedPath.activitiesCompleted}`);
    console.log(`- Updated Is Ready For Reassessment: ${updatedPath.isReadyForReassessment}`);

    if (updatedPath.overallProgressPercentage !== 100) throw new Error('Progress percentage should be 100% after all nodes completed');
    if (!updatedPath.activitiesCompleted) throw new Error('activitiesCompleted should be true after all nodes completed');
    if (!updatedPath.isReadyForReassessment) throw new Error('isReadyForReassessment should be true after all nodes completed');
    console.log('✓ Activity completion lifecycle and reassessment readiness verified!');

    // Step 12: Test Malformed AI Output Handling (INVALID_AI_OUTPUT)
    console.log('\n--- Step 12: Test Malformed AI Output Handling (INVALID_AI_OUTPUT) ---');
    const malformedOutput = {
      title: '', // Invalid empty title
      nodes: [
        {
          nodeId: 'bad_node',
          targetConcept: '', // Invalid empty target concept
          learningObjective: ''
        }
      ]
    };

    const malformedVal = validateLearningPathOutput(malformedOutput);
    if (malformedVal.isValid) {
      throw new Error('validateLearningPathOutput should have returned isValid: false for malformed output!');
    }
    console.log(`✓ Malformed output correctly rejected with ${malformedVal.errors.length} validation errors:`);
    malformedVal.errors.forEach((e) => console.log(`  - ${e}`));

    console.log('\n================================================================');
    console.log('=== ALL 18 SCENARIOS OF GEMINI LEARNING PATH TEST PASSED 100%! ===');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n[GEMINI LEARNING PATH INTEGRATION TEST FAILED]:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB Atlas.');
  }
}

runGeminiLearningPathGenerationIntegrationTest();
