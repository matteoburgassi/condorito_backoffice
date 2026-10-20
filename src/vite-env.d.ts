/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_TARGET?: 'staging' | 'prod';
  readonly VITE_SUPABASE_STAGING_URL?: string;
  readonly VITE_SUPABASE_STAGING_ANON_KEY?: string;
  readonly VITE_SUPABASE_PROD_URL?: string;
  readonly VITE_SUPABASE_PROD_ANON_KEY?: string;
  /** @deprecated Use VITE_SUPABASE_STAGING_URL */
  readonly VITE_SUPABASE_URL?: string;
  /** @deprecated Use VITE_SUPABASE_STAGING_ANON_KEY */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
