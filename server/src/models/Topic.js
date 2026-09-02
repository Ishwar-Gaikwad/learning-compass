import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference (courseId) is required']
    },
    title: {
      type: String,
      required: [true, 'Topic title is required'],
      trim: true,
      minlength: [2, 'Topic title must be at least 2 characters long'],
      maxlength: [150, 'Topic title cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true
    },
    order: {
      type: Number,
      required: [true, 'Topic display order is required'],
      default: 1,
      min: [1, 'Order must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Order must be an integer'
      }
    },
    learningObjectives: [
      {
        type: String,
        trim: true
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indexes
topicSchema.index({ courseId: 1, order: 1 });

export const Topic = mongoose.model('Topic', topicSchema);
