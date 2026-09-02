import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: [true, 'Material reference (materialId) is required']
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
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
    content: {
      type: String,
      required: [true, 'Chunk content string is required']
    },
    pageNumber: {
      type: Number,
      min: [1, 'Page number must be at least 1']
    },
    chunkIndex: {
      type: Number,
      required: [true, 'Chunk index is required'],
      min: [0, 'Chunk index cannot be negative']
    },
    tokenCount: {
      type: Number,
      required: [true, 'Token count is required'],
      min: [0, 'Token count cannot be negative']
    },
    embedding: {
      type: [Number],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Indexes
documentChunkSchema.index({ topicId: 1, teacherId: 1 });
documentChunkSchema.index({ courseId: 1, teacherId: 1 });
documentChunkSchema.index({ materialId: 1, chunkIndex: 1 });

export const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);
