import mongoose from 'mongoose';

const assessmentAssignmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required']
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment reference is required']
    },
    status: {
      type: String,
      enum: {
        values: ['assigned', 'in_progress', 'submitted'],
        message: '{VALUE} is not a valid assignment status'
      },
      default: 'assigned'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    startedAt: {
      type: Date
    },
    submittedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound Unique Index: Prevents duplicate joins/assignments
assessmentAssignmentSchema.index({ studentId: 1, assessmentId: 1 }, { unique: true });
assessmentAssignmentSchema.index({ studentId: 1, status: 1 });

export const AssessmentAssignment = mongoose.model('AssessmentAssignment', assessmentAssignmentSchema);
