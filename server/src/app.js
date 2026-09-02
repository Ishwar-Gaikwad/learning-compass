import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import courseRoutes from './routes/course.routes.js';
import topicRoutes from './routes/topic.routes.js';
import materialRoutes from './routes/material.routes.js';
import assessmentRoutes from './routes/assessment.routes.js';
import attemptRoutes from './routes/attempt.routes.js';
import diagnosticRoutes from './routes/diagnostic.routes.js';
import learningPathRoutes from './routes/learningPath.routes.js';
import reassessmentRoutes from './routes/reassessment.routes.js';
import { errorMiddleware } from './middleware/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or non-production environment
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const allowedOrigins = clientUrl ? clientUrl.split(',').map((u) => u.trim()) : [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: Origin '${origin}' is not authorized.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Static file serving for uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Learning Compass API is running'
  });
});

// Authentication Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes);

// Course Routes
app.use('/api/v1/courses', courseRoutes);
app.use('/api/courses', courseRoutes);

// Topic Routes
app.use('/api/v1/topics', topicRoutes);
app.use('/api/topics', topicRoutes);

// Reassessment Routes
app.use('/api/v1', reassessmentRoutes);
app.use('/api', reassessmentRoutes);

// Student Attempt Routes
app.use('/api/v1', attemptRoutes);
app.use('/api', attemptRoutes);

// Diagnostic Report Routes
app.use('/api/v1', diagnosticRoutes);
app.use('/api', diagnosticRoutes);

// Learning Path Routes
app.use('/api/v1', learningPathRoutes);
app.use('/api', learningPathRoutes);

// Assessment Routes
app.use('/api/v1', assessmentRoutes);
app.use('/api', assessmentRoutes);

// Material Routes
app.use('/api/v1', materialRoutes);
app.use('/api', materialRoutes);

// Global Error Handler Middleware
app.use(errorMiddleware);

export default app;
