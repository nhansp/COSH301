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
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface SeatMapProps {
  eventId: string;
  currency: string;
  selectedSeatIds: string[];
  onSeatsChange: (seats: SeatItem[]) => void;
  onProceedToCheckout?: (selectedSeats: SeatItem[]) => void;
  maxSeats?: number;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  eventId,
  currency,
  selectedSeatIds,
  onSeatsChange,
  onProceedToCheckout,
  maxSeats = 4
}) => {
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

  return (
    <div className="w-full bg-[#12091c] border border-purple-900/60 rounded-3xl p-4 sm:p-7 shadow-2xl relative overflow-hidden">
      {/* Toast Notification Bar */}
      {toastMessage && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-2xl flex items-center gap-2 border transition-all animate-bounce ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-200'
              : toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
              : 'bg-purple-950/95 border-purple-500 text-purple-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <Radio className="w-4 h-4 text-purple-400 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar: Status & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-purple-900/50">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Armchair className="w-5 h-5 text-purple-400" />
            <span>Sơ đồ ghế trực quan (Interactive Seat Map)</span>
          </h3>
          <p className="text-xs text-purple-300/80 mt-0.5">
            Chọn ghế theo thời gian thực{limitEnabled && ` • Tối đa ${maxSeats} vé/tài khoản`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 5-minute hold timer display (US-03) */}
          {timeLeft !== null && (
            <div
              className={`px-3 py-1.5 rounded-full border flex items-center gap-1.5 text-xs font-semibold ${
                timeLeft < 60
                  ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-amber-950/80 border-amber-500 text-amber-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Giữ chỗ: {formatTimer(timeLeft)}</span>
            </div>
          )}

          {/* Live connection indicator (reflects the real SSE state) */}
          <div
            className={`px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${
              liveState === 'connected'
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                : liveState === 'connecting'
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                : 'bg-zinc-900/60 border-zinc-700 text-zinc-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                liveState === 'connected' ? 'bg-emerald-400 animate-pulse' : liveState === 'connecting' ? 'bg-amber-400' : 'bg-zinc-500'
              }`}
            />
            <span>
              {liveState === 'connected' ? 'Đang cập nhật trực tiếp' : liveState === 'connecting' ? 'Đang kết nối...' : 'Mất kết nối trực tiếp'}
            </span>
          </div>
        </div>
      </div>

      {/* Sân khấu (Stage) visual projection */}
      <div className="py-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl h-9 rounded-t-full bg-gradient-to-b from-purple-500/40 via-purple-700/20 to-transparent border-t-2 border-purple-400 shadow-[0_-10px_30px_rgba(168,85,247,0.3)] flex items-center justify-center">
          <span className="text-[11px] sm:text-xs font-black tracking-widest text-purple-200 uppercase">
            SÂN KHẤU CHÍNH (MAIN STAGE)
          </span>
        </div>
        <div className="w-full max-w-md h-0.5 bg-gradient-to-r from-transparent via-purple-500/60 to-transparent mt-1" />
      </div>

      {loadState !== 'ready' && (
        <div className="py-12 flex flex-col items-center gap-3 text-sm text-purple-200">
          {loadState === 'loading' ? (
            <span>Đang tải sơ đồ ghế...</span>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Không tải được sơ đồ ghế hoặc sự kiện chưa có ghế.
              </span>
              <button
                type="button"
                onClick={() => { setLoadState('loading'); loadSeats(); }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
              >
                Thử lại
              </button>
            </>
          )}
        </div>
      )}

      {/* Visual Seat Grid */}
      <div className="space-y-6 overflow-x-auto py-2">
        {zones.map(zone => (
          <div key={zone.id} className="space-y-2 min-w-[540px]">
            <div className="flex items-center justify-between text-xs text-purple-300 font-semibold px-2">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                {zone.name}
              </span>
              <span className="text-[11px] text-purple-400">
                {formatPrice(zone.seats[0]?.price || 0, currency)} / ghế
              </span>
            </div>

            <div className="bg-[#170a24]/80 border border-purple-900/30 rounded-2xl p-3 sm:p-4 space-y-2.5">
              {zone.rows.map(rowLetter => {
                const rowSeats = zone.seats.filter(s => s.row === rowLetter);
                return (
                  <div key={rowLetter} className="flex items-center justify-center gap-2">
                    {/* Left Row Label */}
                    <span className="w-5 text-center text-xs font-bold text-purple-400 flex-shrink-0">
                      {rowLetter}
                    </span>

                    {/* Seat Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {rowSeats.map(seat => {
                        const isSelected = selectedSeatIds.includes(seat.id);

                        // Strict color scheme according to SRS US-02:
                        // - Ghế trống: xanh lá (emerald/green)
                        // - Ghế đã bán: xám (gray/zinc)
                        // - Ghế đang được giữ: vàng cam (amber)
                        // - Ghế bạn chọn: tím / viền nổi bật (purple)
                        let seatBgClass = 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer';
                        let label = 'Trống';

                        if (isSelected) {
                          seatBgClass =
                            'bg-purple-600 text-white ring-2 ring-purple-300 shadow-lg shadow-purple-600/50 scale-105 cursor-pointer';
                          label = 'Bạn chọn';
                        } else if (seat.status === 'sold') {
                          seatBgClass = 'bg-zinc-700 border border-zinc-600 text-zinc-400 cursor-not-allowed';
                          label = 'Đã bán';
                        } else if (seat.status === 'held') {
                          seatBgClass =
                            'bg-amber-500/90 border border-amber-400 text-amber-950 cursor-not-allowed';
                          label = 'Đang giữ 5p';
                        }

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleSeatClick(seat)}
                            title={`Ghế ${seat.id} • ${zone.name} • ${label} • ${formatPrice(
                              seat.price,
                              currency
                            )}`}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center transition-all select-none ${seatBgClass}`}
                          >
                            {seat.number}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Row Label */}
                    <span className="w-5 text-center text-xs font-bold text-purple-400 flex-shrink-0">
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
      <div className="mt-6 pt-4 border-t border-purple-900/50 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-purple-200">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-md bg-emerald-500 shadow-sm" />
          <span>Ghế trống (Xanh lá)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-md bg-purple-600 ring-2 ring-purple-300" />
          <span>Ghế bạn đang chọn</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-md bg-amber-500" />
          <span>Đang được giữ (Vàng cam)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-md bg-zinc-700 border border-zinc-600" />
          <span>Đã bán (Xám)</span>
        </div>
      </div>

      {/* Selection Summary & Action Bar */}
      {selectedSeatsList.length > 0 && (
        <div className="mt-6 p-4 rounded-2xl bg-[#1b0d2d] border border-purple-700/80 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1 text-center md:text-left w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
              <span className="text-xs text-purple-300 font-semibold">
                Đã chọn ({selectedSeatsList.length}{limitEnabled && `/${maxSeats}`} vé):
              </span>
              {selectedSeatsList.map(s => (
                <span
                  key={s.id}
                  className="px-2.5 py-0.5 rounded-full bg-purple-900/80 border border-purple-500 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <span>{s.id}</span>
                  <button
                    type="button"
                    onClick={() => handleSeatClick(s)}
                    className="hover:text-rose-300 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="text-xs text-purple-400 flex items-center gap-1.5 justify-center md:justify-start">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Khóa giữ độc quyền 5 phút • Chống bán trùng (Zero Double-Booking)</span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="text-right">
              <div className="text-[11px] text-purple-400 font-medium">Tổng tiền vé</div>
              <div className="text-lg sm:text-xl font-black text-white">
                {formatPrice(totalPrice, currency)}
              </div>
            </div>

            {onProceedToCheckout && (
              <button
                type="button"
                onClick={() => onProceedToCheckout(selectedSeatsList)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-900/50 flex items-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <span>Xác nhận &amp; Thanh toán</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
