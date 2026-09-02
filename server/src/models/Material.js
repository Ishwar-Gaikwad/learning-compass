import mongoose from 'mongoose';

const extractedTextMetadataSchema = new mongoose.Schema(
  {
    characterCount: {
      type: Number,
      default: 0,
      min: 0
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0
    },
    ocrExecuted: {
      type: Boolean,
      default: false
    },
    hasUsableText: {
      type: Boolean,
      default: false
    },
    totalChunksCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const processingErrorSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      trim: true
    },
    code: {
      type: String,
      trim: true
    },
    failedAt: {
      type: Date
    }
  },
  { _id: false }
);

const materialSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: [true, 'Material title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters long'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    originalFileName: {
      type: String,
      trim: true
    },
    fileSizeBytes: {
      type: Number,
      min: [0, 'File size cannot be negative']
    },
    mimeType: {
      type: String,
      trim: true
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
      enum: {
        values: ['pdf', 'docx', 'pptx', 'image'],
        message: '{VALUE} is not a valid file type'
      }
    },
    fileUrl: {
      type: String,
      trim: true
    },
    storageKey: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['uploaded', 'processing', 'processed', 'chunking', 'embedding', 'completed', 'failed'],
        message: '{VALUE} is not a valid status'
      },
      default: 'uploaded'
    },
    extractedText: {
      type: String,
      default: ''
    },
    extractedTextMetadata: {
      type: extractedTextMetadataSchema,
      default: () => ({})
    },
    processingError: {
      type: processingErrorSchema
    }
  },
  {
    timestamps: true
  }
);

// Indexes
materialSchema.index({ topicId: 1 });
materialSchema.index({ courseId: 1 });
materialSchema.index({ teacherId: 1 });
materialSchema.index({ status: 1 });

export const Material = mongoose.model('Material', materialSchema);
