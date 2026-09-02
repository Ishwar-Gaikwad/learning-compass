export const buildImprovementPrompt = ({
  previousReport,
  newReport,
  learningPath,
  initialResponses = [],
  reassessmentResponses = []
}) => {
  const systemPrompt = `You are an expert AI educational diagnostic comparison engine for Learning Compass.
Your task is to conduct a rigorous, concept-specific, evidence-based improvement analysis comparing a student's initial assessment diagnostic report against their post-remediation targeted reassessment diagnostic report.

EVIDENCE-BASED COMPARISON RULES:
1. CONCEPT-SPECIFIC ANALYSIS: Compare student performance concept by concept for each concept identified as a weakness initially. Do NOT rely solely on overall numerical score changes.
2. ACTUAL RESPONSE EVIDENCE: Analyze the student's actual written answers, question texts, and evaluations from both the initial attempt and reassessment attempt.
3. RESOLVED VS PERSISTENT MISCONCEPTIONS:
   - Identify misconceptions present in the initial diagnosis that were resolved in the reassessment.
   - Identify misconceptions that remain active/unresolved.
4. REMEDIATION EFFECTIVENESS: Evaluate whether evidence supports improvement following the completed remediation activities in the student's LearningPath. Use non-causal evidence-based language (e.g. "Evidence suggests improvement following completed remediation activities").
5. AVOID UNSUPPORTED CLAIMS: State explicitly when evidence is insufficient to confirm mastery. Avoid generic commentary like "The student improved significantly". Explain WHAT improved, WHY the student response evidence supports improvement, and WHAT still requires support.
6. Output MUST be valid, structured JSON matching the requested schema.`;

  const prevDim = previousReport.dimensionScores || {};
  const newDim = newReport.dimensionScores || {};

  const formattedInitialEvidence = initialResponses
    .map((r, i) => `Question #${i + 1}: "${r.questionId?.questionText || ''}"\nStudent Answer: "${r.studentAnswer || ''}"\nCorrectness: ${r.evaluation?.correctness || 'N/A'}\nReasoning: "${r.evaluation?.reasoning || ''}"`)
    .join('\n\n');

  const formattedReassessmentEvidence = reassessmentResponses
    .map((r, i) => `Question #${i + 1}: "${r.questionId?.questionText || ''}"\nStudent Answer: "${r.studentAnswer || ''}"\nCorrectness: ${r.evaluation?.correctness || 'N/A'}\nReasoning: "${r.evaluation?.reasoning || ''}"`)
    .join('\n\n');

  const completedNodes = (learningPath?.nodes || []).filter((n) => n.isCompleted);
  const formattedRemediation = completedNodes
    .map((n, i) => `${i + 1}. Activity: "${n.title}" | Target Concept: "${n.targetConcept}" | Objective: "${n.learningObjective}"`)
    .join('\n');

  const formattedInitialWeaknesses = (previousReport.weakConcepts || []).map((w, i) => `${i + 1}. Concept: "${w.concept}" | Evidence: "${w.evidence || ''}"`).join('\n');
  const formattedInitialMisconceptions = (previousReport.identifiedMisconceptions || []).map((m, i) => `${i + 1}. Title: "${m.title || m.misconceptionCode}" | Explanation: "${m.explanation || m.description || ''}"`).join('\n');

  const formattedReassessmentWeaknesses = (newReport.weakConcepts || []).map((w, i) => `${i + 1}. Concept: "${w.concept}" | Evidence: "${w.evidence || ''}"`).join('\n');
  const formattedReassessmentMisconceptions = (newReport.identifiedMisconceptions || []).map((m, i) => `${i + 1}. Title: "${m.title || m.misconceptionCode}" | Explanation: "${m.explanation || m.description || ''}"`).join('\n');

  const userPrompt = `IMPROVEMENT ANALYSIS TASK: Conduct an evidence-based comparison between initial diagnostic report and post-remediation reassessment report.

INITIAL DIAGNOSTIC REPORT (#1):
- Overall Mastery Score: ${previousReport.overallMasteryScore || 0} / 100 (${previousReport.masteryLevel || 'developing'})
- Conceptual Score: ${prevDim.conceptualUnderstanding?.score ?? 0} / 100
- Procedural Score: ${prevDim.proceduralFluency?.score ?? 0} / 100
- Application Score: ${prevDim.applicationAndTransfer?.score ?? 0} / 100
- Summary: "${previousReport.aiSummary || ''}"
- Identified Weak Concepts:
${formattedInitialWeaknesses || 'None explicitly listed.'}
- Identified Misconceptions:
${formattedInitialMisconceptions || 'None explicitly tagged.'}

REASSESSMENT DIAGNOSTIC REPORT (#2):
- Overall Mastery Score: ${newReport.overallMasteryScore || 0} / 100 (${newReport.masteryLevel || 'mastered'})
- Conceptual Score: ${newDim.conceptualUnderstanding?.score ?? 0} / 100
- Procedural Score: ${newDim.proceduralFluency?.score ?? 0} / 100
- Application Score: ${newDim.applicationAndTransfer?.score ?? 0} / 100
- Summary: "${newReport.aiSummary || ''}"
- Identified Weak Concepts:
${formattedReassessmentWeaknesses || 'None (all weak concepts remediated).' }
- Identified Misconceptions:
${formattedReassessmentMisconceptions || 'None remaining.'}

COMPLETED LEARNING PATH REMEDIATION ACTIVITIES:
${formattedRemediation || 'Completed assigned remediation modules.'}

INITIAL ASSESSMENT RESPONSE EVIDENCE:
${formattedInitialEvidence || 'No initial response text available.'}

REASSESSMENT RESPONSE EVIDENCE:
${formattedReassessmentEvidence || 'No reassessment response text available.'}

REQUIRED JSON OUTPUT SCHEMA:
{
  "improvedConcepts": ["Exact Concept Name"],
  "unchangedWeaknesses": [],
  "newlyObservedWeaknesses": [],
  "resolvedMisconceptions": ["Exact Misconception Title"],
  "remainingMisconceptions": [],
  "conceptualDelta": ${Math.round(((newDim.conceptualUnderstanding?.score ?? 0) - (prevDim.conceptualUnderstanding?.score ?? 0)) * 100) / 100},
  "proceduralDelta": ${Math.round(((newDim.proceduralFluency?.score ?? 0) - (prevDim.proceduralFluency?.score ?? 0)) * 100) / 100},
  "applicationDelta": ${Math.round(((newDim.applicationAndTransfer?.score ?? 0) - (prevDim.applicationAndTransfer?.score ?? 0)) * 100) / 100},
  "overallScoreDelta": ${(newReport.overallMasteryScore || 0) - (previousReport.overallMasteryScore || 0)},
  "evidenceSummary": [
    {
      "concept": "Exact Concept Name",
      "initialEvidence": "Initial student response showing error or misconception",
      "reassessmentEvidence": "Reassessment student response showing correct reasoning",
      "status": "improved | persistent_weakness | unchanged | insufficient_evidence",
      "reasoning": "Evidence analysis explaining why responses support growth"
    }
  ],
  "remediationEffectiveness": "Evidence-based summary evaluating remediation impact using non-causal language.",
  "summary": "Comprehensive narrative explaining what improved, why student evidence supports growth, and what areas still require support."
}`;

  return {
    systemPrompt,
    userPrompt
  };
};
