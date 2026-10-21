import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { buildFarmAnalysisPrompt, type FarmAnalysisPayload } from '@/lib/ai/prompts';

export const runtime = 'nodejs';

const apiKey = process.env.GEMINI_API_KEY;

// Initialised only when a key is configured; the client falls back to local
// heuristics when the AI is unavailable.
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'dairyflow-nextjs',
        },
      },
    })
  : null;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as FarmAnalysisPayload;

    if (!apiKey || !ai) {
      return NextResponse.json({
        success: false,
        message:
          'No GEMINI_API_KEY provided in environment secrets. Using local agricultural agronomic analysis.',
      });
    }

    const { prompt, isCustomQuery } = buildFarmAnalysisPrompt(payload);

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ?? '{}';
    const analysis = JSON.parse(text);

    return NextResponse.json({
      success: true,
      analysis,
      isCustomQuery,
    });
  } catch (error) {
    console.error('Error generating AI analysis:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete AI analysis',
    });
  }
}
