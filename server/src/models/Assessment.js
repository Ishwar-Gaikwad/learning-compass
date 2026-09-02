import mongoose from 'mongoose';

const sourceReferenceSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material'
    },
    pageNumber: {
      type: Number,
      min: 1
    },
    chunkIndex: {
      type: Number,
      min: 0
    }
  },
  { _id: false }
);

const rubricSchema = new mongoose.Schema(
  {
    gradingCriteria: {
      type: String,
      trim: true
    },
    sampleAnswer: {
      type: String,
      trim: true
    },
    maxPoints: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true
    },
    questionType: {
      type: String,
      required: [true, 'Question type is required'],
      enum: {
        values: ['mcq', 'short_answer', 'code'],
        message: '{VALUE} is not a valid question type'
      }
    },
    options: [
      {
        type: String,
        trim: true
      }
    ],
    correctAnswer: {
      type: String,
      required: [true, 'Correct answer is required'],
      trim: true
    },
    difficulty: {
      type: String,
      required: [true, 'Question difficulty is required'],
      enum: {
        values: ['easy', 'medium', 'hard'],
        message: '{VALUE} is not a valid question difficulty'
      },
      default: 'medium'
    },
    expectedConcepts: [
      {
        type: String,
        trim: true
      }
    ],
    rubric: {
      type: rubricSchema,
      required: true
    },
    sourceReferences: [sourceReferenceSchema]
  },
  { timestamps: true }
);

const assessmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher reference (teacherId) is required']
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference (courseId) is required']
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: [true, 'Topic reference (topicId) is required']
    },
    accessCode: {
      type: String,
      required: [true, 'Assessment access code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters long'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['initial_diagnostic', 'reassessment'],
      default: 'initial_diagnostic'
    },
    parentAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment'
    },
    previousDiagnosticReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiagnosticReport'
    },
    learningPathId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningPath'
    },
    targetedConcepts: [
      {
        type: String,
        trim: true
      }
    ],
    difficulty: {
      type: String,
      enum: {
        values: ['easy', 'medium', 'hard', 'mixed'],
        message: '{VALUE} is not a valid difficulty level'
      },
      default: 'medium'
    },
    totalQuestions: {
      type: Number,
      required: [true, 'Total questions count is required'],
      min: [1, 'Total questions must be at least 1']
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: '{VALUE} is not a valid assessment status'
      },
      default: 'published'
    },
    questions: {
      type: [questionSchema],
      required: [true, 'Questions array is required'],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Assessment must contain at least one question'
      }
    },
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
assessmentSchema.index({ topicId: 1, status: 1 });
assessmentSchema.index({ courseId: 1 });
assessmentSchema.index({ teacherId: 1 });

export const Assessment = mongoose.model('Assessment', assessmentSchema);
