import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventContext';
import {
  ChatMessage,
  OPEN_ASSISTANT_EVENT,
  OpenAssistantDetail,
  UserPreferences,
  generateAssistantReply,
  invalidateAssistantCache
} from '../../services/assistantService';
import {
  EventBriefCard,
  PreferencePickerCard,
  RecommendationListCard,
  TrendingListCard
} from './AssistantCards';
import { StageGraphCard } from './StageGraphCard';
import { SalesBriefCard } from './SalesBriefCard';

/** Safe inline formatter for **bold** and *italic* emphasis in assistant replies. */
function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-kumo-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function buildWelcomeMessage(isOrganizer: boolean, currentEventTitle?: string): ChatMessage {
  if (isOrganizer) {
    return {
      id: 'welcome-organizer',
      sender: 'assistant',
      text:
        'Xin chào **Ban Tổ Chức**! Mình có thể hỗ trợ bạn **phân tích doanh thu & hiệu suất bán vé**, trực quan hoá **sơ đồ sân khấu**, **bản đồ nhiệt lấp đầy** và **biểu đồ khung giá sàn–trần** theo dữ liệu trực tiếp.',
      suggestions: [
        'Phân tích bán vé',
        'Vẽ sơ đồ sân khấu',
        'Bản đồ nhiệt lấp đầy',
        'Biểu đồ khung giá'
      ],
      timestamp: Date.now()
    };
  }

  const baseSuggestions = [
    ...(currentEventTitle ? [`Tóm tắt đêm diễn này`] : ['Tóm tắt lịch diễn']),
    'Sự kiện đang hot',
    'Gợi ý theo sở thích',
    'Concert dưới 1 triệu'
  ];

  return {
    id: 'welcome-user',
    sender: 'assistant',
    text:
      'Chào bạn! Mình là **Trợ lý Sự kiện SortMyScene**. Bạn muốn xem **tóm tắt sự kiện**, **concert đang hot**, hay nhận **gợi ý theo gu nhạc & ngân sách** của bạn?',
    suggestions: baseSuggestions,
    timestamp: Date.now()
  };
}

