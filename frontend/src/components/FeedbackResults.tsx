import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import {
  FEEDBACK_CSV_URL,
  FeedbackSummary,
  ROLE_LABELS,
  SUS_ITEMS,
  TASKS,
  TesterRole,
  apiFetchFeedbackSummary,
} from '../services/feedbackService';

// Average SUS score across published studies; used only as a reference line.
const SUS_REFERENCE = 68;

const one = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
    <p className="text-sm text-kumo-subtle">{label}</p>
    <p className="type-figure mt-1 text-display-sm text-kumo-strong">{value}</p>
    {hint && <p className="mt-1 text-xs text-kumo-subtle">{hint}</p>}
  </div>
);

/** Organizer-only summary of the usability survey: SUS score, task success and comments. */
export const FeedbackResults: React.FC = () => {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(false);
    apiFetchFeedbackSummary()
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  const roles = summary
    ? (Object.keys(ROLE_LABELS) as TesterRole[])
        .filter(r => summary.byRole[r])
        .map(r => `${ROLE_LABELS[r]}: ${summary.byRole[r]}`)
        .join(', ')
    : '';

  return (
    <section aria-labelledby="feedback-results" className="mt-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="feedback-results" className="type-display text-display-sm">Kết quả khảo sát</h2>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={isLoading} className="btn btn-secondary btn-sm">
            <RefreshCw className="size-4" />
            Tải lại
          </button>
          <a href={FEEDBACK_CSV_URL} download className="btn btn-secondary btn-sm">
            <Download className="size-4" />
            Xuất CSV
          </a>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint px-3 py-2 text-sm text-kumo-danger">
          <AlertCircle className="mt-px size-4 flex-shrink-0" />
          Không thể tải kết quả khảo sát.
        </p>
      )}

      {!summary ? (
        !error && <div aria-busy="true" className="skeleton h-32 w-full rounded-card" />
      ) : summary.count === 0 || !summary.sus ? (
        <p className="rounded-xl bg-kumo-elevated px-4 py-10 text-center text-base text-kumo-subtle ring ring-kumo-line">
          Chưa có phản hồi nào. Người thử gửi phản hồi tại trang /khao-sat.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Số phản hồi" value={String(summary.count)} hint={roles} />
            <Stat label="Điểm SUS trung bình" value={one(summary.sus.mean)} hint={`Tham chiếu: ${SUS_REFERENCE}`} />
            <Stat label="Trung vị" value={one(summary.sus.median)} />
            <Stat label="Thấp nhất đến cao nhất" value={`${one(summary.sus.min)} đến ${one(summary.sus.max)}`} />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-kumo-subtle">Điểm trung bình từng câu SUS (1 đến 5)</h3>
              <ol className="space-y-3">
                {SUS_ITEMS.map((text, i) => {
                  const mean = summary.itemMeans[i] ?? 0;
                  return (
                    <li key={i}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 text-kumo-default">
                          <span className="type-figure mr-1.5 text-kumo-subtle">{i + 1}.</span>
                          {text}
                        </span>
                        <span className="type-figure flex-shrink-0 text-kumo-strong">{one(mean)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-kumo-fill" aria-hidden="true">
                        <div className="h-full rounded-full bg-violet-ink" style={{ width: `${(mean / 5) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-kumo-subtle">
                Câu lẻ nói điều tích cực, nên điểm cao là tốt. Câu chẵn nói điều tiêu cực, nên điểm thấp là tốt.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium text-kumo-subtle">Tỷ lệ hoàn thành từng bước</h3>
              <ul className="space-y-3">
                {summary.tasks.map(t => (
                  <li key={t.key} className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-base text-kumo-strong">{TASKS.find(x => x.key === t.key)?.label ?? t.key}</span>
                      <span className="type-figure text-kumo-strong">{Math.round(t.rate * 100)}%</span>
                    </div>
                    <p className="mt-1 text-sm text-kumo-subtle tabular-nums">
                      {t.done}/{t.total} người
                      {t.meanSeconds !== null && ` · trung bình ${Math.round(t.meanSeconds)} giây (${t.timedCount} người ghi)`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-kumo-subtle">Góp ý gần đây</h3>
            {summary.recent.length === 0 ? (
              <p className="text-sm text-kumo-subtle">Chưa có góp ý bằng lời.</p>
            ) : (
              <ul className="space-y-3">
                {summary.recent.map(c => (
                  <li key={c.id} className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line">
                    <p className="whitespace-pre-line text-base text-kumo-strong">{c.comment}</p>
                    <p className="mt-2 text-xs text-kumo-subtle">
                      {c.testerName || 'Ẩn danh'} · {ROLE_LABELS[c.testerRole] ?? c.testerRole} · SUS {one(c.score)} ·{' '}
                      {new Date(c.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
};
