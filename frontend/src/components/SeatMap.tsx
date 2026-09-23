import React, { useState, useEffect, useRef } from 'react';
import { SeatItem, TicketTier } from '../types';
import { getInitialSeatsForEvent, saveSeatsForEvent, formatPrice } from '../services/eventService';
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
  ticketTiers: TicketTier[];
  selectedSeatIds: string[];
  onSeatsChange: (seats: SeatItem[]) => void;
  onProceedToCheckout?: (selectedSeats: SeatItem[]) => void;
  maxSeats?: number;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  eventId,
  currency,
  ticketTiers,
  selectedSeatIds,
  onSeatsChange,
  onProceedToCheckout,
  maxSeats = 4
}) => {
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'error' | 'info' | 'success' } | null>(null);
  const [realtimeSync, setRealtimeSync] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load seats from storage or deterministic generator
  useEffect(() => {
    const loaded = getInitialSeatsForEvent(eventId, ticketTiers);
    setSeats(loaded);
  }, [eventId, ticketTiers]);

  // Show temporary toast message for user feedback
  const showToast = (text: string, type: 'error' | 'info' | 'success' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // 5-minute Hold Timer (US-03: Giữ chỗ an toàn 5 phút)
  useEffect(() => {
    if (selectedSeatIds.length > 0) {
      if (timeLeft === null) {
        setTimeLeft(300); // 5 minutes = 300 seconds
      }
    } else {
      setTimeLeft(null);
    }
  }, [selectedSeatIds.length]);

  useEffect(() => {
    if (timeLeft === null) return;

    if (timeLeft <= 0) {
      // Hold timer expired: release seats back to available
      onSeatsChange([]);
      setTimeLeft(null);
      showToast('Đã hết hạn giữ chỗ 5 phút! Các ghế đã chọn đã được nhả về hệ thống.', 'error');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onSeatsChange]);

  // Real-time synchronization simulation (<= 3 seconds requirement from SRS NFR-10)
  useEffect(() => {
    if (!realtimeSync || seats.length === 0) return;

    const interval = setInterval(() => {
      setSeats(currentSeats => {
        // Pick a random seat that is not currently selected by the active user
        const unselectedSeats = currentSeats.filter(s => !selectedSeatIds.includes(s.id));
        if (unselectedSeats.length === 0) return currentSeats;

        const randomIndex = Math.floor(Math.random() * unselectedSeats.length);
        const targetSeat = unselectedSeats[randomIndex];

        // Randomly toggle between available, held, or sold
        let nextStatus: 'available' | 'sold' | 'held' = targetSeat.status;
        if (targetSeat.status === 'available') {
          nextStatus = Math.random() > 0.4 ? 'held' : 'sold';
        } else if (targetSeat.status === 'held') {
          nextStatus = Math.random() > 0.5 ? 'sold' : 'available';
        }

        if (nextStatus === targetSeat.status) return currentSeats;

        const updated = currentSeats.map(s => (s.id === targetSeat.id ? { ...s, status: nextStatus } : s));
        saveSeatsForEvent(eventId, updated);
        return updated;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [realtimeSync, seats.length, selectedSeatIds, eventId]);

  // Seat click handler adhering to US-02 and US-03 acceptance criteria
  const handleSeatClick = (seat: SeatItem) => {
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

    const isAlreadySelected = selectedSeatIds.includes(seat.id);

    if (isAlreadySelected) {
      // Deselect seat
      const nextSeats = seats.filter(s => selectedSeatIds.includes(s.id) && s.id !== seat.id);
      onSeatsChange(nextSeats);
      showToast(`Đã bỏ chọn ghế ${seat.id}`, 'info');
    } else {
      // 3. Check max tickets limit (FR-08 / US-07: Giới hạn tối đa 4 vé / người)
      if (selectedSeatIds.length >= maxSeats) {
        showToast(`Mỗi tài khoản chỉ được chọn tối đa ${maxSeats} vé (Quy định chống đầu cơ FR-08)!`, 'error');
        return;
      }

      // Add seat to selection
      const currentlySelected = seats.filter(s => selectedSeatIds.includes(s.id));
      const nextSeats = [...currentlySelected, seat];
      onSeatsChange(nextSeats);
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
            Chọn ghế theo thời gian thực • Tối đa {maxSeats} vé/tài khoản (FR-08)
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

          {/* Real-time sync badge */}
          <button
            onClick={() => setRealtimeSync(!realtimeSync)}
            className={`px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
              realtimeSync
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                : 'bg-zinc-900/60 border-zinc-700 text-zinc-400'
            }`}
            title="Mô phỏng đồng bộ trạng thái thời gian thực theo NFR-10 (<= 3s)"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeSync ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'
              }`}
            />
            <span>{realtimeSync ? 'Real-time Live (≤3s)' : 'Tắt Live Sync'}</span>
          </button>
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
                Đã chọn ({selectedSeatsList.length}/{maxSeats} vé):
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
