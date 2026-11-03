import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  Play,
  Pause,
  Video,
  VideoOff,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { useEvents } from '../context/EventContext';
import { formatPrice } from '../services/eventService';

interface FeaturedItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  artist: string;
  venue: string;
  city: string;
  date: string;
  priceStart: number;
  currency: string;
  videoUrl: string;
  posterUrl: string;
  badge: string;
}

const FEATURED_CONCERTS: FeaturedItem[] = [
  {
    id: '9b57ef1c-2f86-4c39-9ead-0b05b9c5817c',
    slug: 'my-tam-see-the-light-2025',
    title: 'Mỹ Tâm Live Concert "See The Light"',
    subtitle: 'Đêm diễn hơn 30 ca khúc đón 40.000 khán giả tại SVĐ Quốc gia Mỹ Đình',
    artist: 'Mỹ Tâm & Khách Mời',
    venue: 'Sân vận động Quốc gia Mỹ Đình',
    city: 'Hà Nội',
    date: '13 Th12, 2025',
    priceStart: 1500000,
    currency: '₫',
    videoUrl: '/videos/concert-mytam.mp4',
    posterUrl: '/events/my-tam-see-the-light-2025.jpg',
    badge: 'Sự kiện tâm điểm',
  },
  {
    id: '4831c41c-e56f-4b16-9228-fb463e504e6d',
    slug: 'blackpink-born-pink-ha-noi-2023',
    title: 'BLACKPINK WORLD TOUR [BORN PINK]',
    subtitle: 'Chuyến lưu diễn thế giới bùng nổ thu hút hơn 67.000 khán giả thủ đô',
    artist: 'BLACKPINK',
    venue: 'Sân vận động Quốc gia Mỹ Đình',
    city: 'Hà Nội',
    date: '29 Th07, 2023',
    priceStart: 1200000,
    currency: '₫',
    videoUrl: '/videos/concert-blackpink.mp4',
    posterUrl: '/events/blackpink-born-pink-ha-noi-2023.jpg',
    badge: 'Cháy vé toàn cầu',
  },
  {
    id: '21e5d336-b3d7-4827-aaf5-d7114385f957',
    slug: 'anh-trai-say-hi-ha-noi-2024',
    title: 'Concert Anh Trai "Say Hi" - Hà Nội',
    subtitle: 'Đại tiệc âm nhạc All-Star với 12 hạng vé quy tụ các nam thần tượng đỉnh cao',
    artist: 'Dàn Nghệ Sĩ Anh Trai Say Hi',
    venue: 'Sân vận động Quốc gia Mỹ Đình',
    city: 'Hà Nội',
    date: '07 Th12, 2024',
    priceStart: 500000,
    currency: '₫',
    videoUrl: '/videos/concert-sayhi.mp4',
    posterUrl: '/events/anh-trai-say-hi-ha-noi-2024.jpg',
    badge: 'Top 1 Trending',
  },
  {
    id: '09951fe1-d7c5-4a71-a60f-853c5f851fb6',
    slug: 'g-dragon-k-star-spark-2025',
    title: 'VPBank K-Star Spark in Vietnam 2025',
    subtitle: 'G-Dragon (BIGBANG) và CL (2NE1) tái ngộ sân khấu Việt Nam cùng các idol trẻ',
    artist: 'G-Dragon, CL, DPR IAN...',
    venue: 'Sân vận động Quốc gia Mỹ Đình',
    city: 'Hà Nội',
    date: '21 Th06, 2025',
    priceStart: 1000000,
    currency: '₫',
    videoUrl: '/videos/concert-gdragon.mp4',
    posterUrl: '/events/g-dragon-k-star-spark-2025.jpg',
    badge: 'K-pop Siêu Sao',
  },
];

