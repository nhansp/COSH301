import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Box, ChevronUp, Eye, LogOut, Map as MapIcon, RefreshCw } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { useEvents } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { useSeatInventory } from '../hooks/useSeatInventory';
import { accentStyle, useEventAccent } from '../hooks/useEventAccent';
import { ticketLimitOf } from '../services/eventService';
import { buildVenueLayout, povFor, summarizeZones } from '../services/venue';
import { SeatItem } from '../types';
import { NoticeToast } from '../components/tickets/NoticeToast';
import { ZoneDetail, ZoneList } from '../components/tickets/ZonePanel';
import { SelectionTray, orderTotals } from '../components/tickets/SelectionTray';
import { HoldTimer } from '../components/tickets/HoldTimer';
import { formatPrice } from '../services/eventService';
import { SceneBoundary } from '../venue3d/SceneBoundary';
import { FloorPlan2D } from '../components/tickets/FloorPlan2D';

const VenueScene = lazy(() => import('../venue3d/VenueScene'));

const VIEW_KEY = 'sms_venue_view';

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function readViewPreference(): '3d' | '2d' {
  try {
    return localStorage.getItem(VIEW_KEY) === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export const TicketSelectionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getEventById, loadEventDetail, isLoading } = useEvents();
  const { isAuthenticated, isLoading: authLoading, sessionExpired, ticketsBookedFor } = useAuth();
  const { isEnabled } = useFeatures();
  const reducedMotion = usePrefersReducedMotion();

  const event = id ? getEventById(id) : undefined;
  const needsDetail = !event || event.ticketTiers.length === 0;
  const [isFetchingDetail, setIsFetchingDetail] = useState(needsDetail);

  useEffect(() => {
    if (!id || !needsDetail) {
      setIsFetchingDetail(false);
      return;
    }
    setIsFetchingDetail(true);
    loadEventDetail(id).finally(() => setIsFetchingDetail(false));
  }, [id, needsDetail, loadEventDetail]);

  const limit = event ? ticketLimitOf(event) : 0;
  const maxSeats = event ? Math.max(0, limit - ticketsBookedFor(event.id)) : 0;
  const inventory = useSeatInventory({ eventId: event?.id, maxSeats, holdEnabled: isEnabled('seat_hold') });
  const { seats, mine, pending } = inventory;
  const remaining = Math.max(0, maxSeats - mine.length);

  const zones = useMemo(() => summarizeZones(event?.ticketTiers ?? [], seats), [event?.ticketTiers, seats]);
  const zoneById = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones]);
  // Geometry depends on the seat list, not on seat states, so it is not rebuilt on every hold.
  const seatShape = seats.map(s => s.id).join();
  const layout = useMemo(() => buildVenueLayout(zones, seats), [zones.length, seatShape]); // eslint-disable-line react-hooks/exhaustive-deps

  const heldByZone = useMemo(() => {
    const counts = new Map<string, number>();
    for (const seat of mine) counts.set(seat.zoneId, (counts.get(seat.zoneId) ?? 0) + 1);
    return counts;
  }, [mine]);

  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const activeZone = activeZoneId ? zoneById.get(activeZoneId) ?? null : null;
  const activeSeats = useMemo(() => seats.filter(s => s.zoneId === activeZoneId), [seats, activeZoneId]);

  const webgl = useMemo(supportsWebGL, []);
  const [view, setView] = useState<'3d' | '2d'>(() => (webgl ? readViewPreference() : '2d'));
  const [sceneFailed, setSceneFailed] = useState(false);
  const can3D = webgl && !sceneFailed;
  const shown = can3D ? view : '2d';
  // Once loaded, the 3D scene stays mounted behind the 2D map: switching back keeps its camera.
  const [mounted3D, setMounted3D] = useState(shown === '3d');
  useEffect(() => {
    if (shown === '3d') setMounted3D(true);
  }, [shown]);

  // View from seat: a zone, and a seat when the user holds one there.
  const [pov, setPov] = useState<{ zoneId: string; seatId?: string } | null>(null);
  const [povResetKey, setPovResetKey] = useState(0);
  const povView = useMemo(() => (pov ? povFor(layout, pov.zoneId, pov.seatId) : null), [pov, layout]);
  useEffect(() => {
    if (!pov || pov.zoneId === activeZoneId) return;
    if (!activeZoneId) {
      setPov(null);
      return;
    }
    const zone = zoneById.get(activeZoneId);
    const seat =
      zone?.kind === 'seated'
        ? mine.filter(s => s.zoneId === activeZoneId).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))[0]
        : undefined;
    setPov({ zoneId: activeZoneId, seatId: seat?.id });
  }, [activeZoneId, pov, zoneById, mine]);

  // Category under the pointer in the side panel; the map lights it up without moving the camera.
  const [listHoverZoneId, setListHoverZoneId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  useEffect(() => {
    if (mine.length === 0) setSummaryOpen(false);
  }, [mine.length]);
  useEffect(() => {
    if (!summaryOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSummaryOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [summaryOpen]);

  const chooseView = (next: '3d' | '2d') => {
    setView(next);
    setSceneFailed(false);
    // The first-person view only exists in 3D.
    if (next === '2d') setPov(null);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // The choice simply is not remembered.
    }
  };
  const frameRef = useRef<HTMLElement>(null);

  // House lights go down once the venue is on screen.
  const [dimmed, setDimmed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDimmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (searchParams.get('expired')) {
      inventory.notify('Hết 5 phút giữ chỗ. Các ghế đã được trả lại, bạn có thể chọn lại.', 'error');
    }
    // Only on arrival.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goToLogin = useCallback(() => {
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
  }, [navigate, location.pathname]);
  // The server no longer knows this session: forget the user first, or the login page sends them straight back.
  const reLogin = useCallback(() => {
    sessionExpired();
    goToLogin();
  }, [sessionExpired, goToLogin]);
  // While the session is still being restored, let the server decide.
  const signedOut = !isAuthenticated && !authLoading;

  const handleSeat = useCallback(
    async (seat: SeatItem) => {
      if (seat.status === 'sold') {
        inventory.notify(`Ghế ${seat.label} đã bán. Chọn ghế khác.`, 'error');
        return;
      }
      if (seat.status === 'held') {
        inventory.notify(`Ghế ${seat.label} đang có người giữ. Chọn ghế khác.`, 'error');
        return;
      }
      if (seat.status === 'selected') {
        await inventory.release(seat);
        return;
      }
      if (signedOut) {
        goToLogin();
        return;
      }
      const result = await inventory.hold(seat);
      if (result.needsLogin) reLogin();
    },
    [inventory, signedOut, goToLogin, reLogin]
  );

  const handleStandingCount = async (count: number) => {
    if (!activeZone) return;
    if (signedOut) {
      goToLogin();
      return;
    }
    const result = await inventory.setZoneCount(activeZone.id, activeZone.name, Math.max(0, count));
    if (result.needsLogin) reLogin();
  };

  const goToCheckout = () => {
    if (!event) return;
    navigate(`/checkout/${event.id}?seats=${encodeURIComponent(mine.map(s => s.id).join(','))}`);
  };

  const accent = useEventAccent(event?.imageUrl);

  if (isLoading || (isFetchingDetail && needsDetail)) {
    return (
      <PageShell tone="stage">
        <Navbar tone="stage" />
        <div aria-busy="true" className="mx-auto grid w-full max-w-[1400px] flex-1 gap-5 px-4 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-10">
          <div className="space-y-4">
            <div className="skeleton h-12 w-48" />
            <div className="skeleton h-[60svh] rounded-2xl" />
          </div>
          <div className="skeleton hidden h-[60svh] rounded-2xl lg:block" />
        </div>
      </PageShell>
    );
  }

  if (!event) {
    return (
      <PageShell tone="stage">
        <Navbar tone="stage" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
          <EmptyState
            title="Không tìm thấy sự kiện"
            body="Sự kiện có thể đã kết thúc hoặc không còn mở bán."
            action={
              <Link to="/" className="btn btn-primary">
                Xem lịch diễn
              </Link>
            }
          />
        </main>
      </PageShell>
    );
  }

  const seatMapOff = !isEnabled('seat_map_realtime');
  const totals = orderTotals(mine);

  // A held seat gives a seat-level view; otherwise the view comes from the middle of the zone.
  const heldHere = activeZone
    ? mine.filter(s => s.zoneId === activeZone.id).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    : [];
  const povSeat = activeZone?.kind === 'seated' ? heldHere[0] : undefined;
  const povTarget = activeZone
    ? {
        seatId: povSeat?.id,
        note: povSeat
          ? `Từ ghế ${povSeat.label} bạn đang giữ, theo vị trí trên sơ đồ minh hoạ.`
          : activeZone.kind === 'standing'
            ? 'Từ giữa khu đứng, ở tầm mắt người đứng. Góc nhìn ước lượng.'
            : 'Từ giữa khu, chưa theo một ghế cụ thể. Giữ một ghế để xem từ đúng ghế đó trên sơ đồ.'
      }
    : null;
  const povCaption = povView
    ? povView.seatId
      ? `Từ ghế ${mine.find(s => s.id === povView.seatId)?.label ?? ''} · ${activeZone?.name ?? ''}`
      : `Từ giữa khu ${activeZone?.name ?? ''}${povView.standing ? ', tầm mắt người đứng' : ''}`
    : '';

  const startPov = () => {
    if (!activeZone || !povTarget) return;
    setView('3d');
    setPov({ zoneId: activeZone.id, seatId: povTarget.seatId });
    frameRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  };

  // The panel mirrors the venue: the zone list in the overview, one zone once it is chosen.
  const zoneSection = activeZone ? (
    <section aria-label={`Khu ${activeZone.name}`} className="px-4 py-3">
      <button
        type="button"
        onClick={() => setActiveZoneId(null)}
        className="btn btn-quiet btn-sm -ml-3"
      >
        <ArrowLeft className="size-4" />
        Quay lại toàn sân
      </button>
      <div className="mt-1 mb-3 flex items-start gap-3">
        <span aria-hidden="true" className="mt-1 h-7 w-1.5 shrink-0 rounded-full" style={{ background: activeZone.color }} />
        <div className="min-w-0">
          <h2 className="type-display text-title">{activeZone.name}</h2>
          <p className="text-sm text-kumo-subtle">
            {activeZone.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'} · {activeZone.available === 0 ? 'Hết vé' : `còn ${activeZone.available} vé`} ·{' '}
            {formatPrice(activeZone.priceFrom, '₫')}
          </p>
        </div>
      </div>
      {/* Hop to another category without going back to the list; an open seat view follows along. */}
      <label className="mb-4 flex items-center gap-2 text-sm text-kumo-subtle">
        Đổi hạng vé
        <select
          value={activeZone.id}
          onChange={e => setActiveZoneId(e.target.value)}
          className="field h-10 min-w-0 flex-1 rounded-full px-3 text-sm"
        >
          {zones.map(z => (
            <option key={z.id} value={z.id}>
              {z.name} · {formatPrice(z.priceFrom, '₫')}
              {z.available === 0 ? ' · hết vé' : ''}
            </option>
          ))}
        </select>
      </label>
      {povTarget && (
        <div className="mb-4 rounded-2xl bg-kumo-recessed p-3">
          {povView ? (
            <button
              type="button"
              onClick={() => setPov(null)}
              className="btn btn-ink w-full"
            >
              <LogOut className="size-4" />
              Thoát góc nhìn
            </button>
          ) : (
            <button
              type="button"
              onClick={startPov}
              disabled={!webgl}
              className="btn btn-ink w-full"
            >
              <Eye className="size-4" />
              {activeZone.kind === 'standing' ? 'Xem từ khu đứng' : 'Xem từ chỗ ngồi'}
            </button>
          )}
          <p className="mt-2 text-sm text-kumo-subtle">
            {!webgl ? 'Trình duyệt này không dựng được 3D nên chưa xem được góc nhìn.' : povTarget.note}
          </p>
        </div>
      )}
      <ZoneDetail
        zone={activeZone}
        seats={activeSeats}
        pending={pending}
        heldInZone={heldByZone.get(activeZone.id) ?? 0}
        remaining={remaining}
        onSeatClick={handleSeat}
        onStandingCount={handleStandingCount}
      />
    </section>
  ) : (
    <ZoneList zones={zones} activeZoneId={activeZoneId} heldByZone={heldByZone} onSelect={setActiveZoneId} onHover={setListHoverZoneId} />
  );

  return (
    <PageShell tone="stage" style={accentStyle(accent)} data-dim={dimmed || undefined} className="house-lights pb-28 lg:pb-0">
      <Navbar tone="stage" />
      <NoticeToast notice={inventory.notice} onDismiss={inventory.dismissNotice} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-3 pb-10 sm:px-6 lg:px-10 lg:pb-4">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <Link
              to={`/event/${event.id}`}
              className="btn btn-quiet btn-sm -ml-3 max-w-full"
            >
              <ArrowLeft className="size-4 shrink-0" />
              <span className="truncate">{event.title}</span>
            </Link>
            <h1 className="type-display mt-1 text-display-sm">Chọn vé</h1>
            <p className="mt-1.5 text-kumo-subtle">
              {event.date}, {event.time} · {event.venue}
            </p>
          </div>

          {webgl && !seatMapOff && (
            <div role="radiogroup" aria-label="Kiểu sơ đồ" className="flex items-center gap-1 rounded-full bg-kumo-recessed p-1">
              {([
                ['2d', 'Sơ đồ 2D', MapIcon],
                ['3d', 'Sân khấu 3D', Box]
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={view === value}
                  onClick={() => chooseView(value)}
                  className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors md:h-9 ${
                    view === value ? 'bg-kumo-contrast text-kumo-inverse' : 'text-kumo-subtle hover:text-kumo-strong'
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </header>

        {seatMapOff ? (
          <div className="max-w-xl rounded-2xl bg-kumo-base p-6 ring ring-kumo-line">
            <p className="text-kumo-default">Sơ đồ chọn vé đang tạm đóng. Bạn vẫn có thể mua vé theo hạng.</p>
            <Link
              to={`/checkout/${event.id}`}
              className="btn btn-primary mt-4"
            >
              Mua vé theo hạng
            </Link>
          </div>
        ) : inventory.loadState === 'error' ? (
          <div role="alert" className="max-w-xl rounded-2xl bg-kumo-base p-6 ring ring-kumo-line">
            <p className="text-kumo-default">Chưa tải được sơ đồ vé. Kiểm tra kết nối rồi tải lại.</p>
            <button
              type="button"
              onClick={() => inventory.reload()}
              className="btn btn-ink mt-4"
            >
              <RefreshCw className="size-4" />
              Tải lại
            </button>
          </div>
        ) : (
          <>
          {sceneFailed && view === '3d' && (
            <p role="status" className="mb-5 rounded-xl bg-kumo-base p-4 text-kumo-default ring ring-kumo-line">
              Sân khấu 3D vừa dừng hoạt động, đang hiện sơ đồ 2D.{' '}
              <button type="button" onClick={() => setSceneFailed(false)} className="font-medium text-kumo-link underline underline-offset-4">
                Thử lại 3D
              </button>
            </p>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <section
              ref={frameRef}
              aria-label={shown === '3d' ? 'Sơ đồ sân khấu 3D' : 'Sơ đồ 2D nhìn từ trên xuống'}
              className="relative h-[62svh] min-h-96 scroll-mt-20 overflow-hidden rounded-2xl bg-stage lg:sticky lg:top-20 lg:h-[max(520px,calc(100dvh-14rem))]"
            >
              {can3D && mounted3D && (
                <div className={`absolute inset-0 ${shown === '3d' ? '' : 'invisible'}`} aria-hidden={shown !== '3d'}>
                  <SceneBoundary onError={() => setSceneFailed(true)}>
                    <Suspense fallback={<StageSkeleton />}>
                      <VenueScene
                        layout={layout}
                        zones={zones}
                        seats={seats}
                        activeZoneId={activeZoneId}
                        reducedMotion={reducedMotion}
                        onZoneSelect={setActiveZoneId}
                        onSeatClick={handleSeat}
                        onContextLost={() => setSceneFailed(true)}
                        pov={shown === '3d' ? povView : null}
                        povCaption={povCaption}
                        povResetKey={povResetKey}
                        onResetPov={() => setPovResetKey(k => k + 1)}
                        onExitPov={() => setPov(null)}
                        paused={shown !== '3d'}
                        highlightZoneId={listHoverZoneId}
                      />
                    </Suspense>
                  </SceneBoundary>
                </div>
              )}
              {shown === '2d' && (
                <div className="absolute inset-0">
                  {inventory.loadState === 'loading' ? (
                    <StageSkeleton />
                  ) : (
                    <FloorPlan2D
                      layout={layout}
                      zones={zones}
                      seats={seats}
                      activeZoneId={activeZoneId}
                      reducedMotion={reducedMotion}
                      onZoneSelect={setActiveZoneId}
                      onSeatClick={handleSeat}
                      highlightZoneId={listHoverZoneId}
                    />
                  )}
                </div>
              )}
            </section>

            {/* The aside matches the venue frame. The category panel keeps at least 13rem; the order
                summary takes what it needs up to a cap, and past that only its ticket list scrolls. */}
            <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:h-[max(520px,calc(100dvh-14rem))] lg:self-start">
              <div className="min-h-0 overflow-y-auto overscroll-contain rounded-2xl bg-kumo-base ring ring-kumo-line lg:min-h-52 lg:flex-1">
                {inventory.loadState === 'loading' ? (
                  <p className="p-4 text-kumo-subtle">Đang tải sơ đồ vé…</p>
                ) : (
                  zoneSection
                )}
              </div>

              <div className="hidden min-h-0 flex-col rounded-2xl bg-kumo-base p-4 ring ring-kumo-line lg:flex">
                <SelectionTray
                  collapsible
                  className="min-h-0"
                  listClassName="max-h-[min(18rem,32dvh)]"
                  mine={mine}
                  zones={zoneById}
                  limit={limit}
                  remaining={remaining}
                  secondsLeft={inventory.secondsLeft}
                  pending={pending}
                  onRelease={seat => inventory.release(seat)}
                  onCheckout={goToCheckout}
                />
              </div>
            </aside>
          </div>
          </>
        )}
      </main>

      {/* Phones keep the order in reach: a sticky bar that opens into the full summary. */}
      {mine.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-kumo-hairline bg-kumo-canvas/95 backdrop-blur lg:hidden">
          {summaryOpen && (
            <div id="order-sheet" className="mx-auto flex max-h-[min(60dvh,34rem)] max-w-2xl flex-col border-b border-kumo-hairline px-4 pt-4 pb-3">
              <SelectionTray
                className="min-h-0"
                mine={mine}
                zones={zoneById}
                limit={limit}
                remaining={remaining}
                secondsLeft={inventory.secondsLeft}
                pending={pending}
                onRelease={seat => inventory.release(seat)}
                onCheckout={goToCheckout}
              />
            </div>
          )}
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setSummaryOpen(open => !open)}
              aria-expanded={summaryOpen}
              aria-controls="order-sheet"
              className="-ml-2 flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-kumo-tint"
            >
              <ChevronUp className={`size-5 shrink-0 text-kumo-subtle transition-transform ${summaryOpen ? '' : 'rotate-180'}`} />
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className="type-figure text-xl text-kumo-strong">{formatPrice(totals.total, '₫')}</span>
                  <span className="text-xs text-kumo-subtle">đã gồm phí</span>
                </span>
                <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-kumo-subtle">
                  <span className="tabular-nums">
                    {mine.length}/{limit} vé
                  </span>
                  {inventory.secondsLeft !== null && <HoldTimer secondsLeft={inventory.secondsLeft} label="Giữ chỗ" className="text-sm" />}
                </span>
              </span>
            </button>
            {!summaryOpen && (
              <button type="button" onClick={goToCheckout} className="btn btn-primary h-12 shrink-0 px-5">
                Thanh toán
              </button>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
};

const StageSkeleton: React.FC = () => (
  <div className="grid size-full place-items-center">
    <div className="flex flex-col items-center gap-3 text-stage-muted">
      <div className="h-2 w-40 rounded-full bg-stage-raised" />
      <div className="h-2 w-56 rounded-full bg-stage-raised" />
      <div className="h-2 w-72 rounded-full bg-stage-raised" />
      <span className="mt-2 text-sm">Đang dựng sân khấu…</span>
    </div>
  </div>
);
