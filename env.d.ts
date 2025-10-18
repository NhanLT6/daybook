/// <reference types="vite/client" />

// Global constants injected by Vite during build
declare const __APP_VERSION__: string;
declare const __COMMIT_MESSAGE__: string;

interface ImportMetaEnv {
  readonly VITE_XERO_USERNAME: string
  readonly VITE_XERO_PASSWORD: string
  readonly VITE_XERO_CONTACT_NAME: string
  readonly VITE_XERO_TEMPLATE_FILE_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace NodeJS {
  interface ProcessEnv {
    XERO_USERNAME: string;
    XERO_PASSWORD: string;
    XERO_CONTACT_NAME: string;
    XERO_TEMPLATE_FILE_PATH: string;
  }
}
