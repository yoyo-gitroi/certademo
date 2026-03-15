import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
      `Please add it to your .env.local file. ` +
      `You can find this value in your Supabase project settings.`
    );
  }
  return value;
}

let clientInstance: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client for client-side usage.
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  clientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return clientInstance;
}

/**
 * Default export: the singleton client instance.
 * Lazily initialized on first access.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

/**
 * Creates a new Supabase client for server-side usage (e.g., API routes, SSR).
 * Accepts an optional service role key for elevated permissions.
 * Each call returns a fresh client instance (no singleton).
 */
export function createServerClient(
  options?: {
    serviceRoleKey?: string;
    cookieHeader?: string;
  }
): SupabaseClient {
  const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const key = options?.serviceRoleKey
    ? options.serviceRoleKey
    : getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: options?.cookieHeader
        ? { cookie: options.cookieHeader }
        : undefined,
    },
  });

  return client;
}

export default supabase;
