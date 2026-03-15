import { getAnthropicClient } from './anthropic';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  classificationUserPrompt,
} from './prompts';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_INPUT_CHARS = 4000;
const RETRY_DELAY_MS = 2000;

const VALID_DOCUMENT_TYPES = [
  'nda',
  'w9',
  'certificate_of_insurance',
  'soc2_report',
  'business_license',
  'financial_statement',
  'other',
] as const;

type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

export interface ClassificationResult {
  document_type: DocumentType;
  confidence: number;
  reason: string;
}

/**
 * Classifies a document based on its raw text content.
 * Sends the first 4000 characters to the LLM and parses the classification response.
 * Retries once after 2 seconds on failure.
 */
export async function classifyDocument(
  rawText: string
): Promise<ClassificationResult> {
  const truncatedText = rawText.slice(0, MAX_INPUT_CHARS);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        console.warn(`Retrying classification (attempt ${attempt + 1})...`);
      }

      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 256,
        system: CLASSIFICATION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: classificationUserPrompt(truncatedText),
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error(
          `Unexpected response content type: ${content.type}`
        );
      }

      const parsed = JSON.parse(content.text) as {
        document_type: string;
        confidence: number;
        reason: string;
      };

      // Validate document_type against the allowed enum
      if (!isValidDocumentType(parsed.document_type)) {
        console.warn(
          `Unknown document type "${parsed.document_type}" returned by classifier. Mapping to "other".`
        );
        parsed.document_type = 'other';
      }

      return {
        document_type: parsed.document_type as DocumentType,
        confidence: parsed.confidence,
        reason: parsed.reason,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));
      console.error(
        `Classification attempt ${attempt + 1} failed:`,
        lastError.message
      );
    }
  }

  throw new Error(
    `Document classification failed after 2 attempts: ${lastError?.message}`
  );
}

function isValidDocumentType(type: string): type is DocumentType {
  return (VALID_DOCUMENT_TYPES as readonly string[]).includes(type);
}
