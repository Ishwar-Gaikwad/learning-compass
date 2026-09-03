import assert from 'assert';
import { S3StorageProvider } from '../src/services/storage/S3StorageProvider.js';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const runS3StorageProviderTests = async () => {
  console.log('=== Starting S3StorageProvider Unit & Integration Tests ===\n');

  let passedTests = 0;
  let totalTests = 0;

  const test = async (name, fn) => {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
    }
  };

  // Mock client to intercept commands and verify SDK interactions
  class MockS3Client {
    constructor(config) {
      this.config = config;
      this.sentCommands = [];
      this.storage = new Map(); // Simulates S3 storage key -> { body, contentType }
    }

    async send(command) {
      this.sentCommands.push(command);

      if (command instanceof PutObjectCommand) {
        const { Bucket, Key, Body, ContentType } = command.input;
        this.storage.set(`${Bucket}:${Key}`, {
          body: Buffer.isBuffer(Body) ? Body : Buffer.from(Body),
          contentType: ContentType
        });
        return { $metadata: { httpStatusCode: 200 } };
      }

      if (command instanceof GetObjectCommand) {
        const { Bucket, Key } = command.input;
        const item = this.storage.get(`${Bucket}:${Key}`);
        if (!item) {
          const err = new Error('The specified key does not exist.');
          err.name = 'NoSuchKey';
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }

        return {
          $metadata: { httpStatusCode: 200 },
          ContentType: item.contentType,
          Body: {
            transformToByteArray: async () => new Uint8Array(item.body),
            transformToString: async () => item.body.toString('utf8')
          }
        };
      }

      if (command instanceof DeleteObjectCommand) {
        const { Bucket, Key } = command.input;
        this.storage.delete(`${Bucket}:${Key}`);
        return { $metadata: { httpStatusCode: 204 } };
      }

      throw new Error(`Unhandled command: ${command.constructor.name}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Provider Initialization & Configuration
  // -------------------------------------------------------------
  await test('1. Provider correctly initializes with Supabase S3 endpoint and credentials', async () => {
    const mockClient = new MockS3Client({
      region: 'us-east-1',
      endpoint: 'https://test-project.supabase.co/storage/v1/s3',
      forcePathStyle: true
    });

    const provider = new S3StorageProvider({
      bucketName: 'test-bucket',
      endpoint: 'https://test-project.supabase.co/storage/v1/s3',
      region: 'us-east-1',
      client: mockClient
    });

    assert.strictEqual(provider.bucketName, 'test-bucket');
    assert.strictEqual(provider.endpoint, 'https://test-project.supabase.co/storage/v1/s3');
    assert.strictEqual(provider.region, 'us-east-1');
    assert.strictEqual(provider.client, mockClient);
  });

  // -------------------------------------------------------------
  // Test 2: saveFile Uploads Buffer & Returns Correct Contract
  // -------------------------------------------------------------
  await test('2. saveFile uploads buffer using PutObjectCommand and returns storageKey and fileUrl', async () => {
    const mockClient = new MockS3Client();
    const provider = new S3StorageProvider({
      bucketName: 'learning-compass-materials',
      endpoint: 'https://test-project.supabase.co/storage/v1/s3',
      region: 'us-east-1',
      client: mockClient
    });

    const fileContent = Buffer.from('%PDF-1.4 Mock PDF Content For Ingestion Testing');
    const result = await provider.saveFile({
      buffer: fileContent,
      originalName: 'test_algebra_chapter.pdf',
      mimeType: 'application/pdf',
      teacherId: 'teacher_12345'
    });

    assert.ok(result.storageKey, 'Expected storageKey to be returned');
    assert.ok(result.fileUrl, 'Expected fileUrl to be returned');
    assert.ok(result.storageKey.startsWith('materials/teacher_12345/'), `Unexpected storageKey format: ${result.storageKey}`);
    assert.ok(result.storageKey.endsWith('_test_algebra_chapter.pdf'), `Unexpected storageKey filename: ${result.storageKey}`);
    assert.strictEqual(result.fileUrl, `https://test-project.supabase.co/storage/v1/s3/learning-compass-materials/${result.storageKey}`);

    // Verify PutObjectCommand was executed
    assert.strictEqual(mockClient.sentCommands.length, 1);
    const putCmd = mockClient.sentCommands[0];
    assert.ok(putCmd instanceof PutObjectCommand);
    assert.strictEqual(putCmd.input.Bucket, 'learning-compass-materials');
    assert.strictEqual(putCmd.input.Key, result.storageKey);
    assert.strictEqual(putCmd.input.ContentType, 'application/pdf');
    assert.deepStrictEqual(putCmd.input.Body, fileContent);
  });

  // -------------------------------------------------------------
  // Test 3: getFileBuffer Retrieves Buffer Successfully
  // -------------------------------------------------------------
  await test('3. getFileBuffer retrieves uploaded file buffer via GetObjectCommand', async () => {
    const mockClient = new MockS3Client();
    const provider = new S3StorageProvider({
      bucketName: 'learning-compass-materials',
      endpoint: 'https://test-project.supabase.co/storage/v1/s3',
      region: 'us-east-1',
      client: mockClient
    });

    const fileContent = Buffer.from('%PDF-1.4 Mock Ingestion Document Buffer');
    const saveResult = await provider.saveFile({
      buffer: fileContent,
      originalName: 'calculus_notes.pdf',
      mimeType: 'application/pdf',
      teacherId: 'teacher_999'
    });

    const retrievedBuffer = await provider.getFileBuffer(saveResult.storageKey);

    assert.ok(Buffer.isBuffer(retrievedBuffer), 'Expected retrieved output to be a Buffer');
    assert.strictEqual(retrievedBuffer.toString('utf8'), fileContent.toString('utf8'));
  });

  // -------------------------------------------------------------
  // Test 4: getFileBuffer Throws Clear Error for Missing Key
  // -------------------------------------------------------------
  await test('4. getFileBuffer throws descriptive error when key does not exist', async () => {
    const mockClient = new MockS3Client();
    const provider = new S3StorageProvider({
      bucketName: 'learning-compass-materials',
      endpoint: 'https://test-project.supabase.co/storage/v1/s3',
      region: 'us-east-1',
      client: mockClient
    });

    let threwError = false;
    try {
      await provider.getFileBuffer('materials/nonexistent_teacher/missing_file.pdf');
    } catch (err) {
      threwError = true;
      assert.ok(
        err.message.includes('Requested file could not be found in storage'),
        `Unexpected error message: ${err.message}`
      );
    }
    assert.ok(threwError, 'Expected getFileBuffer to throw for missing key');
  });

  // -------------------------------------------------------------
  // Test 5: deleteFile Removes Object via DeleteObjectCommand
  // -------------------------------------------------------------
  await test('5. deleteFile issues DeleteObjectCommand and completes successfully', async () => {
    const mockClient = new MockS3Client();
    const provider = new S3StorageProvider({
      bucketName: 'learning-compass-materials',
      endpoint: 'https://test-project.supabase.co/storage/v1/s3',
      region: 'us-east-1',
      client: mockClient
    });

    const fileContent = Buffer.from('Temporary file content');
    const saveResult = await provider.saveFile({
      buffer: fileContent,
      originalName: 'temp_doc.pdf',
      mimeType: 'application/pdf',
      teacherId: 'teacher_delete'
    });

    // Delete file
    const deleteResult = await provider.deleteFile(saveResult.storageKey);
    assert.strictEqual(deleteResult, true);

    // Verify delete command was sent
    const lastCmd = mockClient.sentCommands[mockClient.sentCommands.length - 1];
    assert.ok(lastCmd instanceof DeleteObjectCommand);
    assert.strictEqual(lastCmd.input.Bucket, 'learning-compass-materials');
    assert.strictEqual(lastCmd.input.Key, saveResult.storageKey);

    // Verify subsequent get throws 404/not found
    let threw = false;
    try {
      await provider.getFileBuffer(saveResult.storageKey);
    } catch (err) {
      threw = true;
    }
    assert.ok(threw, 'Expected key to no longer exist after delete');
  });

  // -------------------------------------------------------------
  // Test 6: getFileUrl Format Consistency
  // -------------------------------------------------------------
  await test('6. getFileUrl produces consistent path-style URL for Supabase endpoint', async () => {
    const provider = new S3StorageProvider({
      bucketName: 'materials-bucket',
      endpoint: 'https://abcdef.supabase.co/storage/v1/s3',
      region: 'us-east-1'
    });

    const url = await provider.getFileUrl('materials/t1/sample.pdf');
    assert.strictEqual(url, 'https://abcdef.supabase.co/storage/v1/s3/materials-bucket/materials/t1/sample.pdf');
  });

  // -------------------------------------------------------------
  // Test 7: Stream fallback in getFileBuffer
  // -------------------------------------------------------------
  await test('7. getFileBuffer handles async iterable streams fallback properly', async () => {
    class StreamMockS3Client {
      async send(command) {
        if (command instanceof GetObjectCommand) {
          async function* generateStream() {
            yield Buffer.from('Chunk1_');
            yield Buffer.from('Chunk2_');
            yield Buffer.from('Chunk3');
          }
          return {
            Body: generateStream()
          };
        }
      }
    }

    const provider = new S3StorageProvider({
      bucketName: 'test-bucket',
      client: new StreamMockS3Client()
    });

    const buffer = await provider.getFileBuffer('test/key');
    assert.strictEqual(buffer.toString('utf8'), 'Chunk1_Chunk2_Chunk3');
  });

  // -------------------------------------------------------------
  // Test 8: storageService facade integration with S3StorageProvider
  // -------------------------------------------------------------
  await test('8. storageService facade correctly routes saveFile and getFileBuffer to S3 provider', async () => {
    const { storageService } = await import('../src/services/storage/storageService.js');
    const mockClient = new MockS3Client();
    const s3Provider = new S3StorageProvider({
      bucketName: 'facade-bucket',
      endpoint: 'https://test-project.supabase.co/storage/v1/s3',
      region: 'us-east-1',
      client: mockClient
    });

    storageService.setProvider(s3Provider);

    const testBuf = Buffer.from('Facade delegation content');
    const saveRes = await storageService.saveFile({
      buffer: testBuf,
      originalName: 'facade_test.pdf',
      mimeType: 'application/pdf',
      teacherId: 'teacher_facade'
    });

    assert.ok(saveRes.storageKey);
    const readBuf = await storageService.getFileBuffer(saveRes.storageKey);
    assert.strictEqual(readBuf.toString('utf8'), 'Facade delegation content');

    const fileUrl = await storageService.getFileUrl(saveRes.storageKey);
    assert.strictEqual(fileUrl, `https://test-project.supabase.co/storage/v1/s3/facade-bucket/${saveRes.storageKey}`);

    const delRes = await storageService.deleteFile(saveRes.storageKey);
    assert.strictEqual(delRes, true);
  });

  console.log(`\n=== S3StorageProvider Tests Completed: ${passedTests}/${totalTests} Passed ===`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
};

runS3StorageProviderTests();

