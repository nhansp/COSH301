import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SeatItem } from '../types';
import { useFeatures } from '../context/FeatureContext';
import { formatPrice, apiFetchSeats, apiHoldSeat, apiReleaseSeat } from '../services/eventService';
import {
  Armchair,
  Clock,
  AlertCircle,
  CheckCircle2,
  Radio,
  X,
  ShieldCheck
} from 'lucide-react';

interface SeatMapProps {
  eventId: string;
  currency: string;
  selectedSeatIds: string[];
  onSeatsChange: (seats: SeatItem[]) => void;
  onProceedToCheckout?: (selectedSeats: SeatItem[]) => void;
  maxSeats?: number;
  /** `modal`: flat full-bleed on mobile with a sticky selection bar. */
  layout?: 'inline' | 'modal';
}

export const SeatMap: React.FC<SeatMapProps> = ({
  eventId,
  currency,
  selectedSeatIds,
  onSeatsChange,
  onProceedToCheckout,
  maxSeats = 4,
  layout = 'inline'
}) => {
  const isModal = layout === 'modal';
  const { isEnabled } = useFeatures();
  const holdEnabled = isEnabled('seat_hold');
  const limitEnabled = isEnabled('ticket_limit');
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'error' | 'info' | 'success' } | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [liveState, setLiveState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  // Server-provided hold expiry (epoch ms) per seat, known only for holds made in this session
  const [holdExpiries, setHoldExpiries] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Latest values for the long-lived SSE handlers
  const seatsRef = useRef(seats);
  const selectedIdsRef = useRef(selectedSeatIds);
  const onSeatsChangeRef = useRef(onSeatsChange);
  seatsRef.current = seats;
  selectedIdsRef.current = selectedSeatIds;
  onSeatsChangeRef.current = onSeatsChange;

  const loadSeats = useCallback(async () => {
    const apiSeats = await apiFetchSeats(eventId);
    if (!apiSeats || apiSeats.length === 0) {
      setLoadState('error');
      return;
    }
    setSeats(apiSeats);
    setLoadState('ready');

    // Align the parent's selection with the holds the server reports for this user
    const mine = apiSeats.filter(s => s.status === 'selected');
    const current = selectedIdsRef.current;
    if (mine.length !== current.length || mine.some(s => !current.includes(s.id))) {
      onSeatsChangeRef.current(mine);
    }
  }, [eventId]);

  useEffect(() => {
    setLoadState('loading');
    loadSeats();
  }, [loadSeats]);

  // Live updates over SSE; the server is the only source of seat state
  useEffect(() => {
    const sse = new EventSource(`/api/events/${eventId}/stream`);
    sse.addEventListener('connected', () => setLiveState('connected'));
    sse.onopen = () => setLiveState('connected');
    sse.onerror = () => setLiveState('disconnected');
    sse.addEventListener('update', (e: MessageEvent) => {
      try {
        const { type, seatId, status } = JSON.parse(e.data);
        if (!seatId || !status) return;
        const nextSt = status === 'AVAILABLE' ? 'available' : (status === 'SOLD' ? 'sold' : 'held');
        const isMine = selectedIdsRef.current.includes(seatId);

        setSeats(prev => prev.map(s => {
          if (s.id !== seatId) return s;
          // The stream does not say who holds a seat; our own holds stay "selected"
          if (nextSt === 'held' && (isMine || s.status === 'selected')) return { ...s, status: 'selected' };
          return { ...s, status: nextSt };
        }));

        if (isMine && (type === 'seat_released' || type === 'seat_expired')) {
          setHoldExpiries(prev => {
            const { [seatId]: _dropped, ...rest } = prev;
            return rest;
          });
          onSeatsChangeRef.current(seatsRef.current.filter(s => selectedIdsRef.current.includes(s.id) && s.id !== seatId));
          if (type === 'seat_expired') {
            showToast(`Ghế ${seatId} đã hết hạn giữ chỗ và được nhả về hệ thống.`, 'error');
          }
        }
      } catch {}
    });
    return () => sse.close();
  }, [eventId]);

  // Show temporary toast message for user feedback
  const showToast = (text: string, type: 'error' | 'info' | 'success' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Countdown to the earliest server-provided expiry among the user's current holds
  const expiries = selectedSeatIds.map(id => holdExpiries[id]).filter((at): at is number => at !== undefined);
  const earliestExpiry = expiries.length > 0 ? Math.min(...expiries) : null;
  const timeLeft = earliestExpiry === null ? null : Math.max(0, Math.ceil((earliestExpiry - now) / 1000));

  useEffect(() => {
    if (earliestExpiry === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [earliestExpiry]);

  useEffect(() => {
    if (timeLeft !== 0) return;
    // The server frees the seats and pushes the change over SSE; refetch to resync
    onSeatsChange([]);
    setHoldExpiries({});
    showToast('Đã hết hạn giữ chỗ 5 phút! Các ghế đã chọn đã được nhả về hệ thống.', 'error');
    loadSeats();
  }, [timeLeft]);

  // Seat click handler adhering to US-02 and US-03 acceptance criteria
  const handleSeatClick = async (seat: SeatItem) => {
    // 1. Given bấm vào ghế màu xám (đã bán) -> thông báo ghế không khả dụng
    if (seat.status === 'sold') {
      showToast(`Ghế ${seat.id} (${seat.zoneName}) đã bán, không thể chọn!`, 'error');
      return;
    }

    // 2. Given bấm vào ghế đang được giữ bởi người khác -> thông báo ghế đang được giữ
    if (seat.status === 'held') {
      showToast(`Ghế ${seat.id} đang được người khác giữ trong 5 phút. Vui lòng chọn ghế khác!`, 'error');
      return;
    }

    // Selecting a seat creates a hold, so it is unavailable when holding is off
    if (!holdEnabled) {
      showToast('Tính năng giữ chỗ đang tạm tắt, hiện chưa thể chọn ghế.', 'info');
      return;
    }

    const isAlreadySelected = selectedSeatIds.includes(seat.id);

    if (isAlreadySelected) {
      // Deselect seat & release hold on server
      apiReleaseSeat(eventId, seat.id).catch(() => {});
      setSeats(prev => prev.map(s => (s.id === seat.id ? { ...s, status: 'available' } : s)));
      setHoldExpiries(prev => {
        const { [seat.id]: _dropped, ...rest } = prev;
        return rest;
      });
      const nextSeats = seats.filter(s => selectedSeatIds.includes(s.id) && s.id !== seat.id);
      onSeatsChange(nextSeats);
      showToast(`Đã bỏ chọn ghế ${seat.id}`, 'info');
    } else {
      // The server enforces the real limit; this only saves a round trip when ticket_limit is on.
      if (limitEnabled && selectedSeatIds.length >= maxSeats) {
        showToast('Đã đạt giới hạn số vé cho sự kiện này.', 'error');
        return;
      }

      // Call backend atomic hold API
      const holdRes = await apiHoldSeat(eventId, seat.id);
      if (!holdRes.success) {
        if (holdRes.error === 'seat_not_available') {
          showToast(`Ghế ${seat.id} vừa được người khác giữ chỗ! Vui lòng chọn ghế khác.`, 'error');
          setSeats(prev => prev.map(s => s.id === seat.id ? { ...s, status: 'held' } : s));
        } else if (holdRes.error === 'ticket_limit_reached') {
          showToast('Đã đạt giới hạn số vé cho sự kiện này.', 'error');
        } else if (holdRes.error === 'unauthorized') {
          showToast('Vui lòng đăng nhập để giữ chỗ.', 'error');
        } else if (holdRes.error === 'event_not_on_sale') {
          showToast('Sự kiện hiện không mở bán.', 'error');
        } else {
          showToast(`Không thể giữ ghế ${seat.id}. Vui lòng thử lại!`, 'error');
        }
        return;
      }

      const expiresAt = holdRes.expiresAt ? Date.parse(holdRes.expiresAt) : NaN;
      if (!Number.isNaN(expiresAt)) {
        setHoldExpiries(prev => ({ ...prev, [seat.id]: expiresAt }));
      }
      setSeats(prev => prev.map(s => (s.id === seat.id ? { ...s, status: 'selected' } : s)));

      const currentlySelected = seats.filter(s => selectedSeatIds.includes(s.id));
      onSeatsChange([...currentlySelected, { ...seat, status: 'selected' }]);
      showToast(`Đã khóa giữ chỗ ghế ${seat.id} (${formatPrice(seat.price, currency)}) trong 5 phút`, 'success');
    }
  };

  const selectedSeatsList = seats.filter(s => selectedSeatIds.includes(s.id));
  const totalPrice = selectedSeatsList.reduce((sum, s) => sum + s.price, 0);

  // Group seats by Zone for structured visualization
  const zones = Array.from(new Set(seats.map(s => s.zoneId))).map(zoneId => {
    const zoneSeats = seats.filter(s => s.zoneId === zoneId);
    return {
      id: zoneId,
      name: zoneSeats[0]?.zoneName || zoneId,
      seats: zoneSeats,
      rows: Array.from(new Set(zoneSeats.map(s => s.row)))
    };
  });

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  const liveBadge = {
    connected: { label: 'Đang cập nhật trực tiếp', tone: 'bg-kumo-success-tint text-kumo-success', dot: 'bg-kumo-success animate-pulse' },
    connecting: { label: 'Đang kết nối...', tone: 'bg-kumo-warning-tint text-kumo-warning', dot: 'bg-kumo-warning' },
    disconnected: { label: 'Mất kết nối trực tiếp', tone: 'bg-kumo-danger-tint text-kumo-danger', dot: 'bg-kumo-danger' }
  }[liveState];

  return (
    <div
      className={`relative w-full bg-kumo-base p-4 sm:p-6 ${
        isModal ? 'sm:rounded-xl sm:shadow-xs sm:ring sm:ring-kumo-line' : 'rounded-xl shadow-xs ring ring-kumo-line'
      }`}
    >
      {/* Toast Notification Bar */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed inset-x-4 top-4 z-[60] mx-auto flex w-fit max-w-md items-start gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-lg ring ring-kumo-line backdrop-blur ${
            toastMessage.type === 'error'
              ? 'bg-kumo-danger-tint text-kumo-danger'
              : toastMessage.type === 'success'
              ? 'bg-kumo-success-tint text-kumo-success'
              : 'bg-kumo-info-tint text-kumo-info'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
          ) : toastMessage.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0" />
          ) : (
            <Radio className="mt-0.5 size-4 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar: Status & Controls */}
      <div className="flex flex-col gap-3 border-b border-kumo-hairline pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-start gap-2 text-lg font-semibold tracking-tight text-kumo-strong">
            <Armchair className="mt-1 size-4.5 flex-shrink-0 text-kumo-subtle" />
            <span>Sơ đồ ghế trực quan (Interactive Seat Map)</span>
          </h3>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-kumo-subtle">
            <span>Chọn ghế theo thời gian thực</span>
            {limitEnabled && <span>Tối đa {maxSeats} vé/tài khoản</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 5-minute hold timer display (US-03) */}
          {timeLeft !== null && (
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums ring ring-kumo-line ${
                timeLeft < 60
                  ? 'bg-kumo-danger-tint text-kumo-danger animate-pulse'
                  : 'bg-kumo-warning-tint text-kumo-warning'
              }`}
            >
              <Clock className="size-3.5" />
              <span>Giữ chỗ: {formatTimer(timeLeft)}</span>
            </div>
          )}

          {/* Live connection indicator (reflects the real SSE state) */}
          <div
            role="status"
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ring ring-kumo-line ${liveBadge.tone}`}
          >
            <span className={`size-1.5 rounded-full ${liveBadge.dot}`} />
            <span>{liveBadge.label}</span>
          </div>
        </div>
      </div>

      {/* Sân khấu (Stage) visual projection */}
      <div className="flex justify-center py-6">
        <div className="grid h-9 w-full max-w-xl place-items-center rounded-t-[999px] rounded-b-md bg-kumo-contrast text-xs font-medium text-kumo-inverse">
          Sân khấu chính (Main stage)
        </div>
      </div>

      {loadState !== 'ready' && (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-sm">
          {loadState === 'loading' ? (
            <>
              <div className="size-8 animate-spin rounded-full border-2 border-kumo-interact border-t-kumo-brand" />
              <span className="text-kumo-subtle">Đang tải sơ đồ ghế...</span>
            </>
          ) : (
            <>
              <span role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint px-3.5 py-2 text-kumo-danger">
                <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
                Không tải được sơ đồ ghế hoặc sự kiện chưa có ghế.
              </span>
              <button
                type="button"
                onClick={() => { setLoadState('loading'); loadSeats(); }}
                className="h-11 rounded-lg bg-kumo-base px-4 font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint sm:h-9"
              >
                Thử lại
              </button>
            </>
          )}
        </div>
      )}

      {/* Visual Seat Grid */}
      <div className="-mx-4 space-y-5 overflow-x-auto overscroll-x-contain px-4 py-1 sm:mx-0 sm:px-0">
        {zones.map(zone => (
          <div key={zone.id} className="min-w-max space-y-2">
            <div className="flex items-baseline justify-between gap-4 px-1 text-sm">
              <span className="font-medium text-kumo-strong">{zone.name}</span>
              <span className="text-xs text-kumo-subtle tabular-nums">
                {formatPrice(zone.seats[0]?.price || 0, currency)} / ghế
              </span>
            </div>

            <div className="space-y-2 rounded-lg bg-kumo-recessed p-3 sm:p-4">
              {zone.rows.map(rowLetter => {
                const rowSeats = zone.seats.filter(s => s.row === rowLetter);
                return (
                  <div key={rowLetter} className="flex items-center justify-center gap-2">
                    {/* Left Row Label */}
                    <span className="w-5 flex-shrink-0 text-center text-xs font-medium text-kumo-subtle">
                      {rowLetter}
                    </span>

                    {/* Seat Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {rowSeats.map(seat => {
                        const isSelected = selectedSeatIds.includes(seat.id);

                        // Strict color scheme according to SRS US-02:
                        // - Ghế trống: xanh lá (green)
                        // - Ghế đã bán: xám (gray)
                        // - Ghế đang được giữ: vàng cam (amber)
                        // - Ghế bạn chọn: màu mực (ink) + viền nổi bật
                        // Each state also has a non-colour cue: ring, stripes, strike-through.
                        let seatBgClass = 'bg-kumo-badge-green text-white hover:brightness-110';
                        let label = 'Trống';

                        if (isSelected) {
                          seatBgClass =
                            'bg-kumo-brand text-kumo-on-brand ring-2 ring-kumo-focus ring-offset-1 ring-offset-kumo-recessed';
                          label = 'Bạn chọn';
                        } else if (seat.status === 'sold') {
                          seatBgClass = 'bg-kumo-fill text-kumo-inactive line-through cursor-not-allowed';
                          label = 'Đã bán';
                        } else if (seat.status === 'held') {
                          seatBgClass = 'bg-kumo-badge-orange seat-held text-black/75 cursor-not-allowed';
                          label = 'Đang giữ 5p';
                        }

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleSeatClick(seat)}
                            aria-pressed={isSelected}
                            aria-label={`Ghế ${seat.id}, ${zone.name}, ${label}, ${formatPrice(seat.price, currency)}`}
                            title={`Ghế ${seat.id} – ${zone.name} – ${label} – ${formatPrice(seat.price, currency)}`}
                            className={`flex size-8 select-none items-center justify-center rounded-md text-xs font-medium tabular-nums transition sm:size-9 ${seatBgClass}`}
                          >
                            {seat.number}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Row Label */}
                    <span className="w-5 flex-shrink-0 text-center text-xs font-medium text-kumo-subtle">
                      {rowLetter}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend / Quy ước màu sắc (SRS Acceptance Criteria US-02) */}
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-kumo-hairline pt-4 text-sm text-kumo-default sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 size-3.5 flex-shrink-0 rounded bg-kumo-badge-green" />
          <span>Ghế trống (Xanh lá)</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 size-3.5 flex-shrink-0 rounded bg-kumo-brand ring-2 ring-kumo-focus ring-offset-1 ring-offset-kumo-base" />
          <span>Ghế bạn đang chọn</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 size-3.5 flex-shrink-0 rounded bg-kumo-badge-orange seat-held" />
          <span>Đang được giữ (Vàng cam)</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 size-3.5 flex-shrink-0 rounded bg-kumo-fill ring ring-kumo-line grid place-items-center text-[9px] leading-none text-kumo-inactive">✕</span>
          <span>Đã bán (Xám)</span>
        </div>
      </div>

      {/* Selection Summary & Action Bar — a sticky bottom bar when shown in a modal */}
      {selectedSeatsList.length > 0 && (
        <div
          className={`mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
            isModal
              ? 'sticky bottom-0 z-20 -mx-4 -mb-4 border-t border-kumo-hairline bg-kumo-raised/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:mb-0 sm:rounded-lg sm:border-t-0 sm:bg-kumo-recessed sm:p-4 sm:ring sm:ring-kumo-line'
              : 'rounded-lg bg-kumo-recessed p-4 ring ring-kumo-line'
          }`}
        >
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-kumo-default tabular-nums">
                Đã chọn ({selectedSeatsList.length}{limitEnabled && `/${maxSeats}`} vé):
              </span>
              {selectedSeatsList.map(s => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-0.5 rounded-full bg-kumo-base py-0.5 pl-2 pr-0.5 text-xs font-medium text-kumo-default ring ring-kumo-line"
                >
                  <span>{s.id}</span>
                  <button
                    type="button"
                    onClick={() => handleSeatClick(s)}
                    aria-label={`Bỏ chọn ghế ${s.id}`}
                    className="grid size-6 place-items-center rounded-full text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-danger sm:size-4"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div
              className={`flex-wrap items-center gap-x-3 gap-y-1 text-xs text-kumo-subtle ${
                isModal ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-kumo-success" />
                Khóa giữ độc quyền 5 phút
              </span>
              <span>Chống bán trùng (Zero Double-Booking)</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <div className="min-w-0 sm:text-right">
              <div className="flex items-center gap-2 text-xs text-kumo-subtle sm:justify-end">
                <span>Tổng tiền vé</span>
                {isModal && timeLeft !== null && (
                  <span
                    className={`inline-flex items-center gap-1 font-medium tabular-nums sm:hidden ${
                      timeLeft < 60 ? 'text-kumo-danger' : 'text-kumo-warning'
                    }`}
                  >
                    <Clock className="size-3" />
                    {formatTimer(timeLeft)}
                  </span>
                )}
              </div>
              <div className="text-xl font-semibold tracking-tight text-kumo-strong tabular-nums">
                {formatPrice(totalPrice, currency)}
              </div>
            </div>

            {onProceedToCheckout && (
              <button
                type="button"
                onClick={() => onProceedToCheckout(selectedSeatsList)}
                className="h-11 flex-shrink-0 rounded-lg bg-kumo-brand px-4 font-medium text-kumo-on-brand transition-colors hover:bg-kumo-brand-hover sm:h-10"
              >
                Xác nhận &amp; Thanh toán
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
