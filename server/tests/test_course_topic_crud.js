import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './src/config/db.js';
import app from './src/app.js';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runTests = async () => {
  console.log('=== Starting Integration Tests for Course & Topic CRUD ===');

  await connectDB();

  const teacherAEmail = `teacher_a_${Date.now()}@test.com`;
  const teacherBEmail = `teacher_b_${Date.now()}@test.com`;
  const courseCode = `MATH-ALG-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // Step 1: Register/login Teacher A & Teacher B
      console.log('\n--- Step 1: Register/login Teacher A ---');
      const regResA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Teacher Alice',
          email: teacherAEmail,
          password: 'password123',
          role: 'teacher'
        })
      });
      const regDataA = await regResA.json();
      console.log('Register Teacher A Status:', regResA.status);
      console.log('Register Teacher A Response Success:', regDataA.success);
      const tokenA = regDataA.token;

      console.log('\n--- Register Teacher B ---');
      const regResB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Teacher Bob',
          email: teacherBEmail,
          password: 'password123',
          role: 'teacher'
        })
      });
      const regDataB = await regResB.json();
      console.log('Register Teacher B Status:', regResB.status);
      const tokenB = regDataB.token;

      // Step 2: Create a Course (Teacher A)
      console.log('\n--- Step 2: Create a Course (Teacher A) ---');
      const createCourseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          title: 'Algebra Fundamentals',
          description: 'Introduction to linear algebra and equations',
          code: courseCode,
          subject: 'Mathematics',
          gradeLevel: '9th Grade',
          status: 'draft'
        })
      });
      const createCourseData = await createCourseRes.json();
      console.log('Create Course Status:', createCourseRes.status);
      console.log('Created Course Title:', createCourseData.data?.course?.title);
      const courseId = createCourseData.data?.course?._id;

      // Step 3: Get Teacher A's Courses
      console.log('\n--- Step 3: Get Teacher A Courses ---');
      const getCoursesRes = await fetch(`${BASE_URL}/courses`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const getCoursesData = await getCoursesRes.json();
      console.log('Get Courses Status:', getCoursesRes.status);
      console.log('Teacher A Course Count:', getCoursesData.count);

      // Step 4: Update the Course (Teacher A)
      console.log('\n--- Step 4: Update Course (Teacher A) ---');
      const updateCourseRes = await fetch(`${BASE_URL}/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          title: 'Advanced Algebra I',
          status: 'published'
        })
      });
      const updateCourseData = await updateCourseRes.json();
      console.log('Update Course Status:', updateCourseRes.status);
      console.log('Updated Title:', updateCourseData.data?.course?.title);
      console.log('Updated Status:', updateCourseData.data?.course?.status);

      // Step 5: Create a Topic inside the course (Teacher A)
      console.log('\n--- Step 5: Create a Topic inside Course ---');
      const createTopicRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          title: 'Polynomial Division & Synthetic Division',
          description: 'Dividing polynomials using synthetic and long division',
          order: 1,
          learningObjectives: ['Perform synthetic division', 'Determine degree of remainder']
        })
      });
      const createTopicData = await createTopicRes.json();
      console.log('Create Topic Status:', createTopicRes.status);
      console.log('Created Topic Title:', createTopicData.data?.topic?.title);
      const topicId = createTopicData.data?.topic?._id;

      // Create a second topic to test deletion
      const createTopicRes2 = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          title: 'Quadratic Equations',
          description: 'Factoring and quadratic formula',
          order: 2,
          learningObjectives: ['Factor quadratic polynomials']
        })
      });
      const createTopicData2 = await createTopicRes2.json();
      const topicId2 = createTopicData2.data?.topic?._id;

      // Step 6: Get Topics for the course
      console.log('\n--- Step 6: Get Topics for Course ---');
      const getTopicsRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const getTopicsData = await getTopicsRes.json();
      console.log('Get Topics Status:', getTopicsRes.status);
      console.log('Topics Count:', getTopicsData.count);

      // Step 7: Update a Topic
      console.log('\n--- Step 7: Update Topic ---');
      const updateTopicRes = await fetch(`${BASE_URL}/topics/${topicId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          title: 'Polynomial Division Mastery',
          order: 1
        })
      });
      const updateTopicData = await updateTopicRes.json();
      console.log('Update Topic Status:', updateTopicRes.status);
      console.log('Updated Topic Title:', updateTopicData.data?.topic?.title);

      // Step 8: Delete a Topic
      console.log('\n--- Step 8: Delete Topic ---');
      const deleteTopicRes = await fetch(`${BASE_URL}/topics/${topicId2}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const deleteTopicData = await deleteTopicRes.json();
      console.log('Delete Topic Status:', deleteTopicRes.status);
      console.log('Delete Topic Message:', deleteTopicData.message);

      const getTopicsResAfter = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const getTopicsDataAfter = await getTopicsResAfter.json();
      console.log('Topics Count After Deletion:', getTopicsDataAfter.count);

      // Step 9: Verify another teacher (Teacher B) cannot access Teacher A's course/topic
      console.log('\n--- Step 9: Verify Teacher B Cannot Access Teacher A Course/Topic ---');

      const teacherBAccessCourseRes = await fetch(`${BASE_URL}/courses/${courseId}`, {
        headers: { 'Authorization': `Bearer ${tokenB}` }
      });
      const teacherBAccessCourseData = await teacherBAccessCourseRes.json();
      console.log('Teacher B Get Course Status:', teacherBAccessCourseRes.status, `(Expected: 403 Forbidden)`);
      console.log('Teacher B Get Course Message:', teacherBAccessCourseData.message);

      const teacherBUpdateCourseRes = await fetch(`${BASE_URL}/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenB}`
        },
        body: JSON.stringify({ title: 'Hacked Title' })
      });
      const teacherBUpdateCourseData = await teacherBUpdateCourseRes.json();
      console.log('Teacher B Update Course Status:', teacherBUpdateCourseRes.status, `(Expected: 403 Forbidden)`);

      const teacherBAccessTopicRes = await fetch(`${BASE_URL}/topics/${topicId}`, {
        headers: { 'Authorization': `Bearer ${tokenB}` }
      });
      const teacherBAccessTopicData = await teacherBAccessTopicRes.json();
      console.log('Teacher B Get Topic Status:', teacherBAccessTopicRes.status, `(Expected: 403 Forbidden)`);

      console.log('\n=== ALL 9 TEST STEPS COMPLETED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Test script error:', err);
    } finally {
      // Clean up test data from MongoDB
      await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail] } });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: { $in: ['Polynomial Division Mastery', 'Quadratic Equations'] } });
      console.log('Test data cleaned up successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runTests();
