import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const testGeminiConnection = async () => {
  console.log('=== TESTING GOOGLE GEMINI API CONNECTIVITY ===\n');

  let envStatus = 'FAIL';
  let sdkStatus = 'FAIL';
  let apiStatus = 'FAIL';
  let modelStatus = 'FAIL';
  let detailedError = null;

  // 1. Environment Variable Check
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    console.error('[ENV CHECK FAILED]: GEMINI_API_KEY is missing or empty in process.env / server/.env file.');
    printReport(envStatus, sdkStatus, apiStatus, modelStatus, 'GEMINI_API_KEY is missing or empty in process.env');
    process.exit(1);
  }

  envStatus = 'PASS';
  const maskedKey = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
  console.log(`[PASS] Environment variable GEMINI_API_KEY loaded successfully.`);
  console.log(`Key Details: Length=${apiKey.length}, MaskedIdentifier=${maskedKey}`);

  // 2. SDK Initialization Check
  let ai;
  try {
    ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    sdkStatus = 'PASS';
    console.log('[PASS] Google Gemini SDK (@google/genai) initialized successfully.');
  } catch (sdkErr) {
    console.error('[SDK CHECK FAILED]: Failed to initialize GoogleGenAI instance:', sdkErr.message);
    printReport(envStatus, sdkStatus, apiStatus, modelStatus, `SDK Configuration Error: ${sdkErr.message}`);
    process.exit(1);
  }

  // 3. API Request Check
  console.log('\nSending test prompt to Gemini API...');
  const promptText = 'Reply with exactly: Learning Compass Gemini connection successful';

  // Candidate models to try in order
  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;
  let successfulResponse = null;
  let usedModel = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting generateContent with model: ${modelName}...`);
      const startTime = Date.now();

      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText
      });

      const duration = Date.now() - startTime;
      const text = response.text ? response.text.trim() : '';

      apiStatus = 'PASS';
      if (text.length > 0) {
        modelStatus = 'PASS';
        successfulResponse = { text, duration, model: modelName };
        usedModel = modelName;
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Model ${modelName} attempt failed: ${err.message || err}`);
    }
  }

  if (successfulResponse) {
    console.log('\n--- GEMINI TEST RESPONSE ---');
    console.log(`Model Responded: ${successfulResponse.model}`);
    console.log(`Response Duration: ${successfulResponse.duration} ms`);
    console.log(`Output text: "${successfulResponse.text}"`);

    printReport(envStatus, sdkStatus, apiStatus, modelStatus, null);
    process.exit(0);
  } else {
    // Determine detailed error information
    const err = lastError || new Error('Unknown error making Gemini API call');
    const httpStatus = err.status || err.statusCode || err.response?.status || 'N/A';
    const errType = err.type || err.name || err.code || 'API_ERROR';
    const errMsg = err.message || String(err);

    // Classify error type
    let category = 'Unknown Error';
    const lowerMsg = errMsg.toLowerCase();

    if (httpStatus === 400 && (lowerMsg.includes('api key') || lowerMsg.includes('key_invalid') || lowerMsg.includes('unauthorized') || lowerMsg.includes('invalid_argument'))) {
      category = 'Authentication Error (Invalid or unconfigured GEMINI_API_KEY)';
    } else if (httpStatus === 403 || lowerMsg.includes('permission_denied') || lowerMsg.includes('auth')) {
      category = 'Authentication / Permission Error (API key lacks permission or IP restricted)';
    } else if (httpStatus === 429 || lowerMsg.includes('quota') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('rate limit')) {
      category = 'Quota / Rate Limit Error (Quota limit reached or insufficient API tier)';
    } else if (httpStatus === 404 || lowerMsg.includes('not found') || lowerMsg.includes('model')) {
      category = 'Model / Access Error (Requested model not available or restricted)';
    } else if (lowerMsg.includes('enotfound') || lowerMsg.includes('econnrefused') || lowerMsg.includes('fetch failed')) {
      category = 'Network / Connectivity Error (Unable to reach Google Gemini API endpoints)';
    } else {
      category = 'API / Configuration Error';
    }

    console.error('\n[FAIL - GEMINI API REQUEST ERROR]');
    console.error(`HTTP Status: ${httpStatus}`);
    console.error(`Error Type: ${errType}`);
    console.error(`Error Message: ${errMsg}`);
    console.error(`Classification: ${category}`);

    const errorReportString = `HTTP Status: ${httpStatus} | Type: ${errType} | Category: ${category} | Message: ${errMsg}`;
    printReport(envStatus, sdkStatus, apiStatus, modelStatus, errorReportString);
    process.exit(1);
  }
};

const printReport = (env, sdk, api, model, error) => {
  console.log('\n========================================');
  console.log('       GEMINI CONNECTIVITY REPORT       ');
  console.log('========================================');
  console.log(`Environment variable: ${env}`);
  console.log(`SDK initialization  : ${sdk}`);
  console.log(`API request         : ${api}`);
  console.log(`Model response      : ${model}`);
  console.log(`Error               : ${error ? error : 'None'}`);
  console.log('========================================\n');
};

testGeminiConnection();