interface HeroSpotlightProps {
  onExploreClick?: () => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({ onExploreClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { events } = useEvents();

  const current = FEATURED_CONCERTS[currentIndex];

  // Match with real event id if loaded from backend
  const matchedEvent = events.find(
    e => e.id === current.id || e.slug === current.slug || e.title.includes(current.artist)
  );
  const eventTargetId = matchedEvent ? matchedEvent.id : current.id;

  // Auto rotate featured concert every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % FEATURED_CONCERTS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Update video playback when slide changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentIndex]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const toggleVideo = () => {
    setIsVideoEnabled(prev => !prev);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl mb-10 border border-emerald-500/25 bg-black text-white shadow-2xl shadow-emerald-950/20">
      {/* Background Video Loop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {isVideoEnabled ? (
          <video
            ref={videoRef}
            src={current.videoUrl}
            poster={current.posterUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="size-full object-cover object-center transition-opacity duration-700 opacity-60 scale-105"
          />
        ) : (
          <img
            src={current.posterUrl}
            alt={current.title}
            className="size-full object-cover object-center opacity-40 transition-all duration-700"
          />
        )}

        {/* Ambient Emerald & Dark Gradients for maximum text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-emerald-600/20 blur-3xl pointer-events-none" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Spotlight Concert Information */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
            {/* Live Status Badge & Video Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold tracking-wide shadow-xs">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
                </span>
                <span>{current.badge}</span>
              </span>

              {/* Video Play/Pause & Toggle buttons */}
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/80">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Tạm dừng video nền' : 'Phát video nền'}
                  className="hover:text-emerald-300 transition-colors p-1"
                  title={isPlaying ? 'Tạm dừng video' : 'Phát video'}
                >
                  {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
                </button>
                <span className="text-white/30">•</span>
                <button
                  onClick={toggleVideo}
                  aria-label="Bật tắt video nền"
                  className="hover:text-emerald-300 transition-colors p-1"
                  title={isVideoEnabled ? 'Tắt video nền' : 'Bật video nền'}
                >
                  {isVideoEnabled ? <Video className="size-3" /> : <VideoOff className="size-3" />}
                </button>
                <span className="hidden sm:inline text-[11px] text-emerald-300/80 pr-1">Live Video</span>
              </div>
            </div>

            {/* Concert Title */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-400 font-semibold tracking-wider uppercase">
                <Sparkles className="size-3.5" />
                <span>{current.artist}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {current.title}
              </h1>

              <p className="text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
                {current.subtitle}
              </p>
            </div>

            {/* Event Quick Meta (Date, Venue, Price) */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-white/90 pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4 text-emerald-400" />
                <span>{current.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="size-4 text-emerald-400" />
                <span>{current.venue}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/60">Giá từ:</span>
                <span className="text-emerald-400 font-bold tabular-nums text-base">
                  {formatPrice(current.priceStart, current.currency)}
                </span>
              </div>
            </div>

            {/* Action CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => navigate(`/checkout/${eventTargetId}`)}
                className="h-11 sm:h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Ticket className="size-4" />
                <span>Đặt vé ngay</span>
              </button>

              <button
                onClick={() => navigate(`/event/${eventTargetId}`)}
                className="h-11 sm:h-12 px-5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm sm:text-base flex items-center gap-2 backdrop-blur-md transition-colors"
              >
                <span>Xem chi tiết show</span>
                <ArrowRight className="size-4" />
              </button>

              {onExploreClick && (
                <button
                  onClick={onExploreClick}
                  className="h-11 sm:h-12 px-4 text-white/70 hover:text-white text-sm font-medium transition-colors"
                >
                  Khám phá tất cả ↓
                </button>
              )}
            </div>
          </div>

          {/* Right Column: List các sự kiện nổi bật (Interactive Selector) */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Flame className="size-4" />
                <span>Sự kiện nổi bật đang mở bán</span>
              </h2>
              <span className="text-xs text-white/60 tabular-nums">
                {currentIndex + 1} / {FEATURED_CONCERTS.length}
              </span>
            </div>

            {/* List items */}
            <div className="space-y-2.5">
              {FEATURED_CONCERTS.map((item, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`group cursor-pointer rounded-2xl p-3 sm:p-3.5 transition-all duration-200 border flex items-center gap-3.5 ${
                      isActive
                        ? 'bg-white/15 backdrop-blur-xl border-emerald-400/80 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-400/50'
                        : 'bg-black/40 hover:bg-white/10 backdrop-blur-md border-white/10 hover:border-white/25'
                    }`}
                  >
                    {/* Thumbnail with active pulse */}
                    <div className="relative size-14 sm:size-16 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 ring-1 ring-white/15">
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {isActive && (
                        <div className="absolute top-1 left-1 size-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-black" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold text-emerald-300 truncate">
                          {item.artist}
                        </span>
                        <span className="text-[11px] text-white/60 tabular-nums flex-shrink-0">
                          {item.date}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {item.title}
                      </h3>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-xs text-white/70 truncate flex items-center gap-1">
                          <MapPin className="size-3 text-emerald-400 flex-shrink-0" />
                          <span className="truncate">{item.city}</span>
                        </span>

                        <span className="text-xs font-bold text-emerald-300 tabular-nums">
                          {formatPrice(item.priceStart, item.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
