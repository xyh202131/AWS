interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_AGENT_PORT?: string;
  readonly VITE_DEEPSEEK_CHAT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
