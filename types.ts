
export enum Role {
  USER = 'user',
  BOT = 'bot'
}

export interface StructuredContent {
  esercizio: string;
  spiegazione: string;
  formule: string;
  risultato: string;
  trucchi: string;
  teoria: string;
  quaderno: string; // Sequenza di calcoli puri per il "foglio del quaderno"
}

export interface MessagePart {
  text?: string;
  image?: string; // base64
  structured?: StructuredContent;
}

export interface Message {
  id: string;
  role: Role;
  parts: MessagePart[];
  timestamp: Date;
}
