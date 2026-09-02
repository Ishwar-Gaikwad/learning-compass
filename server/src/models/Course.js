import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      minlength: [2, 'Course title must be at least 2 characters long'],
      maxlength: [150, 'Course title cannot exceed 150 characters']
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Course code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher reference (teacherId) is required']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    gradeLevel: {
      type: String,
      required: [true, 'Grade level is required'],
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: '{VALUE} is not a valid course status'
      },
      default: 'draft'
    }
  },
  {
    timestamps: true
  }
);

// Secondary index for teacherId lookup
courseSchema.index({ teacherId: 1 });

export const Course = mongoose.model('Course', courseSchema);
