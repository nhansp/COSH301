import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CircleCheck } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageShell } from '../components/layout/PageShell';
import { useFeatures } from '../context/FeatureContext';
import {
  DEVICE_LABELS,
  Device,
  LIKERT_LABELS,
  ROLE_LABELS,
  SUS_ITEMS,
  TASKS,
  TaskKey,
  TesterRole,
  apiSubmitFeedback,
} from '../services/feedbackService';

const emptyTasks = (): Record<TaskKey, boolean> => ({ login: false, hold: false, pay: false, ticket: false });
const emptyTimes = (): Record<TaskKey, string> => ({ login: '', hold: '', pay: '', ticket: '' });

const SUBMIT_ERRORS = {
  rate_limited: 'Bạn gửi quá nhiều phản hồi trong một giờ. Hãy thử lại sau.',
  invalid: 'Phản hồi chưa hợp lệ. Hãy kiểm tra lại các ô đã nhập.',
  error: 'Không thể gửi phản hồi. Hãy kiểm tra kết nối và thử lại.',
} as const;

const choice =
  'flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium text-kumo-default ring ring-inset ring-kumo-line transition-colors hover:bg-kumo-tint has-checked:bg-kumo-contrast has-checked:text-kumo-inverse has-checked:ring-kumo-contrast has-focus-visible:ring-2 has-focus-visible:ring-kumo-focus';

/**
 * Usability survey for the user tests (docs/testing.md): task checklist,
 * the ten System Usability Scale items and free-text feedback.
 * Anyone can submit; no sign-in is needed.
 */
