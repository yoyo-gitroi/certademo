import { getAnthropicClient } from './anthropic';
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_PROMPTS,
  GENERIC_EXTRACTION_PROMPT,
} from './prompts';

const MODEL = 'claude-sonnet-4-20250514';
const RETRY_DELAY_MS = 2000;

export interface ExtractionResult {
  [key: string]: unknown;
}

/**
 * Extracts structured data from a document based on its type.
 * Selects the appropriate extraction prompt for the document type,
 * sends the raw text to the LLM, and returns the parsed JSON result.
 * Retries once after 2 seconds on failure.
 */
export async function extractDocument(
  rawText: string,
  docType: string
): Promise<ExtractionResult> {
  const promptTemplate = EXTRACTION_PROMPTS[docType] ?? GENERIC_EXTRACTION_PROMPT;
  const userPrompt = promptTemplate.replace('{raw_text}', rawText);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        console.warn(`Retrying extraction (attempt ${attempt + 1})...`);
      }

      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error(
          `Unexpected response content type: ${content.type}`
        );
      }

      const parsed = JSON.parse(content.text) as ExtractionResult;
      return parsed;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));
      console.error(
        `Extraction attempt ${attempt + 1} failed:`,
        lastError.message
      );
    }
  }

  throw new Error(
    `Document extraction failed after 2 attempts: ${lastError?.message}`
  );
}
