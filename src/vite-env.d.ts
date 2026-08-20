/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent = the app runs purely local, no sync. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key. Public by design; Row Level Security is what protects data. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