export const AssistantWidget: React.FC = () => {
  const { user } = useAuth();
  const { events } = useEvents();
  const location = useLocation();

  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
  const currentEventId = useMemo(() => {
    const m = location.pathname.match(/^\/events?\/([^/]+)/);
    return m ? m[1] : undefined;
  }, [location.pathname]);
  const currentEvent = useMemo(
    () => (currentEventId ? events.find(e => e.id === currentEventId || e.slug === currentEventId) : undefined),
    [events, currentEventId]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildWelcomeMessage(isOrganizer, currentEvent?.title)
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevRoleRef = useRef<boolean>(isOrganizer);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Refresh greeting when user signs in/out or changes between Customer and Organizer.
  useEffect(() => {
    if (prevRoleRef.current !== isOrganizer) {
      prevRoleRef.current = isOrganizer;
      invalidateAssistantCache();
      setMessages([buildWelcomeMessage(isOrganizer, currentEvent?.title)]);
      setExpanded(isOrganizer);
    }
  }, [isOrganizer, currentEvent?.title]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking, isOpen]);

  const sendMessage = useCallback(
    async (
      text: string,
      override?: {
        preferences?: UserPreferences;
        stageEventId?: string;
        salesEventId?: string;
        stageTab?: OpenAssistantDetail['stageTab'];
        stageOverlay?: OpenAssistantDetail['stageOverlay'];
      }
    ) => {
      const trimmed = text.trim();
      if (!trimmed && !override) return;

      const userLabel =
        trimmed ||
        (override?.salesEventId
          ? 'Phân tích bán vé & doanh thu'
          : override?.stageEventId
            ? 'Trực quan hoá biểu đồ sân khấu'
            : 'Gợi ý sự kiện theo sở thích đã chọn');

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'user',
        text: userLabel,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsThinking(true);

      const history = messagesRef.current
        .filter(m => !m.id.startsWith('welcome-'))
        .slice(-6)
        .map(m => ({
          role: m.sender,
          content: m.text
        }));

      try {
        const reply = await generateAssistantReply(
          trimmed || userLabel,
          {
            events,
            role: user?.role,
            currentEventId: currentEvent?.id ?? currentEventId,
            history
          },
          override
        );
        if (reply.payload?.kind === 'stage_graph' || reply.payload?.kind === 'sales_analysis') {
          setExpanded(true);
        }
        setMessages(prev => [
          ...prev,
          {
            ...reply,
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now()
          }
        ]);
      } catch {
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            text: 'Không thể lấy dữ liệu lúc này. Hãy thử lại sau giây lát.',
            timestamp: Date.now()
          }
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [events, user?.role, currentEvent?.id, currentEventId]
  );

  // Allow pages (e.g. OrganizerPage) to open the assistant directly to a stage graph or prompt.
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<OpenAssistantDetail>).detail ?? {};
      setIsOpen(true);
      if (detail.eventId) {
        setExpanded(true);
        const evTitle = events.find(e => e.id === detail.eventId)?.title;
        if (detail.mode === 'sales_analysis') {
          sendMessage(evTitle ? `Phân tích bán vé ${evTitle}` : 'Phân tích bán vé', {
            salesEventId: detail.eventId
          });
        } else {
          sendMessage(evTitle ? `Trực quan hoá sân khấu ${evTitle}` : 'Trực quan hoá sân khấu', {
            stageEventId: detail.eventId,
            stageTab: detail.stageTab ?? 'map',
            stageOverlay: detail.stageOverlay ?? 'price'
          });
        }
      } else if (detail.prompt) {
        sendMessage(detail.prompt);
      }
    };
    window.addEventListener(OPEN_ASSISTANT_EVENT, handler);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, handler);
  }, [events, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    sendMessage(input);
  };

  const handleReset = () => {
    invalidateAssistantCache();
    setMessages([buildWelcomeMessage(isOrganizer, currentEvent?.title)]);
  };

  // Hide on login page so the sign-in flow stays focused and distraction-free.
  if (location.pathname === '/login') {
    return null;
  }

  const isTicketSelection = /\/events\/[^/]+\/tickets/.test(location.pathname);

  return (
    <div
      style={{ zIndex: 45 }}
      className={`fixed print:hidden ${
        isOpen
          ? 'right-3 bottom-3 sm:right-5 sm:bottom-5'
          : isTicketSelection
            ? 'right-0 bottom-24 lg:bottom-4'
            : 'right-0 bottom-4'
      }`}
    >
      {isOpen ? (
        <section
          role="dialog"
          aria-label={isOrganizer ? 'Trợ lý Sân khấu Ban Tổ Chức' : 'Trợ lý Sự kiện SortMyScene'}
          className={`flex max-h-[min(82dvh,720px)] flex-col overflow-hidden rounded-[var(--radius-card)] bg-kumo-raised shadow-[var(--shadow-lift)] ring ring-kumo-line transition-[width] duration-200 motion-safe:animate-[sheet-in_220ms_var(--ease-reveal)] ${
            expanded
              ? 'w-[min(620px,calc(100vw-2rem))]'
              : 'w-[min(410px,calc(100vw-2rem))]'
          }`}
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-2 border-b border-kumo-hairline bg-kumo-base px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet text-midnight">
                {isOrganizer ? <LayoutGrid className="size-4" /> : <Sparkles className="size-4" />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="type-display truncate text-sm text-kumo-strong">
                    {isOrganizer ? 'Trợ lý Sân khấu' : 'Trợ lý Sự kiện'}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isOrganizer
                        ? 'bg-violet/20 text-violet-ink'
                        : 'bg-kumo-recessed text-kumo-subtle'
                    }`}
                  >
                    {isOrganizer ? 'Ban Tổ Chức' : 'Khán giả'}
                  </span>
                </div>
                <p className="truncate text-[11px] text-kumo-subtle">
                  {isOrganizer
                    ? 'Phân tích bán vé · Sơ đồ sân khấu · Khung giá'
                    : 'Tóm tắt · Xu hướng · Gợi ý theo sở thích'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                aria-label={expanded ? 'Thu gọn khung chat' : 'Mở rộng khung chat'}
                title={expanded ? 'Thu gọn' : 'Mở rộng'}
                className="btn-icon hidden size-8 sm:grid"
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button
                type="button"
                onClick={handleReset}
                aria-label="Làm mới hội thoại"
                title="Làm mới hội thoại"
                className="btn-icon size-8"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng trợ lý"
                className="btn-icon size-8"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map(msg => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[94%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'rounded-br-md bg-kumo-contrast text-kumo-inverse'
                        : 'w-full rounded-bl-md bg-kumo-recessed/70 text-kumo-default'
                    }`}
                  >
                    <p>{renderFormattedText(msg.text)}</p>
                    {!isUser && msg.llmModel && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-violet/15 px-2 py-0.5 text-[10px] font-medium text-violet-ink">
                        <Sparkles className="size-2.5" />
                        <span>{msg.llmModel}</span>
                      </p>
                    )}

                    {msg.payload?.kind === 'brief' && (
                      <EventBriefCard
                        events={msg.payload.events}
                        focusSingle={msg.payload.focusSingle}
                        onAskSingle={q => sendMessage(q)}
                      />
                    )}

                    {msg.payload?.kind === 'trending' && (
                      <TrendingListCard events={msg.payload.events} />
                    )}

                    {msg.payload?.kind === 'recommendations' && (
                      <RecommendationListCard items={msg.payload.items} />
                    )}

                    {msg.payload?.kind === 'preference_picker' && (
                      <PreferencePickerCard
                        genres={msg.payload.genres}
                        cities={msg.payload.cities}
                        onSubmit={prefs => {
                          const summary = [
                            prefs.genre,
                            prefs.city,
                            prefs.maxBudget ? `≤ ${Math.round(prefs.maxBudget / 1000)}k` : undefined,
                            prefs.minBudget ? `≥ ${Math.round(prefs.minBudget / 1_000_000)}tr` : undefined,
                            prefs.seating === 'standing'
                              ? 'khu đứng'
                              : prefs.seating === 'seated'
                                ? 'ghế ngồi'
                                : undefined
                          ]
                            .filter(Boolean)
                            .join(', ');
                          sendMessage(summary ? `Gợi ý cho tôi: ${summary}` : 'Gợi ý sự kiện nổi bật nhất', {
                            preferences: prefs
                          });
                        }}
                      />
                    )}

                    {msg.payload?.kind === 'sales_analysis' && (
                      <SalesBriefCard
                        initialEventId={msg.payload.eventId}
                        events={msg.payload.events}
                        initialSummary={msg.payload.serverSummary}
                        onOpenStageHeatmap={evId => {
                          const evTitle = events.find(e => e.id === evId)?.title;
                          sendMessage(evTitle ? `Bản đồ nhiệt sân khấu ${evTitle}` : 'Bản đồ nhiệt sân khấu', {
                            stageEventId: evId,
                            stageTab: 'map',
                            stageOverlay: 'occupancy'
                          });
                        }}
                      />
                    )}

                    {msg.payload?.kind === 'stage_graph' && (
                      <StageGraphCard
                        initialEventId={msg.payload.eventId}
                        events={msg.payload.events}
                        initialTab={msg.payload.initialTab}
                        initialOverlay={msg.payload.initialOverlay}
                      />
                    )}
                  </div>

                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.suggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          disabled={isThinking}
                          onClick={() => sendMessage(s)}
                          className="rounded-full bg-kumo-base px-3 py-1 text-xs font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint hover:text-kumo-strong disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-kumo-subtle">
                <span className="size-2 animate-pulse rounded-full bg-violet" />
                <span>Qwen2.5 đang phân tích dữ liệu trực tiếp...</span>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-kumo-hairline bg-kumo-base p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={
                isOrganizer
                  ? 'Hỏi phân tích doanh thu, sơ đồ sân khấu, khung giá...'
                  : 'Hỏi tóm tắt sự kiện, concert hot, gợi ý...'
              }
              aria-label="Nhập câu hỏi cho trợ lý"
              className="field h-10 flex-1 rounded-full px-4 text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              aria-label="Gửi tin nhắn"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-midnight transition-transform hover:bg-[#ab8fff] active:scale-95 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 60);
          }}
          aria-label={isOrganizer ? 'Mở Trợ lý Sân khấu' : 'Mở Trợ lý Sự kiện'}
          title={isOrganizer ? 'Trợ lý Sân khấu' : 'Trợ lý Sự kiện'}
          className="group flex h-10 items-center rounded-l-full bg-kumo-contrast/80 py-1.5 pr-2 pl-2 text-xs font-semibold text-kumo-inverse opacity-70 shadow-[var(--shadow-pop)] ring ring-kumo-line backdrop-blur-md transition-all duration-200 hover:bg-kumo-contrast hover:pr-3.5 hover:pl-2.5 hover:opacity-100 focus-visible:bg-kumo-contrast focus-visible:pr-3.5 focus-visible:pl-2.5 focus-visible:opacity-100 active:scale-[0.98]"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet text-midnight">
            {isOrganizer ? <LayoutGrid className="size-3.5" /> : <Sparkles className="size-3.5" />}
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-[140px] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[140px] group-focus-visible:opacity-100">
            {isOrganizer ? 'Trợ lý Sân khấu' : 'Trợ lý Sự kiện'}
          </span>
        </button>
      )}
    </div>
  );
};
