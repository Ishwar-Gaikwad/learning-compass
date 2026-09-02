import mongoose from 'mongoose';

const evidenceItemSchema = new mongoose.Schema(
  {
    concept: {
      type: String,
      trim: true
    },
    initialEvidence: {
      type: String,
      trim: true
    },
    reassessmentEvidence: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['improved', 'persistent_weakness', 'unchanged', 'insufficient_evidence'],
      default: 'improved'
    },
    reasoning: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const diagnosticComparisonSchema = new mongoose.Schema(
  {
    previousDiagnosticReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiagnosticReport',
      required: [true, 'Previous diagnostic report reference is required']
    },
    newDiagnosticReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiagnosticReport',
      required: [true, 'New diagnostic report reference is required']
    },
    reassessmentAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      required: [true, 'Reassessment attempt reference is required'],
      unique: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required']
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: [true, 'Topic reference is required']
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher reference is required']
    },
    improvedConcepts: [
      {
        type: String,
        trim: true
      }
    ],
    unchangedWeaknesses: [
      {
        type: String,
        trim: true
      }
    ],
    newlyObservedWeaknesses: [
      {
        type: String,
        trim: true
      }
    ],
    resolvedMisconceptions: [
      {
        type: String,
        trim: true
      }
    ],
    remainingMisconceptions: [
      {
        type: String,
        trim: true
      }
    ],
    conceptualDelta: {
      type: Number,
      default: 0
    },
    proceduralDelta: {
      type: Number,
      default: 0
    },
    applicationDelta: {
      type: Number,
      default: 0
    },
    overallScoreDelta: {
      type: Number,
      default: 0
    },
    evidenceSummary: [evidenceItemSchema],
    remediationEffectiveness: {
      type: String,
      trim: true
    },
    summary: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
diagnosticComparisonSchema.index({ studentId: 1 });

export const DiagnosticComparison = mongoose.model('DiagnosticComparison', diagnosticComparisonSchema);
