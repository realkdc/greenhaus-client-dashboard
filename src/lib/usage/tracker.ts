import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Monthly usage limits
const USAGE_LIMITS = {
  MONTHLY_COST_LIMIT: 5.0, // $5 per month
  WARNING_THRESHOLD: 0.8, // 80% of limit
};

// Estimated costs per operation (in USD)
const OPERATION_COSTS = {
  GPT5_MINI_PER_1K_INPUT_TOKENS: 0.00015, // $0.15 per 1M tokens
  GPT5_MINI_PER_1K_OUTPUT_TOKENS: 0.0006, // $0.60 per 1M tokens
  AVERAGE_CAPTION_REQUEST: 0.02, // Rough estimate: ~$0.02 per caption generation
};

interface UsageRecord {
  month: string; // Format: "YYYY-MM"
  totalCost: number;
  requestCount: number;
  lastUpdated: Date;
}

interface UsageCheckResult {
  allowed: boolean;
  currentCost: number;
  limit: number;
  remainingCost: number;
  percentUsed: number;
  warningMessage?: string;
}

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Get or create usage record for current month
async function getUsageRecord(): Promise<UsageRecord> {
  const month = getCurrentMonth();
  const docRef = adminDb.collection("usage").doc(month);

  const doc = await docRef.get();

  if (doc.exists) {
    return doc.data() as UsageRecord;
  }

  // Create new record for this month
  const newRecord: UsageRecord = {
    month,
    totalCost: 0,
    requestCount: 0,
    lastUpdated: new Date(),
  };

  await docRef.set(newRecord);
  return newRecord;
}

// Check if usage is within limits
export async function checkUsageLimit(): Promise<UsageCheckResult> {
  const usage = await getUsageRecord();
  const limit = USAGE_LIMITS.MONTHLY_COST_LIMIT;
  const remainingCost = limit - usage.totalCost;
  const percentUsed = (usage.totalCost / limit) * 100;

  // Check if over limit
  if (usage.totalCost >= limit) {
    return {
      allowed: false,
      currentCost: usage.totalCost,
      limit,
      remainingCost: 0,
      percentUsed,
      warningMessage: `Monthly usage limit reached. Limit will reset next month.`,
    };
  }

  // Check if approaching limit (80%)
  if (usage.totalCost >= limit * USAGE_LIMITS.WARNING_THRESHOLD) {
    return {
      allowed: true,
      currentCost: usage.totalCost,
      limit,
      remainingCost,
      percentUsed,
      warningMessage: `Approaching usage limit for this month. Please use responsibly.`,
    };
  }

  return {
    allowed: true,
    currentCost: usage.totalCost,
    limit,
    remainingCost,
    percentUsed,
  };
}

// Record usage after successful API call
export async function recordUsage(estimatedCost: number = OPERATION_COSTS.AVERAGE_CAPTION_REQUEST): Promise<void> {
  const month = getCurrentMonth();
  const docRef = adminDb.collection("usage").doc(month);

  await docRef.set(
    {
      totalCost: FieldValue.increment(estimatedCost),
      requestCount: FieldValue.increment(1),
      lastUpdated: new Date(),
    },
    { merge: true }
  );
}

// Get usage statistics for display
export async function getUsageStats(): Promise<{
  currentMonth: UsageRecord;
  percentUsed: number;
  isWarning: boolean;
  isOverLimit: boolean;
}> {
  const usage = await getUsageRecord();
  const limit = USAGE_LIMITS.MONTHLY_COST_LIMIT;
  const percentUsed = (usage.totalCost / limit) * 100;

  return {
    currentMonth: usage,
    percentUsed,
    isWarning: percentUsed >= USAGE_LIMITS.WARNING_THRESHOLD * 100,
    isOverLimit: usage.totalCost >= limit,
  };
}

// Calculate estimated cost based on token usage
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * OPERATION_COSTS.GPT5_MINI_PER_1K_INPUT_TOKENS;
  const outputCost = (outputTokens / 1000) * OPERATION_COSTS.GPT5_MINI_PER_1K_OUTPUT_TOKENS;
  return inputCost + outputCost;
}
