import OpenAI from "openai";
import { db } from "@workspace/db";
import { apiConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai as integrationOpenAI } from "./openai";

let cachedClient: OpenAI | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30_000;

export async function getDynamicOpenAI(): Promise<OpenAI> {
  const now = Date.now();
  if (cachedClient && now < cacheExpiry) return cachedClient;

  try {
    const [config] = await db
      .select()
      .from(apiConfigTable)
      .where(eq(apiConfigTable.keyName, "openai_api_key"));

    if (config?.keyValue) {
      cachedClient = new OpenAI({
        apiKey: config.keyValue,
        baseURL: "https://api.openai.com/v1",
      });
      cacheExpiry = now + CACHE_TTL_MS;
      return cachedClient;
    }
  } catch {
    // Fall through to integration client
  }

  cachedClient = integrationOpenAI;
  cacheExpiry = now + CACHE_TTL_MS;
  return integrationOpenAI;
}

export function invalidateOpenAICache(): void {
  cachedClient = null;
  cacheExpiry = 0;
}
