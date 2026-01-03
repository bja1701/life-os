
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mocking the server action import by just defining the logic here if direct import fails
// But let's try to import first. 
// Note: 'use server' functions can be tricky to test in isolation without Next.js structure.
// So for this test, I will re-implement the core AI call to verify the API Key and Prompt work.
// This ensures we are testing the *integration* (Key + Gemini), not the Next.js Action glue (which is standard).

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
    console.log('🧪 Testing Gemini API Integration...');

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ No API Key found in .env.local');
        process.exit(1);
    }
    console.log('✅ API Key found');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            responseMimeType: 'application/json'
        }
    });

    const goal = "Organize a garage sale";
    console.log(`\n🎯 Goal: "${goal}"`);
    console.log('🔄 Generating subtasks...');

    const prompt = `Break this goal into 3-5 actionable sub-tasks: "${goal}". 
  For each, provide a 'title', 'duration_minutes' (number), 'priority' (High/Medium/Low), and 'energy_level' (High/Low). 
  Return ONLY valid JSON array.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('\n📄 Raw Response:');
        console.log(text);

        const data = JSON.parse(text);
        console.log('\n✅ Parsed JSON:');
        console.table(data);

    } catch (error) {
        console.error('❌ Error generating content:', error);
    }
}

testGemini();
