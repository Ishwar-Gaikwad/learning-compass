import mongoose from 'mongoose';

const strengthSchema = new mongoose.Schema(
  {
    concept: {
      type: String,
      required: true,
      trim: true
    },
    evidence: {
      type: String,
      required: true,
      trim: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId
    },
    responseId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { _id: false }
);

const weakConceptSchema = new mongoose.Schema(
  {
    concept: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    evidence: {
      type: String,
      required: true,
      trim: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId
    },
    responseId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { _id: false }
);

const misconceptionFindingSchema = new mongoose.Schema(
  {
    misconceptionCode: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    explanation: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    evidenceQuestions: [
      {
        type: mongoose.Schema.Types.ObjectId
      }
    ],
    responseId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { _id: false }
);

const proceduralWeaknessSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true
    },
    evidence: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const applicationWeaknessSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true
    },
    evidence: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const diagnosticReportSchema = new mongoose.Schema(
  {
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      required: [true, 'Attempt reference (attemptId) is required'],
      unique: true
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment reference (assessmentId) is required']
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference (studentId) is required']
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: [true, 'Topic reference (topicId) is required']
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher reference (teacherId) is required']
    },
    overallMasteryScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    masteryLevel: {
      type: String,
      enum: ['novice', 'developing', 'proficient', 'mastered'],
      default: 'developing'
    },
    dimensionScores: {
      conceptualUnderstanding: { type: Number, min: 0, max: 1, default: 0 },
      proceduralFluency: { type: Number, min: 0, max: 1, default: 0 },
      applicationTransfer: { type: Number, min: 0, max: 1, default: 0 }
    },
    strengths: [strengthSchema],
    weakConcepts: [weakConceptSchema],
    proceduralWeaknesses: [proceduralWeaknessSchema],
    applicationWeaknesses: [applicationWeaknessSchema],
    identifiedMisconceptions: [misconceptionFindingSchema],
    recommendations: [
      {
        type: String,
        trim: true
      }
    ],
    aiSummary: {
      type: String,
      required: [true, 'Diagnostic AI summary is required'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
diagnosticReportSchema.index({ studentId: 1, topicId: 1 });

export const DiagnosticReport = mongoose.model('DiagnosticReport', diagnosticReportSchema);
