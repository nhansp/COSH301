export interface AssistantLink {
  label: string;
  url: string;
}

export interface AssistantReply {
  reply: string;
  intent: string;
  /** `llm` when the language model read the question, `fallback` when keywords did. */
  mode: 'llm' | 'fallback';
  links: AssistantLink[];
  suggestions: string[];
}

export type AssistantResult =
  | { kind: 'ok'; reply: AssistantReply }
  | { kind: 'error'; message: string };

export const MAX_MESSAGE_LENGTH = 300;

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Bạn hỏi hơi nhanh. Đợi một chút rồi hỏi lại nhé.',
  feature_disabled: 'Trợ lý đang tắt.',
  empty_message: 'Bạn chưa nhập câu hỏi.',
};

const UNAVAILABLE = 'Mình chưa trả lời được lúc này. Bạn thử lại sau nhé.';
const OFFLINE = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';

/** Sends one question. `eventId` is the event page the user is on, if any. */
export async function apiAskAssistant(message: string, eventId?: string): Promise<AssistantResult> {
  try {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context: eventId ? { event: eventId } : undefined }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && typeof body?.reply === 'string') {
      return {
        kind: 'ok',
        reply: {
          reply: body.reply,
          intent: String(body.intent ?? ''),
          mode: body.mode === 'llm' ? 'llm' : 'fallback',
          links: Array.isArray(body.links) ? body.links : [],
          suggestions: Array.isArray(body.suggestions) ? body.suggestions : [],
        },
      };
    }
    return { kind: 'error', message: ERROR_MESSAGES[body?.error] ?? UNAVAILABLE };
  } catch {
    return { kind: 'error', message: OFFLINE };
  }
}
