import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFeatures } from '../../context/FeatureContext';
import { apiAskAssistant, MAX_MESSAGE_LENGTH, type AssistantLink } from '../../services/assistantService';

interface ChatMessage {
  id: number;
  from: 'user' | 'bot';
  text: string;
  links?: AssistantLink[];
  isError?: boolean;
}

const WELCOME =
  'Chào bạn, mình là trợ lý của COSH301. Bạn cần hỏi gì về lịch diễn, giá vé, ghế còn trống hay cách đặt vé?';

const CUSTOMER_QUESTIONS = ['Tuần này có concert nào?', 'Concert Mỹ Tâm còn vé khu nào?', 'Cách đặt vé thế nào?'];
const ORGANIZER_QUESTION = 'Doanh số sự kiện của tôi';

/** Stage pages are always dark, whatever the visitor chose; the widget follows the page it sits on. */
function useStageTone(): boolean {
  const [stage, setStage] = useState(() => document.body.dataset.tone === 'stage');
  useEffect(() => {
    const read = () => setStage(document.body.dataset.tone === 'stage');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-tone'] });
    return () => observer.disconnect();
  }, []);
  return stage;
}

/** Floating chat for questions about events, prices, seats and (for organizers) sales. */
export const AssistantWidget: React.FC = () => {
  const { isEnabled, isLoading } = useFeatures();
  const { user } = useAuth();
  const location = useLocation();
  const pageMatch = useMatch('/events/:id/*');
  const legacyPageMatch = useMatch('/event/:id');
  const pageEventId = (pageMatch ?? legacyPageMatch)?.params.id;
  const stage = useStageTone();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, from: 'bot', text: WELCOME }]);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);

  const nextId = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
  const startQuestions = isOrganizer ? [...CUSTOMER_QUESTIONS, ORGANIZER_QUESTION] : CUSTOMER_QUESTIONS;
  const chips = suggestions ?? startQuestions;

  // Focus follows the panel: into the input when it opens, back to the launcher when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) launcherRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending, open]);

  if (isLoading || !isEnabled('chatbot')) return null;

  const close = () => setOpen(false);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || pending) return;
    setMessages(prev => [...prev, { id: nextId.current++, from: 'user', text }]);
    setInput('');
    setSuggestions([]);
    setPending(true);
    const result = await apiAskAssistant(text, pageEventId);
    setPending(false);
    if (result.kind === 'ok') {
      setMessages(prev => [
        ...prev,
        { id: nextId.current++, from: 'bot', text: result.reply.reply, links: result.reply.links },
      ]);
      setSuggestions(result.reply.suggestions.slice(0, 3));
    } else {
      setMessages(prev => [...prev, { id: nextId.current++, from: 'bot', text: result.message, isError: true }]);
      setSuggestions(null);
    }
  };

  // Phones: the pages with a sticky bottom bar need the launcher above it.
  const hasBottomBar = /^\/events?\//.test(location.pathname);
  const launcherOffset = hasBottomBar ? 'bottom-24 lg:bottom-6' : 'bottom-6';

  // The gate scanner is a work tool on a phone; the launcher would cover the scan result.
  if (location.pathname === '/soat-ve') return null;

  return (
    <div data-mode={stage ? 'dark' : undefined}>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="assistant-panel"
        style={{ zIndex: 'var(--z-sheet)' }}
        className={`btn btn-ink fixed right-4 h-12 gap-2 px-5 shadow-[var(--shadow-pop)] sm:right-6 ${launcherOffset} ${open ? 'hidden' : ''}`}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        Trợ lý
      </button>

      {open && (
        <section
          id="assistant-panel"
          role="dialog"
          aria-label="Trợ lý COSH301"
          onKeyDown={e => {
            if (e.key === 'Escape') close();
          }}
          style={{ zIndex: 'var(--z-modal)' }}
          className="fixed inset-x-3 bottom-3 flex h-[min(34rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-[var(--radius-card)] bg-kumo-raised text-kumo-default shadow-[var(--shadow-pop)] ring ring-kumo-line sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
        >
          <header className="flex items-center justify-between border-b border-kumo-hairline py-2 pr-2 pl-4">
            <h2 className="text-base font-semibold text-kumo-strong">Trợ lý COSH301</h2>
            <button type="button" onClick={close} aria-label="Đóng trợ lý" className="btn-icon">
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label="Cuộc trò chuyện"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col gap-2 ${m.from === 'user' ? 'items-end' : 'items-start'}`}>
                <p
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-base whitespace-pre-line ${
                    m.from === 'user'
                      ? 'bg-kumo-contrast text-kumo-inverse'
                      : m.isError
                        ? 'bg-kumo-danger-tint text-kumo-danger'
                        : 'bg-kumo-recessed text-kumo-default'
                  }`}
                >
                  {m.text}
                </p>
                {m.links && m.links.length > 0 && (
                  <ul className="flex max-w-[88%] flex-wrap gap-2">
                    {m.links.map(link => (
                      <li key={link.url}>
                        <Link
                          to={link.url}
                          onClick={() => {
                            if (window.matchMedia('(max-width: 639px)').matches) setOpen(false);
                          }}
                          className="chip h-9 text-kumo-link underline decoration-violet-ink/50 underline-offset-4"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {pending && (
              <p className="max-w-[88%] rounded-2xl bg-kumo-recessed px-3.5 py-2.5 text-base text-kumo-subtle">
                Đang trả lời…
              </p>
            )}
          </div>

          {chips.length > 0 && !pending && (
            <ul className="flex max-h-36 flex-wrap gap-2 overflow-y-auto px-4 pb-2" aria-label="Câu hỏi gợi ý">
              {chips.map(q => (
                <li key={q} className="max-w-full">
                  <button type="button" className="chip max-w-full" onClick={() => send(q)}>
                    <span className="truncate">{q}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex gap-2 border-t border-kumo-hairline p-3"
            onSubmit={e => {
              e.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">
              Câu hỏi của bạn
            </label>
            <input
              id="assistant-input"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              autoComplete="off"
              placeholder="Nhập câu hỏi"
              className="field h-11 min-w-0 flex-1"
            />
            <button
              type="submit"
              disabled={pending || input.trim() === ''}
              aria-label="Gửi câu hỏi"
              className="btn btn-ink size-11 shrink-0 px-0"
            >
              <Send className="size-5" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
};
