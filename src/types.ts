export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  isError?: boolean;
  groundingSources?: {
    title: string;
    uri: string;
  }[];
  file?: {
    name: string;
    type: string;
    size: number;
    base64?: string;
    textData?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  lastUpdated: string;
  messages: ChatMessage[];
}

export interface SettingsConfig {
  model: string;
  systemInstruction: string;
  temperature: number;
  useSearch: boolean;
  showAILogoGlow: boolean;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
