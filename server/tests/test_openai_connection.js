import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const testOpenAIConnection = async () => {
  console.log('=== TESTING OPENAI API CONNECTIVITY ===\n');

  // Step 1: Check environment variable loading
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    console.error('[FAIL - Environment Variable Error]: OPENAI_API_KEY is missing or empty in process.env / .env file.');
    process.exit(1);
  }

  const maskedKey = `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
  console.log(`[CONFIRMED] OPENAI_API_KEY loaded successfully from process.env.`);
  console.log(`Key Format Check: Length=${apiKey.length}, MaskedIdentifier=${maskedKey}`);

  // Step 2: Initialize official OpenAI SDK
  let openai;
  try {
    openai = new OpenAI({
      apiKey: apiKey.trim()
    });
    console.log('[CONFIRMED] Official OpenAI JavaScript SDK initialized successfully.');
  } catch (sdkErr) {
    console.error('[FAIL - SDK Configuration Error]: Failed to instantiate OpenAI SDK instance:', sdkErr.message);
    process.exit(1);
  }

  // Step 3: Make simple OpenAI API request
  console.log('\nSending test prompt to OpenAI API...');
  const promptText = 'Reply with exactly: Learning Compass AI connection successful';

  try {
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: 50,
      temperature: 0.0
    });

    const duration = Date.now() - startTime;
    const modelUsed = response.model;
    const responseText = response.choices?.[0]?.message?.content?.trim();

    console.log('\n--- OPENAI TEST RESPONSE ---');
    console.log(`Model Responded: ${modelUsed}`);
    console.log(`Response Time: ${duration} ms`);
    console.log(`Output: "${responseText}"`);

    console.log('\n=== OPENAI API CONNECTIVITY TEST PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL - OPENAI API REQUEST ERROR]');
    console.error(`Error Code / Type: ${err.code || err.type || err.name || 'UNKNOWN'}`);
    console.error(`Status Code: ${err.status || err.statusCode || 'N/A'}`);
    console.error(`Error Message: ${err.message}`);

    // Categorize failure cause
    const errMsg = err.message ? err.message.toLowerCase() : '';
    const errStatus = err.status || 0;

    if (errStatus === 401 || errMsg.includes('incorrect api key') || errMsg.includes('invalid api key') || errMsg.includes('authentication')) {
      console.error('\n--> DIAGNOSIS: Authentication / API Key Error (Invalid or revoked OPENAI_API_KEY).');
    } else if (errStatus === 404 || errMsg.includes('model_not_found') || errMsg.includes('does not exist')) {
      console.error('\n--> DIAGNOSIS: Model / API Access Error (The requested model is not available or access is restricted).');
    } else if (errStatus === 429 || errMsg.includes('quota') || errMsg.includes('rate limit')) {
      console.error('\n--> DIAGNOSIS: Rate Limit / Quota Error (Insufficient balance or API rate limit exceeded).');
    } else if (errMsg.includes('enotfound') || errMsg.includes('econnrefused') || errMsg.includes('fetch failed') || errMsg.includes('network')) {
      console.error('\n--> DIAGNOSIS: Network / API Connection Error (Unable to reach OpenAI servers).');
    } else {
      console.error('\n--> DIAGNOSIS: General API Error.');
    }

    process.exit(1);
  }
};

testOpenAIConnection();
