import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseTarget = 'staging' | 'prod';

export type SupabaseBranchConfig = {
  url: string;
  anonKey: string;
};

function parseTarget(raw: string | undefined): SupabaseTarget {
  if (raw === 'prod') return 'prod';
  return 'staging';
}

function resolveBranchConfig(): {
  target: SupabaseTarget;
  staging: SupabaseBranchConfig;
  prod: SupabaseBranchConfig | null;
  active: SupabaseBranchConfig;
} {
  const legacyUrl = import.meta.env.VITE_SUPABASE_URL;
  const legacyKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const staging: SupabaseBranchConfig = {
    url: import.meta.env.VITE_SUPABASE_STAGING_URL || legacyUrl || '',
    anonKey: import.meta.env.VITE_SUPABASE_STAGING_ANON_KEY || legacyKey || '',
  };

  const prodUrl = import.meta.env.VITE_SUPABASE_PROD_URL;
  const prodKey = import.meta.env.VITE_SUPABASE_PROD_ANON_KEY;
  const prod =
    prodUrl && prodKey ? { url: prodUrl, anonKey: prodKey } : null;

  const target = parseTarget(import.meta.env.VITE_SUPABASE_TARGET);
  const active = target === 'prod' && prod ? prod : staging;

  if (!active.url || !active.anonKey) {
    if (target === 'prod') {
      throw new Error(
        'Missing VITE_SUPABASE_PROD_URL or VITE_SUPABASE_PROD_ANON_KEY (required when VITE_SUPABASE_TARGET=prod)',
      );
    }
    throw new Error(
      'Missing Supabase staging credentials. Set VITE_SUPABASE_STAGING_URL and VITE_SUPABASE_STAGING_ANON_KEY, or legacy VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  if (
    import.meta.env.DEV &&
    !import.meta.env.VITE_SUPABASE_STAGING_URL &&
    legacyUrl
  ) {
    console.warn(
      '[condorito-backoffice] Using legacy VITE_SUPABASE_URL. Prefer VITE_SUPABASE_STAGING_URL + VITE_SUPABASE_PROD_URL in .env.',
    );
  }

  return { target, staging, prod, active };
}

const resolved = resolveBranchConfig();

export const supabaseTarget = resolved.target;
export const stagingSupabaseConfig = resolved.staging;
export const prodSupabaseConfig = resolved.prod;
export const activeSupabaseConfig = resolved.active;

export function isStagingTarget(): boolean {
  return supabaseTarget === 'staging';
}

export function supabaseProjectRef(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0] ?? url;
  } catch {
    return url;
  }
}

export const supabase: SupabaseClient = createClient(
  activeSupabaseConfig.url,
  activeSupabaseConfig.anonKey,
  {
    auth: { persistSession: true, autoRefreshToken: true },
  },
);
