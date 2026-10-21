import type { Cattle, FarmExpense } from '@/types/dairy';

export interface FarmAnalysisPayload {
  cattleData?: Cattle[];
  milkData?: {
    totalToday?: number;
    avgFat?: number;
    avgSnf?: number;
  };
  expensesData?: {
    totalExpenses?: number;
    breakdown?: FarmExpense[];
  };
  revenueData?: {
    totalInvoiced?: number;
    margin?: number;
  };
  specificCow?: Cattle;
  customQuery?: string;
}

export interface FarmAnalysisPrompt {
  prompt: string;
  isCustomQuery: boolean;
}

const money = (value: number | undefined, fallback: number) =>
  (value ?? fallback).toLocaleString('en-US');

export function buildFarmAnalysisPrompt({
  cattleData = [],
  milkData,
  expensesData,
  revenueData,
  specificCow,
  customQuery,
}: FarmAnalysisPayload): FarmAnalysisPrompt {
  const herd = cattleData
    .map(
      (cow) =>
        `${cow.tagNumber} ${cow.name} (${cow.breed}, Status: ${cow.status}, Health: ${cow.healthCondition}, Daily Yield: ${cow.avgDailyYield}L)`
    )
    .join('; ');

  const withholdingCows = cattleData
    .filter((cow) => cow.healthCondition === 'Withdrawal')
    .map((cow) => `${cow.tagNumber} ${cow.name}`)
    .join(', ');

  const lactatingCount = cattleData.filter((cow) => cow.status === 'Lactating').length;
  const isCustomQuery = Boolean(customQuery && customQuery.trim().length > 0);

  if (isCustomQuery) {
    return {
      isCustomQuery,
      prompt: `You are a world-class veterinary dairy consultant, livestock nutritionist, and dairy farm financial analyst.
Here is the current real-time data for the dairy farm:
- Herd Size: ${cattleData.length || 10} cows (${herd})
- Active Antibiotic Milk Withholding: ${withholdingCows || 'None'}
- Today's Milk Output: ${milkData?.totalToday || 95} Liters (Avg Fat: ${milkData?.avgFat || 4.2}%, SNF: ${milkData?.avgSnf || 8.8}%)
- Total Invoiced Revenue: $${money(revenueData?.totalInvoiced, 9292)}
- Total Farm Operating Expenses: $${money(expensesData?.totalExpenses, 1135)} (Feed, Vaccines, Electricity, Labor, Maintenance)

Farmer's specific question: "${customQuery}"

Provide a comprehensive, practical, and highly actionable response formatted in clean JSON with these exact keys:
{
  "directAnswer": "Clear, concise direct answer addressing the farmer's question",
  "cowHealthRecommendations": ["Actionable health/vet recommendation 1", "Actionable health/vet recommendation 2"],
  "milkMaximizationTips": ["Practical tactic to boost cow milk yield based on feeding or management 1", "Practical tactic 2"],
  "profitAndExpenseOptimization": ["How to reduce costs or grow profit related to this question 1", "How to reduce costs or grow profit 2"],
  "projectedFinancialImpact": "Estimated financial impact in dollars (e.g. +$150/month in net revenue or 8% feed savings)"
}`,
    };
  }

  if (specificCow) {
    return {
      isCustomQuery,
      prompt: `You are a world-class veterinary dairy specialist and herd nutrition advisor.
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
}`,
    };
  }

  return {
    isCustomQuery,
    prompt: `You are an elite dairy farm management consultant, animal nutritionist, and agricultural economist.
Analyze this dairy farm's current operations:
- Total Cattle: ${cattleData.length || 10} head (${lactatingCount || 7} milking)
- Today Milk Yield: ${milkData?.totalToday || 95} Liters, Average Fat: ${milkData?.avgFat || 4.2}%, SNF: ${milkData?.avgSnf || 8.8}%
- Antibiotic Withheld Cows: ${cattleData.filter((cow) => cow.healthCondition === 'Withdrawal').length || 1}
- Total Revenue Invoiced: $${money(revenueData?.totalInvoiced, 9292)}
- Total Farm Expenses: $${money(expensesData?.totalExpenses, 1135)} (Top categories: Feed & Fodder, Veterinary, Labor, Power)
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
}`,
  };
}
