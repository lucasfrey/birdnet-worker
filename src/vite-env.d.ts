/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE: string;
    readonly VITE_R2_PUBLIC_BASE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
