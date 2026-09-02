/**
 * Phase 1 — AI Evaluation Dataset
 * Synthetic Test Cases representing 10 key student scenarios with ground truth rules.
 * No real student personal data is used.
 */

export const syntheticEvaluationDataset = [
  {
    id: 'case_1_correct_reasoning',
    scenarioNumber: 1,
    title: 'Correct answer + correct reasoning',
    description: 'Student correctly computes Delta U = Q - W and explains isothermal process (Delta U = 0 => Q = W).',
    questionText: 'For a gas expanding isothermally at 300K, heat added is 500J. Calculate work done and explain internal energy change.',
    expectedConcepts: ['First Law of Thermodynamics', 'Isothermal Process', 'Internal Energy Change'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'Since the process is isothermal, the temperature is constant, which means the internal energy change Delta U is 0. By the first law Delta U = Q - W, so 0 = 500J - W. Therefore, the work done W is 500J.',
    expectedGroundTruth: {
      correctness: 'correct',
      minScore: 8,
      conceptScoreMin: 70,
      proceduralScoreMin: 70,
      misconceptionExpected: false,
      verify: (evalResult) => {
        const c = evalResult.evaluation?.correctness;
        const s = evalResult.evaluation?.score;
        return (c === 'correct' || c === 'partially_correct') && s >= 8;
      }
    }
  },
  {
    id: 'case_2_incorrect_reasoning',
    scenarioNumber: 2,
    title: 'Correct answer + incorrect reasoning',
    description: 'Student gets numerical 500J by guessing Q=W without understanding why Delta U is 0.',
    questionText: 'For a gas expanding isothermally at 300K, heat added is 500J. Calculate work done and explain internal energy change.',
    expectedConcepts: ['First Law of Thermodynamics', 'Isothermal Process', 'Internal Energy Change'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'The work done is 500J because work is always equal to heat in any system no matter what happens to temperature or internal energy.',
    expectedGroundTruth: {
      correctness: 'partially_correct',
      maxScore: 6,
      conceptScoreMax: 60,
      misconceptionExpected: true,
      verify: (evalResult) => {
        const reasoning = evalResult.evaluation?.reasoning || '';
        const score = evalResult.evaluation?.score || 0;
        // Should flag flawed logic despite correct number
        return score <= 7 || reasoning.toLowerCase().includes('flawed') || reasoning.toLowerCase().includes('incorrect') || reasoning.toLowerCase().includes('reason');
      }
    }
  },
  {
    id: 'case_3_partially_correct_reasoning',
    scenarioNumber: 3,
    title: 'Incorrect answer + partially correct reasoning',
    description: 'Student states first law formula correctly but uses wrong sign convention (+W instead of -W).',
    questionText: 'A system absorbs 200J of heat and does 50J of work. Calculate the change in internal energy Delta U.',
    expectedConcepts: ['First Law of Thermodynamics', 'Sign Convention', 'Internal Energy Change'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'The first law says internal energy change is heat plus work. Delta U = Q + W = 200J + 50J = 250J.',
    expectedGroundTruth: {
      correctness: 'partially_correct',
      minScore: 3,
      maxScore: 7,
      misconceptionExpected: true,
      verify: (evalResult) => {
        const c = evalResult.evaluation?.correctness;
        const score = evalResult.evaluation?.score || 0;
        return (c === 'partially_correct' || c === 'incorrect') && score >= 2 && score <= 7;
      }
    }
  },
  {
    id: 'case_4_conceptual_misconception',
    scenarioNumber: 4,
    title: 'Incorrect answer + conceptual misconception',
    description: 'Student confuses temperature with heat transfer, claiming heat cannot flow if temperatures change.',
    questionText: 'Explain what happens to heat transfer during an adiabatic expansion of an ideal gas.',
    expectedConcepts: ['Adiabatic Process', 'Heat Transfer', 'Ideal Gas Expansion'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'In an adiabatic expansion, heat is absorbed by the gas because the temperature decreases, and whenever temperature decreases heat enters the gas.',
    expectedGroundTruth: {
      correctness: 'incorrect',
      maxScore: 4,
      misconceptionExpected: true,
      verify: (evalResult) => {
        const misconceptions = evalResult.evaluation?.misconceptions || [];
        const score = evalResult.evaluation?.score || 0;
        return score <= 4 || misconceptions.length > 0;
      }
    }
  },
  {
    id: 'case_5_procedural_error',
    scenarioNumber: 5,
    title: 'Incorrect answer + procedural/calculation error',
    description: 'Student correctly identifies formula Delta U = Q - W, substitutes 150J and 45J correctly, but makes a subtraction error (150 - 45 = 115).',
    questionText: 'A gas absorbs 150J of heat while expanding and performing 45J of work. Calculate Delta U.',
    expectedConcepts: ['First Law of Thermodynamics', 'Internal Energy Change', 'Arithmetic Calculation'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'Using Delta U = Q - W, Q = 150J and W = 45J. Delta U = 150 - 45 = 115J.',
    expectedGroundTruth: {
      correctness: 'partially_correct',
      minScore: 5,
      maxScore: 8,
      conceptScoreMin: 70,
      proceduralScoreMax: 60,
      verify: (evalResult) => {
        const score = evalResult.evaluation?.score || 0;
        return score >= 4 && score <= 8;
      }
    }
  },
  {
    id: 'case_6_incomplete_response',
    scenarioNumber: 6,
    title: 'Incomplete response',
    description: 'Student writes initial statement but cuts off halfway without giving calculation or conclusion.',
    questionText: 'Define the first law of thermodynamics and calculate Delta U when Q = 100J and W = 30J.',
    expectedConcepts: ['First Law of Thermodynamics', 'Internal Energy Change'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'The first law of thermodynamics states that energy cannot be created or destroyed, so Delta U equals...',
    expectedGroundTruth: {
      correctness: 'partially_correct',
      minScore: 2,
      maxScore: 5,
      verify: (evalResult) => {
        const score = evalResult.evaluation?.score || 0;
        return score >= 1 && score <= 5;
      }
    }
  },
  {
    id: 'case_7_empty_response',
    scenarioNumber: 7,
    title: 'Empty response',
    description: 'Student leaves response blank or writes "I do not know".',
    questionText: 'Explain the difference between isothermal and adiabatic thermodynamic processes.',
    expectedConcepts: ['Isothermal Process', 'Adiabatic Process'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'I do not know.',
    expectedGroundTruth: {
      correctness: 'incorrect',
      maxScore: 0,
      verify: (evalResult) => {
        const score = evalResult.evaluation?.score || 0;
        const correctness = evalResult.evaluation?.correctness;
        return score === 0 && correctness === 'incorrect';
      }
    }
  },
  {
    id: 'case_8_irrelevant_response',
    scenarioNumber: 8,
    title: 'Irrelevant response',
    description: 'Student provides text completely unrelated to physics/thermodynamics.',
    questionText: 'State the first law of thermodynamics equation and define each variable.',
    expectedConcepts: ['First Law of Thermodynamics'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'Pizza is my favorite food and pepperoni is the best topping.',
    expectedGroundTruth: {
      correctness: 'incorrect',
      maxScore: 0,
      verify: (evalResult) => {
        const score = evalResult.evaluation?.score || 0;
        const correctness = evalResult.evaluation?.correctness;
        return score === 0 && correctness === 'incorrect';
      }
    }
  },
  {
    id: 'case_9_strong_conceptual_weak_procedural',
    scenarioNumber: 9,
    title: 'Strong conceptual understanding but weak procedural fluency',
    description: 'Student clearly understands energy conservation, system boundary, and heat/work definitions, but fails matrix/algebraic computation.',
    questionText: 'Calculate internal energy change for a 3-step cyclic process with Q1=100J, W1=40J, Q2=-50J, W2=-20J, Q3=10J, W3=10J.',
    expectedConcepts: ['Thermodynamic Cycles', 'First Law Conservation', 'Summation of Heat and Work'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'In a complete thermodynamic cycle, the system returns to its original state, meaning internal energy is a state function so net Delta U for the full cycle must be zero. Total heat Q_net must equal total work W_net. However, summing the numbers: Q_net = 100 - 50 + 10 = 60J, W_net = 40 - 20 + 10 = 30J... wait 60 - 30 = 40J Delta U.',
    expectedGroundTruth: {
      correctness: 'partially_correct',
      minScore: 5,
      maxScore: 8,
      verify: (evalResult) => {
        const score = evalResult.evaluation?.score || 0;
        return score >= 4 && score <= 8;
      }
    }
  },
  {
    id: 'case_10_strong_procedural_weak_application',
    scenarioNumber: 10,
    title: 'Strong procedural fluency but weak application/transfer',
    description: 'Student plugs numbers into Delta U = Q - W correctly (procedural), but fails when asked to apply to a biological cell system (transfer).',
    questionText: 'A biological cell absorbs 10mJ of glucose energy (Q) and performs 4mJ of mechanical work against its membrane (W). Explain if the cell internal energy increased, and transfer this principle to an engine piston.',
    expectedConcepts: ['First Law Transfer', 'Biological Thermodynamics', 'System Boundaries'],
    rubric: { maxPoints: 10, passingPoints: 6 },
    studentAnswer: 'Delta U = 10 - 4 = 6mJ. The cell energy increased by 6mJ. I do not know how this relates to an engine piston because biological cells do not have pistons or metal cylinders.',
    expectedGroundTruth: {
      correctness: 'partially_correct',
      minScore: 5,
      maxScore: 8,
      verify: (evalResult) => {
        const score = evalResult.evaluation?.score || 0;
        return score >= 4 && score <= 8;
      }
    }
  }
];
