/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly OPENAI_API_KEY: string;
  readonly APP_URL: string;
  /** Brevo website tracker client key (public identifier, not an API secret). */
  readonly VITE_BREVO_CLIENT_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
