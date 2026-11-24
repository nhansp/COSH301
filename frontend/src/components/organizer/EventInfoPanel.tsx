import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ImageOff, Info, PencilLine, Save, X } from 'lucide-react';
import { EVENT_STATUSES, EventStatusBadge, formatDateTime, statusLabel } from './EventStatus';
import { EventInfo, OrganizerEventDetail, apiUpdateOrganizerEvent, eventSaveMessage, EVENT_FIELD_LABEL } from '../../services/organizerService';

/** ISO time → value for <input type="datetime-local">, in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

type Draft = Omit<EventInfo, 'startsAt' | 'endsAt' | 'salesStartsAt' | 'salesEndsAt' | 'maxTicketsPerUser'> & {
  startsAt: string;
  endsAt: string;
  salesStartsAt: string;
  salesEndsAt: string;
  maxTicketsPerUser: string;
};

const toDraft = (e: EventInfo): Draft => ({
  ...e,
  startsAt: toLocalInput(e.startsAt),
  endsAt: toLocalInput(e.endsAt),
  salesStartsAt: toLocalInput(e.salesStartsAt),
  salesEndsAt: toLocalInput(e.salesEndsAt),
  maxTicketsPerUser: String(e.maxTicketsPerUser)
});

const validImage = (v: string) => v === '' || (v.startsWith('/') && !v.startsWith('//')) || /^https?:\/\/[^\s/]+/.test(v);

/** Field → message for what the server would also reject; empty when the draft can be sent. */
function validate(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.name.trim()) errors.name = 'Nhập tên sự kiện.';
  if (!validImage(d.imageUrl.trim())) errors.imageUrl = 'Dùng đường dẫn bắt đầu bằng / hoặc http(s)://.';
  if (!d.venueName.trim()) errors.venueName = 'Nhập tên địa điểm.';
  if (!d.startsAt) errors.startsAt = 'Chọn giờ bắt đầu.';
  if (!d.endsAt || (d.startsAt && d.endsAt <= d.startsAt)) errors.endsAt = 'Giờ kết thúc phải sau giờ bắt đầu.';
  if (d.salesStartsAt && d.salesEndsAt && d.salesEndsAt <= d.salesStartsAt) errors.salesEndsAt = 'Giờ đóng bán phải sau giờ mở bán.';
  else if (d.salesEndsAt && d.endsAt && d.salesEndsAt > d.endsAt) errors.salesEndsAt = 'Không đóng bán sau khi sự kiện kết thúc.';
  const max = Number(d.maxTicketsPerUser);
  if (!/^\d+$/.test(d.maxTicketsPerUser) || max < 1 || max > 20) errors.maxTicketsPerUser = 'Từ 1 đến 20 vé.';
  return errors;
}

const Field: React.FC<{ label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  error,
  hint,
  children,
  className = ''
}) => (
  <label className={`block ${className}`}>
    <span className="field-label">{label}</span>
    {children}
    {error ? (
      <span className="mt-1 block text-xs text-kumo-danger">{error}</span>
    ) : (
      hint && <span className="mt-1 block text-xs text-kumo-subtle">{hint}</span>
    )}
  </label>
);

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
    <dt className="text-sm text-kumo-subtle">{label}</dt>
    <dd className="text-kumo-default">{children}</dd>
  </div>
);

