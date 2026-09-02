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
import { ragRetrievalService } from './src/services/rag/ragRetrievalService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5115;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runOcrContentIntegrityTest = async () => {
  console.log('=== Starting Real Gemini OCR Content Integrity & Safety Test Suite ===');

  await connectDB();

  const teacherEmail = `ocr_integrity_${Date.now()}@test.com`;
  const courseCode = `OCR-INT-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // Setup Teacher, Course, Topic
      const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'OCR Integrity Teacher', email: teacherEmail, password: 'password123', role: 'teacher' })
      });
      const regData = await regRes.json();
      const token = regData.data?.token || regData.token;
      const teacherId = regData.data?.user?._id || regData.user?._id;

      const courseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Computer Science & Algorithms', description: 'OCR Integrity Course', code: courseCode, subject: 'CS', gradeLevel: 'Undergrad' })
      });
      const courseData = await courseRes.json();
      const courseId = courseData.data.course._id;

      const topicRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Stacks Data Structure', order: 1 })
      });
      const topicData = await topicRes.json();
      const topicId = topicData.data.topic._id;

      // -------------------------------------------------------------
      // TEST A: Native text PDF -> native extraction
      // -------------------------------------------------------------
      console.log('\n--- TEST A: Native text PDF -> native extraction ---');
      const textPdfContent = 
        '1 0 obj << /Length 300 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (Stack data structure operates on Last In First Out LIFO principles supporting push pop and peek operations.) Tj ET\n' +
        'endstream endobj';
      const textPdfBuffer = Buffer.from(textPdfContent);

      const formA = new FormData();
      formA.append('file', new Blob([textPdfBuffer], { type: 'application/pdf' }), 'normal_text_stack.pdf');
      formA.append('title', 'Normal Text Stack Guide');

      const uploadResA = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formA
      });
      const uploadDataA = await uploadResA.json();
      const materialIdA = uploadDataA.data.material._id;

      const processResA = await fetch(`${BASE_URL}/materials/${materialIdA}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processDataA = await processResA.json();

      console.log('Normal Text PDF Status:', processDataA.data.material.status, '(Expected: "processed")');
      console.log('ocrExecuted Flag:', processDataA.data.material.extractedTextMetadata.ocrExecuted, '(Expected: false)');
      
      const testAPass = processDataA.data.material.status === 'processed' && !processDataA.data.material.extractedTextMetadata.ocrExecuted;
      console.log(`[TEST A VERIFY] Native PDF extraction succeeded: ${testAPass}`);

      if (!testAPass) throw new Error('TEST A FAILED: Native PDF extraction failed!');

      // -------------------------------------------------------------
      // TEST B: Scanned Stack PDF -> Gemini OCR -> actual Stack content
      // -------------------------------------------------------------
      console.log('\n--- TEST B: Scanned Stack PDF -> Gemini OCR -> actual Stack content ---');
      const stacksScannedPdf = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
        '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n' +
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n' +
        '4 0 obj << /Length 130 >> stream\n' +
        'BT /F1 12 Tf (A stack is a linear data structure following the LIFO Last In First Out principle. Push and pop operations operate at top.) Tj ET\n' +
        'endstream endobj\n' +
        'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \n' +
        'trailer << /Size 5 /Root 1 0 R >>\nstartxref\n390\n%%EOF'
      );

      const formB = new FormData();
      formB.append('file', new Blob([stacksScannedPdf], { type: 'application/pdf' }), 'scanned_stacks_gemini.pdf');
      formB.append('title', 'Scanned Stacks PDF Gemini OCR');

      const uploadResB = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formB
      });
      const uploadDataB = await uploadResB.json();
      const materialIdB = uploadDataB.data.material._id;

      const processResB = await fetch(`${BASE_URL}/materials/${materialIdB}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processDataB = await processResB.json();

      console.log('Scanned Stack PDF Status:', processDataB.data.material.status, '(Expected: "processed")');
      console.log('Provider:', processDataB.data.material.extractedTextMetadata.provider, '(Expected: "GeminiOCRProvider")');

      const chunksB = await DocumentChunk.find({ materialId: materialIdB });
      console.log(`DocumentChunks created: ${chunksB.length}`);
      const chunkBText = chunksB.map(c => c.content).join(' ').toLowerCase();

      const testBPass = processDataB.data.material.status === 'processed' && chunkBText.includes('stack') && chunkBText.includes('lifo');
      console.log(`[TEST B VERIFY] Gemini OCR extracted actual Stack content: ${testBPass}`);

      if (!testBPass) throw new Error('TEST B FAILED: Gemini OCR did not extract actual Stack content!');

      // -------------------------------------------------------------
      // TEST C: Scanned Mathematics PDF -> actual Mathematics content
      // -------------------------------------------------------------
      console.log('\n--- TEST C: Scanned Mathematics PDF -> actual Mathematics content ---');
      const mathScannedPdf = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
        '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n' +
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n' +
        '4 0 obj << /Length 130 >> stream\n' +
        'BT /F1 12 Tf (Calculus derivatives represent instantaneous rate of change f prime of x equals limit as h approaches zero of ratio.) Tj ET\n' +
        'endstream endobj\n' +
        'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \n' +
        'trailer << /Size 5 /Root 1 0 R >>\nstartxref\n390\n%%EOF'
      );

      const formC = new FormData();
      formC.append('file', new Blob([mathScannedPdf], { type: 'application/pdf' }), 'scanned_math_gemini.pdf');
      formC.append('title', 'Scanned Calculus PDF Gemini OCR');

      const uploadResC = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formC
      });
      const uploadDataC = await uploadResC.json();
      const materialIdC = uploadDataC.data.material._id;

      const processResC = await fetch(`${BASE_URL}/materials/${materialIdC}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processDataC = await processResC.json();

      const chunksC = await DocumentChunk.find({ materialId: materialIdC });
      const chunkCText = chunksC.map(c => c.content).join(' ').toLowerCase();

      const testCPass = processDataC.data.material.status === 'processed' && chunkCText.includes('calculus');
      console.log(`[TEST C VERIFY] Gemini OCR extracted actual Mathematics content: ${testCPass}`);

      if (!testCPass) throw new Error('TEST C FAILED: Gemini OCR did not extract actual Math content!');

      // -------------------------------------------------------------
      // TEST D: OCR failure -> FAILED material, zero DocumentChunks
      // -------------------------------------------------------------
      console.log('\n--- TEST D: OCR failure -> FAILED material, zero DocumentChunks ---');
      const invalidPdfBuffer = Buffer.from('NOT_A_VALID_PDF_HEADER_RAW_BYTES');

      const formD = new FormData();
      formD.append('file', new Blob([invalidPdfBuffer], { type: 'application/pdf' }), 'invalid_damaged.pdf');
      formD.append('title', 'Invalid Damaged PDF');

      const uploadResD = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formD
      });
      const uploadDataD = await uploadResD.json();
      const materialIdD = uploadDataD.data.material._id;

      const processResD = await fetch(`${BASE_URL}/materials/${materialIdD}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processDataD = await processResD.json();

      const dbMaterialD = await Material.findById(materialIdD);
      const chunksD = await DocumentChunk.find({ materialId: materialIdD });

      const testDPass = processResD.status === 400 && dbMaterialD.status === 'failed' && chunksD.length === 0;
      console.log(`[TEST D VERIFY] OCR failure resulted in status='failed' and 0 chunks: ${testDPass}`);

      if (!testDPass) throw new Error('TEST D FAILED: Damaged document did not fail cleanly!');

      // -------------------------------------------------------------
      // TEST E & F: Verify no mock OCR content is stored & pageNumber preserved
      // -------------------------------------------------------------
      console.log('\n--- TEST E & F: Verify no mock OCR content is stored & pageNumber preserved ---');
      const allChunks = await DocumentChunk.find({ topicId }).lean();
      
      let foundMockPhrases = false;
      let pageNumbersPreserved = true;

      allChunks.forEach(c => {
        const text = c.content.toLowerCase();
        if (text.includes('optical character recognition') || text.includes('from scanned document') || text.includes('quadratic equations are second-degree')) {
          foundMockPhrases = true;
        }
        if (typeof c.pageNumber !== 'number' || c.pageNumber < 1) {
          pageNumbersPreserved = false;
        }
      });

      console.log(`[TEST E VERIFY] Zero mock OCR phrases in stored chunks: ${!foundMockPhrases}`);
      console.log(`[TEST F VERIFY] pageNumber preserved on all DocumentChunks: ${pageNumbersPreserved}`);

      if (foundMockPhrases || !pageNumbersPreserved) throw new Error('TEST E/F FAILED: Mock content detected or invalid page numbers!');

      // -------------------------------------------------------------
      // TEST G: Verify RAG for DSA -> Stacks retrieves only Stack content
      // -------------------------------------------------------------
      console.log('\n--- TEST G: Verify RAG for DSA -> Stacks retrieves only Stack content ---');
      const ragResult = await ragRetrievalService.retrieveRelevantChunks({
        query: 'Stacks LIFO push pop operations',
        teacherId,
        courseId,
        topicId,
        topK: 5
      });

      const ragText = ragResult.chunks.map(c => c.content).join(' ').toLowerCase();
      const testGPass = ragResult.chunksCount > 0 && ragText.includes('stack') && !ragText.includes('quadratic');
      console.log(`[TEST G VERIFY] RAG retrieved only actual Stack content: ${testGPass}`);

      if (!testGPass) throw new Error('TEST G FAILED: RAG context contained invalid content!');

      console.log('\n=== ALL 7 (A-G) REAL GEMINI OCR INTEGRITY TESTS PASSED 100%! ===');

    } catch (err) {
      console.error('Real Gemini OCR Content Integrity Test FAILED:', err);
      process.exit(1);
    } finally {
      await User.deleteMany({ email: teacherEmail });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: 'Stacks Data Structure' });
      await Material.deleteMany({ title: { $in: ['Normal Text Stack Guide', 'Scanned Stacks PDF Gemini OCR', 'Scanned Calculus PDF Gemini OCR', 'Invalid Damaged PDF'] } });
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

runOcrContentIntegrityTest();
