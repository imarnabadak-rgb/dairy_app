import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const buildDirectory = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());

// Initialize GoogleGenAI only when its optional API key is configured.
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// AI Farm Analysis API Endpoint
app.post('/api/ai/analyze-farm', async (req: Request, res: Response) => {
  try {
    const { cattleData, milkData, expensesData, revenueData, specificCow, customQuery } = req.body;

    if (!apiKey || !ai) {
      return res.status(200).json({
        success: false,
        message: 'No GEMINI_API_KEY provided in environment secrets. Using local agricultural agronomic analysis.',
      });
    }

    let prompt = '';
    let isCustomQuery = Boolean(customQuery && customQuery.trim().length > 0);

    if (isCustomQuery) {
      prompt = `You are a world-class veterinary dairy consultant, livestock nutritionist, and dairy farm financial analyst.
Here is the current real-time data for the dairy farm:
- Herd Size: ${cattleData?.length || 10} cows (${cattleData?.map((c: any) => `${c.tagNumber} ${c.name} (${c.breed}, Status: ${c.status}, Health: ${c.healthCondition}, Daily Yield: ${c.avgDailyYield}L)`).join('; ')})
- Active Antibiotic Milk Withholding: ${cattleData?.filter((c: any) => c.healthCondition === 'Withdrawal').map((c: any) => `${c.tagNumber} ${c.name}`).join(', ') || 'None'}
- Today's Milk Output: ${milkData?.totalToday || 95} Liters (Avg Fat: ${milkData?.avgFat || 4.2}%, SNF: ${milkData?.avgSnf || 8.8}%)
- Total Invoiced Revenue: ₹${revenueData?.totalInvoiced || 9292}
- Total Farm Operating Expenses: ₹${expensesData?.totalExpenses || 1135} (Feed, Vaccines, Electricity, Labor, Maintenance)

Farmer's specific question: "${customQuery}"

Provide a comprehensive, practical, and highly actionable response formatted in clean JSON with these exact keys:
{
  "directAnswer": "Clear, concise direct answer addressing the farmer's question",
  "cowHealthRecommendations": ["Actionable health/vet recommendation 1", "Actionable health/vet recommendation 2"],
  "milkMaximizationTips": ["Practical tactic to boost cow milk yield based on feeding or management 1", "Practical tactic 2"],
  "profitAndExpenseOptimization": ["How to reduce costs or grow profit related to this question 1", "How to reduce costs or grow profit 2"],
  "projectedFinancialImpact": "Estimated financial impact in rupees (e.g. +₹150/month in net revenue or 8% feed savings)"
}`;
    } else if (specificCow) {
      prompt = `You are a world-class veterinary dairy specialist and herd nutrition advisor.
Analyze this specific dairy cow:
Tag: ${specificCow.tagNumber} (${specificCow.name}), Breed: ${specificCow.breed}, Status: ${specificCow.status}, Health: ${specificCow.healthCondition}
Lactation Cycle: #${specificCow.lactationCycle}, Current Yield: ${specificCow.avgDailyYield} L/day, Weight: ${specificCow.weightKg} kg
Daily Feed Ration: Silage ${specificCow.feedRation?.silageKg || 14}kg, Concentrate ${specificCow.feedRation?.concentrateKg || 5.5}kg, Green Fodder ${specificCow.feedRation?.greenFodderKg || 12}kg, Minerals ${specificCow.feedRation?.mineralsG || 120}g
Notes/Treatment: ${specificCow.activeTreatmentNotes || 'None'} ${specificCow.notes || ''}

Provide a structured, highly actionable expert report in clean JSON format with these exact keys:
{
  "healthAssessment": "detailed health and welfare appraisal",
  "healthRiskFactors": ["risk 1", "risk 2"],
  "withholdingAdvice": "advice regarding milk safety or mastitis prevention",
  "potentialYieldIncreaseLiters": 3.2,
  "rationRecommendations": [
    "specific feed modification 1 (e.g. bypass protein or mineral booster)",
    "specific feed modification 2"
  ],
  "milkingManagementTips": ["tip 1", "tip 2"],
  "projectedRevenueImpactMonthly": 160
}`;
    } else {
      prompt = `You are an elite dairy farm management consultant, animal nutritionist, and agricultural economist.
Analyze this dairy farm's current operations:
- Total Cattle: ${cattleData?.length || 10} head (${cattleData?.filter((c: any) => c.status === 'Lactating').length || 7} milking)
- Today Milk Yield: ${milkData?.totalToday || 95} Liters, Average Fat: ${milkData?.avgFat || 4.2}%, SNF: ${milkData?.avgSnf || 8.8}%
- Antibiotic Withheld Cows: ${cattleData?.filter((c: any) => c.healthCondition === 'Withdrawal').length || 1}
- Total Revenue Invoiced: ₹${revenueData?.totalInvoiced || 9292}
- Total Farm Expenses: ₹${expensesData?.totalExpenses || 1135} (Top categories: Feed & Fodder, Veterinary, Labor, Power)
- Operating Profit Margin: ~${revenueData?.margin || 87}%

Provide a comprehensive, high-impact farm optimization and profit strategy in clean JSON format with these exact keys:
{
  "herdHealthSummary": "Executive diagnostic on somatic health, withdrawal bio-security, and reproductive status",
  "topHealthAlerts": [
    {"cow": "DF-103 Ruby", "issue": "Active mastitis antibiotic withdrawal", "priority": "High", "action": "Ensure zero milk in bulk tank, monitor California Mastitis Test score before releasing."},
    {"cow": "DF-107 Ganga", "issue": "Mild hoof sensitivity observation", "priority": "Medium", "action": "Copper sulfate footbath and soft bedding inspection."}
  ],
  "cowWiseYieldOpportunities": [
    {"cow": "DF-101 Daisy", "currentYield": 28.5, "targetYield": 32.0, "tactic": "Introduce bypass fat (Prill fat 250g) and increase protein pellets by 1.2kg during peak lactation."},
    {"cow": "DF-106 Stella", "currentYield": 31.0, "targetYield": 35.0, "tactic": "Add fermented yeast culture and split concentrate feeding into 3 equal portions to stabilize rumen pH."}
  ],
  "costReductionStrategies": [
    {"costCenter": "Feed & Fodder", "savingsMonthly": 220, "recommendation": "Bulk contract corn silage directly from regional grower and test total mixed ration (TMR) moisture weekly to reduce waste."},
    {"costCenter": "Cold Storage & Utilities", "savingsMonthly": 75, "recommendation": "Pre-cool milk using plate heat exchanger with borehole well water before entering bulk chiller silo."}
  ],
  "revenueGrowthStrategies": [
    {"initiative": "A2 Pure Indigenous Milk Premium Line", "estimatedGain": 450, "description": "Bottle Gir (DF-104) and Sahiwal (DF-107) milk separately as Certified A2 Desi Milk at 20-25% premium price."},
    {"initiative": "Commercial Cafe Subscription Expansion", "estimatedGain": 320, "description": "Offer fixed morning wholesale delivery contracts to 2 additional local artisan cafes."}
  ],
  "overallVerdict": "Overall strategic assessment on farm viability and margin expansion"
}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);

    return res.status(200).json({
      success: true,
      analysis: parsed,
      isCustomQuery,
    });
  } catch (error: any) {
    console.error('Error generating AI analysis:', error);
    return res.status(200).json({
      success: false,
      error: error.message || 'Failed to complete AI analysis',
    });
  }
});

// Mount Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(buildDirectory));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(buildDirectory, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DairyFlow ERP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
