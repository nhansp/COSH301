import React from 'react';
import { Mic2, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEvents } from '../context/EventContext';

interface ArtistData {
  id: string;
  name: string;
  role: string;
  genre: string;
  followers: string;
  image: string;
  activeConcert: string;
  searchKey: string;
}

const FEATURED_ARTISTS: ArtistData[] = [
  {
    id: 'my-tam',
    name: 'Mỹ Tâm',
    role: 'Họa mi tóc nâu',
    genre: 'V-pop & Pop Ballad',
    followers: '4.8M+ fan',
    image: '/events/my-tam-see-the-light-2025.jpg',
    activeConcert: 'See The Light Concert (SVĐ Mỹ Đình)',
    searchKey: 'Mỹ Tâm',
  },
  {
    id: 'blackpink',
    name: 'BLACKPINK',
    role: 'Nhóm nhạc nữ toàn cầu',
    genre: 'K-pop Dance',
    followers: '58M+ fan',
    image: '/events/blackpink-born-pink-ha-noi-2023.jpg',
    activeConcert: 'Born Pink World Tour Hanoi',
    searchKey: 'BLACKPINK',
  },
  {
    id: 'anh-trai-say-hi',
    name: 'Anh Trai "Say Hi"',
    role: 'Dàn nghệ sĩ All-Stars',
    genre: 'V-pop / R&B / Hip-hop',
    followers: '15M+ fan',
    image: '/events/anh-trai-say-hi-ha-noi-2024.jpg',
    activeConcert: 'Concert Hà Nội & TP.HCM (Đêm 9)',
    searchKey: 'Say Hi',
  },
  {
    id: 'g-dragon-cl',
    name: 'G-Dragon & CL',
    role: 'Huyền thoại K-pop BIGBANG & 2NE1',
    genre: 'K-pop & Hiphop',
    followers: '28M+ fan',
    image: '/events/g-dragon-k-star-spark-2025.jpg',
    activeConcert: 'VPBank K-Star Spark Vietnam',
    searchKey: 'G-Dragon',
  },
  {
    id: 'chong-gai',
    name: 'Vượt Ngàn Chông Gai',
    role: '33 Anh Tài Hội Tụ',
    genre: 'V-pop & Rock Stage',
    followers: '9.2M+ fan',
    image: '/events/anh-trai-vuot-ngan-chong-gai-ocean-park-2024.jpg',
    activeConcert: 'Đêm 2 - Vinhomes Ocean Park 3',
    searchKey: 'Chông Gai',
  },
];

export const TrendingArtists: React.FC = () => {
  const { setSearchQuery } = useEvents();

  const handleArtistClick = (searchKey: string) => {
    setSearchQuery(searchKey);
    // Smooth scroll to event list
    const el = document.getElementById('events-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="my-14 pt-6 border-t border-emerald-500/15">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-2">
            <Mic2 className="size-3.5" />
            <span>Headliners &amp; Stars</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kumo-strong">
            Nghệ sĩ &amp; Thần tượng đang được săn đón
          </h2>
          <p className="mt-1 text-base text-kumo-subtle">
            Các thần tượng âm nhạc làm nổ tung các sân khấu lớn nhất Việt Nam
          </p>
        </div>

        <button
          onClick={() => {
            setSearchQuery('');
            const el = document.getElementById('events-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          <span>Xem tất cả nghệ sĩ</span>
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* Artists Horizontal Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {FEATURED_ARTISTS.map(artist => (
          <div
            key={artist.id}
            onClick={() => handleArtistClick(artist.searchKey)}
            className="group relative cursor-pointer rounded-2xl p-4 bg-kumo-base ring-1 ring-emerald-500/20 hover:ring-emerald-500/60 hover:shadow-lg hover:shadow-emerald-950/10 transition-all flex flex-col items-center text-center hover:-translate-y-1"
          >
            {/* Avatar image container with emerald ring */}
            <div className="relative size-24 sm:size-28 rounded-full overflow-hidden mb-3.5 ring-2 ring-emerald-500/30 group-hover:ring-emerald-500 transition-all">
              <img
                src={artist.image}
                alt={artist.name}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-110"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80';
                }}
              />
              <span className="absolute bottom-0 right-0 p-1 rounded-full bg-emerald-600 text-white shadow-xs">
                <CheckCircle2 className="size-3.5" />
              </span>
            </div>

            <h3 className="font-bold text-kumo-strong text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors line-clamp-1">
              {artist.name}
            </h3>

            <p className="text-xs text-kumo-subtle line-clamp-1 mt-0.5">{artist.role}</p>

            <span className="mt-2 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium">
              {artist.genre}
            </span>

            <div className="mt-3 pt-3 border-t border-kumo-hairline w-full text-xs text-kumo-subtle flex items-center justify-between">
              <span className="tabular-nums">{artist.followers}</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Xem vé
                <ArrowRight className="size-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
