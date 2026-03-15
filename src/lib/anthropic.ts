import Anthropic from '@anthropic-ai/sdk';

let clientInstance: Anthropic | null = null;

/**
 * Returns a singleton Anthropic client.
 * Uses the ANTHROPIC_API_KEY environment variable.
 * Throws a descriptive error if the key is missing.
 */
export function getAnthropicClient(): Anthropic {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing environment variable: ANTHROPIC_API_KEY. ' +
      'Please add it to your .env.local file. ' +
      'You can find this value in your Anthropic dashboard at https://console.anthropic.com/.'
    );
  }

  clientInstance = new Anthropic({ apiKey });

  return clientInstance;
}

/**
 * Default export: the singleton Anthropic client instance.
 * Lazily initialized on first access.
 */
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const client = getAnthropicClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default anthropic;
