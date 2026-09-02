import mongoose from 'mongoose';

const recommendedMaterialSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material'
    },
    fileName: {
      type: String,
      trim: true
    },
    excerpt: {
      type: String,
      trim: true
    },
    pageNumber: {
      type: Number
    }
  },
  { _id: false }
);

const practiceActivitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    activityType: {
      type: String,
      default: 'practice_exercise',
      trim: true
    }
  },
  { _id: false }
);

const learningNodeSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: true,
      trim: true
    },
    sequenceOrder: {
      type: Number,
      required: true,
      min: 1
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['remedial_reading', 'practice_exercise', 'concept_explanation', 'checkpoint_quiz'],
      default: 'remedial_reading'
    },
    targetConcept: {
      type: String,
      required: [true, 'Target concept is required'],
      trim: true
    },
    reasonForTargeting: {
      type: String,
      required: [true, 'Reason for targeting concept is required'],
      trim: true
    },
    learningObjective: {
      type: String,
      required: [true, 'Learning objective is required'],
      trim: true
    },
    recommendedMaterial: recommendedMaterialSchema,
    practiceActivity: practiceActivitySchema,
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    expectedOutcome: {
      type: String,
      required: [true, 'Expected outcome is required'],
      trim: true
    },
    reassessmentCriteria: {
      type: String,
      required: [true, 'Reassessment criteria is required'],
      trim: true
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

const learningPathSchema = new mongoose.Schema(
  {
    diagnosticReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiagnosticReport',
      required: [true, 'Diagnostic report reference (diagnosticReportId) is required'],
      unique: true
    },
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      required: [true, 'Attempt reference (attemptId) is required']
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
    title: {
      type: String,
      required: [true, 'Learning path title is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'superseded'],
      default: 'active'
    },
    overallProgressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    nodes: [learningNodeSchema],
    sourceMaterialsUsed: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indexes
learningPathSchema.index({ studentId: 1, status: 1 });

export const LearningPath = mongoose.model('LearningPath', learningPathSchema);
