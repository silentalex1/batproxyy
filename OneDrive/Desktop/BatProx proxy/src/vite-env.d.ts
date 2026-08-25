/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  BareMux: {
    BareMuxConnection: new (worker: string) => {
      getTransport: () => Promise<string>;
      setTransport: (path: string, args: unknown[]) => Promise<void>;
    };
  };
  __uv$config: {
    prefix: string;
    encodeUrl: (url: string) => string;
    decodeUrl: (url: string) => string;
  };
}
