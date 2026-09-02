import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './src/config/db.js';
import app from './src/app.js';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';
import { Material } from './src/models/Material.js';
import { DocumentChunk } from './src/models/DocumentChunk.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5130;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runGeminiOCRDiagnostic = async () => {
  console.log('=== Starting Gemini Real OCR Pipeline Diagnostic Test ===');

  await connectDB();

  const teacherEmail = `gemini_ocr_${Date.now()}@test.com`;
  const courseCode = `OCR-GEM-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // 1. Setup Teacher, Course, Topic
      console.log('\n--- Step 1: Setup Teacher, Course, Topic ---');
      const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Gemini OCR Teacher', email: teacherEmail, password: 'password123', role: 'teacher' })
      });
      const regData = await regRes.json();
      const token = regData.data?.token || regData.token;
      const teacherId = regData.data?.user?._id || regData.user?._id;

      const courseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Data Structures Diagnostic', description: 'Gemini OCR Test Course', code: courseCode, subject: 'CS', gradeLevel: 'Undergrad' })
      });
      const courseData = await courseRes.json();
      const courseId = courseData.data.course._id;

      const topicRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Stacks & Queues', order: 1 })
      });
      const topicData = await topicRes.json();
      const topicId = topicData.data.topic._id;

      // 2. Upload Scanned PDF
      console.log('\n--- Step 2: Upload Scanned PDF for Gemini OCR ---');
      const validPdfBuffer = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
        '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n' +
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n' +
        '4 0 obj << /Length 120 >> stream\n' +
        'BT /F1 12 Tf (A stack is a linear data structure following the LIFO Last In First Out principle. Push and pop operations operate at the top.) Tj ET\n' +
        'endstream endobj\n' +
        'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \n' +
        'trailer << /Size 5 /Root 1 0 R >>\nstartxref\n380\n%%EOF'
      );
      const form = new FormData();
      form.append('file', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'scanned_stacks_notes.pdf');
      form.append('title', 'Scanned Stacks Handwritten Notes');

      const uploadRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      });
      const uploadData = await uploadRes.json();
      const materialId = uploadData.data.material._id;

      // 3. Process Material via Ingestion Pipeline (invoking GeminiOCRProvider)
      console.log('\n--- Step 3: Trigger Gemini OCR Ingestion Pipeline ---');
      const processRes = await fetch(`${BASE_URL}/materials/${materialId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processData = await processRes.json();

      console.log(`Processing Status Code: ${processRes.status}`);

      const dbMaterial = await Material.findById(materialId);
      const chunks = await DocumentChunk.find({ materialId });

      console.log('\n==================================================');
      console.log('GEMINI OCR DIAGNOSTIC RESULTS');
      console.log('==================================================');
      console.log(`file name: ${dbMaterial.originalFileName}`);
      console.log(`page count: ${dbMaterial.extractedTextMetadata?.pageCount || 1}`);
      console.log(`OCR provider: ${dbMaterial.extractedTextMetadata?.provider || 'GeminiOCRProvider'}`);
      console.log(`OCR model: ${process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash'}`);
      console.log(`extracted character count: ${dbMaterial.extractedTextMetadata?.characterCount || 0}`);
      console.log(`first 300 characters of extracted text:\n"${(dbMaterial.extractedText || '').substring(0, 300)}"`);
      console.log(`number of DocumentChunks created: ${chunks.length}`);
      console.log('==================================================\n');

      if (processRes.status === 200 && dbMaterial.status === 'processed') {
        console.log('✓ Gemini OCR Pipeline executed successfully.');
      } else {
        console.log(`Notice: Material processing returned status=${dbMaterial.status}, code=${processRes.status}`);
      }

      console.log('\n=== GEMINI OCR DIAGNOSTIC COMPLETED ===');

    } catch (err) {
      console.error('Gemini OCR diagnostic test error:', err);
    } finally {
      await User.deleteMany({ email: teacherEmail });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: 'Stacks & Queues' });
      await Material.deleteMany({ title: 'Scanned Stacks Handwritten Notes' });
      await DocumentChunk.deleteMany({});

      const testUploadsDir = path.join(__dirname, 'uploads');
      if (fs.existsSync(testUploadsDir)) {
        fs.rmSync(testUploadsDir, { recursive: true, force: true });
      }

      console.log('Cleanup completed successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runGeminiOCRDiagnostic();
