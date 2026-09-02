import mongoose from 'mongoose';

const misconceptionSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    correctness: {
      type: String,
      enum: {
        values: ['correct', 'partially_correct', 'incorrect'],
        message: '{VALUE} is not a valid correctness state'
      },
      required: [true, 'Evaluation correctness is required']
    },
    score: {
      type: Number,
      required: [true, 'Evaluation score is required'],
      min: [0, 'Score cannot be negative']
    },
    maxScore: {
      type: Number,
      default: 1,
      min: 1
    },
    conceptualUnderstanding: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    proceduralFluency: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    applicationTransfer: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    identifiedConcepts: [
      {
        type: String,
        trim: true
      }
    ],
    missingConcepts: [
      {
        type: String,
        trim: true
      }
    ],
    misconceptions: [misconceptionSchema],
    reasoning: {
      type: String,
      required: [true, 'Evaluation reasoning is required'],
      trim: true
    },
    evaluatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const attemptResponseSchema = new mongoose.Schema(
  {
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      required: [true, 'Attempt reference (attemptId) is required']
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
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Question reference (questionId) is required']
    },
    studentAnswer: {
      type: String,
      required: [true, 'Student answer is required'],
      trim: true
    },
    evaluation: {
      type: evaluationSchema
    },
    isCorrect: {
      type: Boolean
    },
    scoreGiven: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

// Unique compound index to prevent duplicate response entries per question per attempt
attemptResponseSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });

export const AttemptResponse = mongoose.model('AttemptResponse', attemptResponseSchema);
