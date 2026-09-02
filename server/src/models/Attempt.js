import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema(
  {
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
    status: {
      type: String,
      enum: {
        values: ['in_progress', 'submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed', 'failed'],
        message: '{VALUE} is not a valid attempt status'
      },
      default: 'in_progress'
    },
    processingError: {
      type: String,
      trim: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    score: {
      type: Number
    },
    maxScore: {
      type: Number
    },
    percentage: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

// Indexes
attemptSchema.index({ studentId: 1, assessmentId: 1 });
attemptSchema.index({ studentId: 1, status: 1 });

export const Attempt = mongoose.model('Attempt', attemptSchema);