/** An event's information, read-only until the organizer chooses to edit it. */
export const EventInfoPanel: React.FC<{
  event: OrganizerEventDetail;
  startEditing: boolean;
  onSaved: (e: OrganizerEventDetail) => void;
}> = ({ event, startEditing, onSaved }) => {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState<Draft>(() => toDraft(event));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(toDraft(event));
  }, [event, editing]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(event));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const updated = await apiUpdateOrganizerEvent(event.id, {
        ...draft,
        startsAt: fromLocalInput(draft.startsAt)!,
        endsAt: fromLocalInput(draft.endsAt)!,
        salesStartsAt: fromLocalInput(draft.salesStartsAt),
        salesEndsAt: fromLocalInput(draft.salesEndsAt),
        maxTicketsPerUser: Number(draft.maxTicketsPerUser)
      });
      onSaved(updated);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setSaveError(eventSaveMessage(err));
      const field = (err as { field?: string }).field;
      if (field) setErrors({ [field]: `${EVENT_FIELD_LABEL[field] ?? field} không hợp lệ.` });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(toDraft(event));
    setErrors({});
    setSaveError(null);
    setEditing(false);
  };

  if (!editing) {
    return (
      <section aria-labelledby="info-title" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="info-title" className="text-xl font-semibold text-kumo-strong">
            Thông tin sự kiện
          </h2>
          <button type="button" className="btn btn-ink" onClick={() => setEditing(true)}>
            <PencilLine className="size-4" /> Chỉnh sửa
          </button>
        </div>
        {saved && (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-kumo-success-tint px-3 py-2 text-sm text-kumo-success">
            <CheckCircle2 className="size-4" /> Đã lưu. Trang sự kiện của khán giả đã dùng thông tin mới.
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <figure className="overflow-hidden rounded-2xl bg-kumo-fill ring ring-kumo-line">
            {event.imageUrl ? (
              <img src={event.imageUrl} alt={`Ảnh bìa ${event.name}`} referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center text-kumo-subtle">
                <ImageOff className="size-8" />
              </div>
            )}
            {event.imageCredit && <figcaption className="px-3 py-2 text-xs text-kumo-subtle">{event.imageCredit}</figcaption>}
          </figure>
          <dl className="space-y-4 rounded-2xl bg-kumo-base p-5 ring ring-kumo-line">
            <Detail label="Tên sự kiện">
              <span className="font-semibold text-kumo-strong">{event.name}</span>
            </Detail>
            <Detail label="Trạng thái bán">
              <EventStatusBadge status={event.status} />
            </Detail>
            <Detail label="Thể loại">{event.genre || '—'}</Detail>
            <Detail label="Thời gian diễn">
              <span className="tabular-nums">
                {formatDateTime(event.startsAt)} → {formatDateTime(event.endsAt)}
              </span>
            </Detail>
            <Detail label="Thời gian bán vé">
              <span className="tabular-nums">
                {event.salesStartsAt ? formatDateTime(event.salesStartsAt) : 'Từ khi tạo sự kiện'} →{' '}
                {event.salesEndsAt ? formatDateTime(event.salesEndsAt) : 'đến giờ diễn'}
              </span>
            </Detail>
            <Detail label="Địa điểm">
              {event.venueName}
              {event.venueAddress && <span className="block text-sm text-kumo-subtle">{event.venueAddress}</span>}
            </Detail>
            <Detail label="Thành phố">{event.city || '—'}</Detail>
            <Detail label="Vé tối đa mỗi tài khoản">{event.maxTicketsPerUser}</Detail>
            <Detail label="Mô tả">
              <p className="text-sm leading-relaxed whitespace-pre-line">{event.description || '—'}</p>
            </Detail>
          </dl>
        </div>
      </section>
    );
  }

  const input = (key: keyof Draft, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      {...props}
      className={`field mt-1.5 ${errors[key] ? 'ring-2 ring-kumo-danger' : ''} ${props.className ?? ''}`}
      value={draft[key] as string}
      onChange={e => set(key, e.target.value as never)}
      aria-invalid={!!errors[key]}
    />
  );

  return (
    <form onSubmit={save} aria-labelledby="edit-title" className="space-y-5" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="edit-title" className="text-xl font-semibold text-kumo-strong">
          Chỉnh sửa thông tin
        </h2>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={cancel} disabled={saving}>
            <X className="size-4" /> Hủy
          </button>
          <button type="submit" className="btn btn-ink" disabled={saving || !dirty}>
            <Save className="size-4" /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint px-3 py-2 text-sm text-kumo-danger">
          <AlertCircle className="mt-px size-4 flex-shrink-0" />
          {saveError}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="space-y-4 rounded-2xl bg-kumo-base p-5 ring ring-kumo-line">
          <legend className="px-1 text-sm font-semibold text-kumo-strong">Thông tin chung</legend>
          <Field label="Tên sự kiện" error={errors.name}>
            {input('name', { maxLength: 255, required: true })}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thể loại" error={errors.genre} hint="Ví dụ: V-pop, K-pop, Ballad">
              {input('genre', { maxLength: 100 })}
            </Field>
            <Field label="Trạng thái bán" error={errors.status}>
              <select className="field mt-1.5" value={draft.status} onChange={e => set('status', e.target.value)}>
                {EVENT_STATUSES.map(s => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {(draft.status === 'DRAFT' || draft.status === 'CANCELLED') && draft.status !== event.status && (
            <p className="flex items-start gap-2 rounded-lg bg-kumo-warning-tint px-3 py-2 text-sm text-kumo-warning">
              <Info className="mt-px size-4 flex-shrink-0" />
              Sự kiện ở trạng thái này sẽ không còn hiện trong lịch diễn của khán giả.
            </p>
          )}
          <Field label="Mô tả" error={errors.description}>
            <textarea
              className="field mt-1.5 h-40 py-3 leading-relaxed"
              maxLength={10000}
              value={draft.description}
              onChange={e => set('description', e.target.value)}
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-4 rounded-2xl bg-kumo-base p-5 ring ring-kumo-line">
          <legend className="px-1 text-sm font-semibold text-kumo-strong">Ảnh bìa</legend>
          <div className="overflow-hidden rounded-xl bg-kumo-fill">
            {draft.imageUrl && validImage(draft.imageUrl.trim()) ? (
              <img src={draft.imageUrl} alt="Xem trước ảnh bìa" referrerPolicy="no-referrer" className="aspect-[16/9] w-full object-cover" />
            ) : (
              <div className="grid aspect-[16/9] place-items-center text-sm text-kumo-subtle">Chưa có ảnh xem trước</div>
            )}
          </div>
          <Field label="Đường dẫn ảnh" error={errors.imageUrl} hint="Ảnh trong /events/… của trang, hoặc một địa chỉ http(s).">
            {input('imageUrl', { maxLength: 2000, inputMode: 'url' })}
          </Field>
          <Field label="Ghi công ảnh" error={errors.imageCredit} hint="Tác giả và giấy phép, bắt buộc với ảnh Wikimedia.">
            {input('imageCredit', { maxLength: 500 })}
          </Field>
        </fieldset>

        <fieldset className="space-y-4 rounded-2xl bg-kumo-base p-5 ring ring-kumo-line">
          <legend className="px-1 text-sm font-semibold text-kumo-strong">Thời gian</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bắt đầu" error={errors.startsAt}>
              {input('startsAt', { type: 'datetime-local' })}
            </Field>
            <Field label="Kết thúc" error={errors.endsAt}>
              {input('endsAt', { type: 'datetime-local' })}
            </Field>
            <Field label="Mở bán" error={errors.salesStartsAt} hint="Để trống: mở bán từ khi tạo sự kiện.">
              {input('salesStartsAt', { type: 'datetime-local' })}
            </Field>
            <Field label="Đóng bán" error={errors.salesEndsAt} hint="Để trống: bán đến giờ diễn.">
              {input('salesEndsAt', { type: 'datetime-local' })}
            </Field>
          </div>
          <Field label="Vé tối đa mỗi tài khoản" error={errors.maxTicketsPerUser} className="sm:w-1/2">
            {input('maxTicketsPerUser', { inputMode: 'numeric' })}
          </Field>
        </fieldset>

        <fieldset className="space-y-4 rounded-2xl bg-kumo-base p-5 ring ring-kumo-line">
          <legend className="px-1 text-sm font-semibold text-kumo-strong">Địa điểm</legend>
          {event.venueShared && (
            <p className="flex items-start gap-2 rounded-lg bg-kumo-info-tint px-3 py-2 text-sm text-kumo-info">
              <Info className="mt-px size-4 flex-shrink-0" />
              Địa điểm này dùng chung với sự kiện khác, nên tên và địa chỉ không sửa ở đây được.
            </p>
          )}
          <Field label="Tên địa điểm" error={errors.venueName}>
            {input('venueName', { maxLength: 200, disabled: event.venueShared })}
          </Field>
          <Field label="Địa chỉ" error={errors.venueAddress}>
            {input('venueAddress', { maxLength: 500, disabled: event.venueShared })}
          </Field>
          <Field label="Thành phố" error={errors.city} hint="Dùng cho bộ lọc thành phố ở trang chủ.">
            {input('city', { maxLength: 100 })}
          </Field>
        </fieldset>
      </div>
    </form>
  );
};