export const SurveyPage: React.FC = () => {
  const { isEnabled, isLoading } = useFeatures();
  const [role, setRole] = useState<TesterRole | ''>('');
  const [device, setDevice] = useState<Device | ''>('');
  const [name, setName] = useState('');
  const [tasks, setTasks] = useState(emptyTasks);
  const [times, setTimes] = useState(emptyTimes);
  const [answers, setAnswers] = useState<(number | null)[]>(() => SUS_ITEMS.map(() => null));
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (isLoading) {
    return (
      <PageShell className="items-center justify-center">
        <div className="size-8 rounded-full border-2 border-kumo-interact border-t-violet-ink animate-spin" />
      </PageShell>
    );
  }
  if (!isEnabled('user_testing')) return <Navigate to="/" replace />;

  const reset = () => {
    setRole('');
    setDevice('');
    setName('');
    setTasks(emptyTasks());
    setTimes(emptyTimes());
    setAnswers(SUS_ITEMS.map(() => null));
    setComment('');
    setError(null);
    setSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      setError('Hãy chọn vai trò của bạn khi thử nghiệm.');
      return;
    }
    const unanswered = answers.findIndex(a => a === null);
    if (unanswered >= 0) {
      setError(`Hãy trả lời câu ${unanswered + 1} trong thang đánh giá.`);
      document.getElementById(`sus-${unanswered + 1}`)?.scrollIntoView({ block: 'center' });
      return;
    }
    const timesSec = {} as Record<TaskKey, number | null>;
    for (const { key } of TASKS) {
      const raw = times[key].trim();
      if (raw !== '' && !/^\d{1,4}$/.test(raw)) {
        setError('Thời gian chỉ gồm số giây, ví dụ 45.');
        return;
      }
      timesSec[key] = raw === '' ? null : Number(raw);
    }

    setError(null);
    setIsSending(true);
    const result = await apiSubmitFeedback({
      testerRole: role,
      testerName: name.trim(),
      device,
      sus: answers as number[],
      tasks,
      timesSec,
      comment: comment.trim(),
    });
    setIsSending(false);
    if (result.kind === 'ok') {
      setSent(true);
      window.scrollTo({ top: 0 });
      return;
    }
    setError(SUBMIT_ERRORS[result.kind]);
  };

  return (
    <PageShell>
      <Navbar />
      <main className="page-enter mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-20 sm:px-6">
        <h1 className="type-display text-display-md">Khảo sát sử dụng</h1>

        {sent ? (
          <div role="status" className="mt-8 rounded-xl bg-kumo-success-tint p-6 text-kumo-success">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CircleCheck className="size-5 flex-shrink-0" />
              Đã ghi nhận phản hồi. Cảm ơn bạn.
            </p>
            <button type="button" onClick={reset} className="btn btn-secondary mt-5">
              Gửi phản hồi khác
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-10">
            <p className="max-w-prose text-kumo-subtle">
              Điền sau khi bạn đã thử các bước mua vé. Không cần đăng nhập và không bắt buộc ghi tên.
              Câu trả lời chỉ dùng cho báo cáo kiểm thử của môn học.
            </p>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint px-3 py-2 text-sm text-kumo-danger">
                <AlertCircle className="mt-px size-4 flex-shrink-0" />
                {error}
              </p>
            )}

            <section aria-labelledby="survey-about" className="space-y-5">
              <h2 id="survey-about" className="type-display text-title">Về bạn</h2>
              <fieldset>
                <legend className="field-label">Bạn thử với vai trò nào? *</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ROLE_LABELS) as TesterRole[]).map(r => (
                    <label key={r} className={choice}>
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="field-label">Thiết bị bạn dùng</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DEVICE_LABELS) as Device[]).map(d => (
                    <label key={d} className={choice}>
                      <input
                        type="radio"
                        name="device"
                        value={d}
                        checked={device === d}
                        onChange={() => setDevice(d)}
                        className="sr-only"
                      />
                      {DEVICE_LABELS[d]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="survey-name" className="field-label">Tên hoặc biệt danh (không bắt buộc)</label>
                <input
                  id="survey-name"
                  type="text"
                  maxLength={100}
                  autoComplete="off"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="field"
                />
              </div>
            </section>

            <section aria-labelledby="survey-tasks" className="space-y-4">
              <h2 id="survey-tasks" className="type-display text-title">Các bước đã làm</h2>
              <p className="text-sm text-kumo-subtle">
                Đánh dấu bước bạn làm được mà không cần ai chỉ. Thời gian làm (giây) có thể bỏ trống.
              </p>
              <ul className="space-y-3">
                {TASKS.map(({ key, label }) => (
                  <li key={key} className="flex flex-col gap-3 rounded-xl bg-kumo-base p-4 ring ring-kumo-line sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-kumo-strong">
                      <input
                        type="checkbox"
                        checked={tasks[key]}
                        onChange={e => setTasks({ ...tasks, [key]: e.target.checked })}
                        className="size-5 flex-shrink-0 accent-violet-ink"
                      />
                      {label}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-kumo-subtle">
                      <span className="whitespace-nowrap">Thời gian (giây)</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={times[key]}
                        onChange={e => setTimes({ ...times, [key]: e.target.value })}
                        className="field h-11 w-24 tabular-nums"
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="survey-sus" className="space-y-5">
              <h2 id="survey-sus" className="type-display text-title">Đánh giá hệ thống *</h2>
              <p className="text-sm text-kumo-subtle">
                Với mỗi câu, chọn từ 1 ({LIKERT_LABELS[0].toLowerCase()}) đến 5 ({LIKERT_LABELS[4].toLowerCase()}).
              </p>
              <ol className="space-y-6">
                {SUS_ITEMS.map((text, i) => (
                  <li key={i}>
                    <fieldset id={`sus-${i + 1}`}>
                      <legend className="mb-2 text-base font-medium text-kumo-strong">
                        <span className="type-figure mr-2 text-kumo-subtle">{i + 1}.</span>
                        {text}
                      </legend>
                      <div className="grid grid-cols-5 gap-2">
                        {LIKERT_LABELS.map((label, v) => (
                          <label key={v} title={label} className={choice}>
                            <input
                              type="radio"
                              name={`sus-${i + 1}`}
                              value={v + 1}
                              checked={answers[i] === v + 1}
                              onChange={() => setAnswers(prev => prev.map((a, j) => (j === i ? v + 1 : a)))}
                              className="sr-only"
                            />
                            <span className="type-figure">{v + 1}</span>
                            <span className="sr-only">{label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-kumo-subtle">
                        <span>{LIKERT_LABELS[0]}</span>
                        <span>{LIKERT_LABELS[4]}</span>
                      </div>
                    </fieldset>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="survey-comment" className="space-y-3">
              <h2 id="survey-comment" className="type-display text-title">Góp ý</h2>
              <label htmlFor="survey-comment-text" className="field-label">
                Điều gì khó hiểu, bị lỗi hoặc nên đổi? Điều gì làm tốt?
              </label>
              <textarea
                id="survey-comment-text"
                rows={5}
                maxLength={2000}
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="field h-auto min-h-32 py-3"
              />
            </section>

            <button type="submit" disabled={isSending} className="btn btn-primary btn-lg w-full sm:w-auto">
              {isSending ? 'Đang gửi...' : 'Gửi phản hồi'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </PageShell>
  );
};
