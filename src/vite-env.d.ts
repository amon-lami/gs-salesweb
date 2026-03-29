/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Electron preload API
interface ElectronApi {
  getPlatform: () => Promise<string>;
  getConfig: () => Promise<{ supabaseUrl: string; supabaseKey: string; email: string; password: string }>;
  saveConfig: (cfg: Record<string, string>) => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}

export {};
