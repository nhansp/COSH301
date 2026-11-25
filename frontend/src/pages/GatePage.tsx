import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Camera, CameraOff } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { useEvents } from '../context/EventContext';
import { apiCheckin, CheckinOutcome } from '../services/gateService';

interface Detector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

const timeOf = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

/** Gate check-in (FR-16): staff scan the rotating code on a customer's ticket. */
export const GatePage: React.FC = () => {
  const { events } = useEvents();
  const [eventId, setEventId] = useState('');
  const [camera, setCamera] = useState<'off' | 'on' | 'denied' | 'unsupported'>('off');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CheckinOutcome | null>(null);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef({ payload: '', at: 0 });
  const busyRef = useRef(false);

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);

  const submit = useCallback(async (payload: string) => {
    const now = Date.now();
    // The camera sees the same code many times a second; send it once.
    if (busyRef.current || (payload === last.current.payload && now - last.current.at < 4000)) return;
    last.current = { payload, at: now };
    busyRef.current = true;
    setBusy(true);
    const res = await apiCheckin(payload, eventId);
    setFailed(res === null);
    setOutcome(res);
    if (res && navigator.vibrate) navigator.vibrate(res.result === 'VALID' ? 120 : [80, 60, 80]);
    busyRef.current = false;
    setBusy(false);
  }, [eventId]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    setCamera('off');
  }, []);

  const start = async () => {
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setCamera('on');
    } catch {
      setCamera('denied');
    }
  };

  useEffect(() => {
    if (camera !== 'on' || !window.BarcodeDetector) return;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    let alive = true;
    const loop = async () => {
      if (!alive) return;
      if (video.current && video.current.readyState >= 2) {
        try {
          const codes = await detector.detect(video.current);
          if (codes[0]?.rawValue) await submit(codes[0].rawValue);
        } catch {
          // A frame the detector cannot read; try the next one.
        }
      }
      window.setTimeout(loop, 250);
    };
    loop();
    return () => {
      alive = false;
    };
  }, [camera, submit]);

  useEffect(() => stop, [stop]);

  const tone =
    outcome?.result === 'VALID' ? 'ok' : outcome?.result === 'ALREADY_USED' ? 'warn' : outcome ? 'bad' : null;

  return (
    <PageShell tone="stage">
      <Navbar tone="stage" />
      <main className="page-enter mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-16 sm:px-6">
        <h1 className="type-display text-display-md">Soát vé</h1>
        <p className="mt-2 text-kumo-subtle">Quét mã QR trên vé của khán giả. Mỗi vé chỉ vào cổng được một lần.</p>

        <label className="mt-6 block text-sm text-kumo-subtle" htmlFor="gate-event">
          Sự kiện
        </label>
        <select
          id="gate-event"
          value={eventId}
          onChange={e => {
            setEventId(e.target.value);
            setOutcome(null);
          }}
          className="mt-1 min-h-11 w-full rounded-lg bg-kumo-base px-3 text-kumo-strong ring ring-kumo-line"
        >
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>

        <div className="mt-5 overflow-hidden rounded-card bg-black ring ring-kumo-line">
          <video ref={video} muted playsInline className={`aspect-[4/3] w-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
          {camera !== 'on' && (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
              <CameraOff aria-hidden="true" className="size-10" />
              <p>
                {camera === 'denied'
                  ? 'Trình duyệt chưa cho phép dùng camera.'
                  : camera === 'unsupported'
                    ? 'Trình duyệt này không quét được mã QR. Hãy dùng Chrome trên điện thoại, hoặc nhập mã bên dưới.'
                    : 'Bật camera để quét mã.'}
              </p>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-3">
          {camera === 'on' ? (
            <button type="button" className="btn btn-ink min-h-11" onClick={stop}>
              <CameraOff aria-hidden="true" className="size-4" /> Tắt camera
            </button>
          ) : (
            <button type="button" className="btn btn-primary min-h-11" onClick={start}>
              <Camera aria-hidden="true" className="size-4" /> Bật camera
            </button>
          )}
          {busy && <span className="self-center text-kumo-subtle">Đang kiểm tra…</span>}
        </div>

        <div aria-live="assertive" className="mt-5">
          {failed && (
            <p role="alert" className="rounded-xl bg-kumo-danger-tint p-4 text-kumo-danger">
              Không gửi được mã lên máy chủ. Kiểm tra mạng rồi quét lại.
            </p>
          )}
          {outcome && tone && (
            <div
              className={`rounded-card p-5 sm:p-6 ${
                tone === 'ok' ? 'bg-[#1f8a5b] text-white' : tone === 'warn' ? 'bg-[#f2b45a] text-[#11121a]' : 'bg-[#c2343b] text-white'
              }`}
            >
              <p className="flex items-center gap-3 text-2xl font-semibold sm:text-3xl">
                {tone === 'ok' ? (
                  <CheckCircle2 aria-hidden="true" className="size-8" />
                ) : tone === 'warn' ? (
                  <AlertTriangle aria-hidden="true" className="size-8" />
                ) : (
                  <XCircle aria-hidden="true" className="size-8" />
                )}
                {outcome.result === 'VALID'
                  ? 'Hợp lệ, mời vào'
                  : outcome.result === 'ALREADY_USED'
                    ? 'Vé đã được dùng'
                    : outcome.wrongEvent
                      ? 'Vé của sự kiện khác'
                      : outcome.result === 'VOID'
                        ? 'Vé đã bị hủy'
                        : 'Mã không hợp lệ hoặc đã hết hạn'}
              </p>
              {outcome.seatLabel && (
                <p className="mt-3 text-lg">
                  Ghế <b>{outcome.seatLabel}</b> · {outcome.zoneName}
                  {outcome.holder ? ` · ${outcome.holder}` : ''}
                </p>
              )}
              {outcome.eventName && <p className="opacity-90">{outcome.eventName}</p>}
              {outcome.result === 'ALREADY_USED' && outcome.firstUsedAt && (
                <p className="mt-1">Đã vào cổng lúc {timeOf(outcome.firstUsedAt)}.</p>
              )}
              {outcome.result === 'INVALID' && !outcome.wrongEvent && (
                <p className="mt-1">Mã đổi sau mỗi 30 giây; ảnh chụp màn hình cũ sẽ bị từ chối.</p>
              )}
              {outcome.eventCheckins != null && outcome.eventCheckins > 0 && (
                <p className="mt-3 text-sm opacity-90">Đã vào cổng: {outcome.eventCheckins} vé</p>
              )}
            </div>
          )}
        </div>

        <form
          className="mt-8 flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            if (manual.trim()) {
              last.current = { payload: '', at: 0 };
              submit(manual.trim());
            }
          }}
        >
          <label htmlFor="gate-manual" className="sr-only">
            Nhập mã thủ công
          </label>
          <input
            id="gate-manual"
            value={manual}
            onChange={e => setManual(e.target.value)}
            placeholder="Hoặc dán mã vé vào đây"
            className="min-h-11 flex-1 rounded-lg bg-kumo-base px-3 text-kumo-strong ring ring-kumo-line"
          />
          <button type="submit" className="btn btn-ink min-h-11">
            Kiểm tra
          </button>
        </form>
      </main>
    </PageShell>
  );
};
