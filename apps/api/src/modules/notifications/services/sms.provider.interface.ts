export interface SmsSendParams {
  to: string;
  body: string;
  context?: Record<string, unknown>;
}

export interface SmsSendResult {
  providerMessageId?: string;
  rawResponse?: unknown;
}

export interface SmsProvider {
  send(params: SmsSendParams): Promise<SmsSendResult>;
  name: string;
}
