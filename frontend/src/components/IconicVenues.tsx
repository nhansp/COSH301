import React from 'react';
import { MapPin, Users, Ticket, ArrowRight, Building2 } from 'lucide-react';
import { useEvents } from '../context/EventContext';

interface VenueItem {
  id: string;
  name: string;
  city: string;
  capacity: string;
  description: string;
  imageUrl: string;
  featuredEvents: string;
  searchCity: string;
}

const VENUES: VenueItem[] = [
  {
    id: 'my-dinh',
    name: 'Sân vận động Quốc gia Mỹ Đình',
    city: 'Hà Nội',
    capacity: '40.000+ Khán giả',
    description: 'Thánh đường của những siêu concert quốc tế và trong nước: BLACKPINK, Mỹ Tâm, Anh Trai Say Hi.',
    imageUrl: '/events/blackpink-born-pink-ha-noi-2023.jpg',
    featuredEvents: '3 concert sắp diễn ra',
    searchCity: 'Hà Nội',
  },
  {
    id: 'ocean-park',
    name: 'Vinhomes Ocean Park 3 (Ocean City)',
    city: 'Hưng Yên',
    capacity: '30.000+ Khán giả',
    description: 'Quảng trường âm nhạc ngoài trời quy mô lớn, địa điểm thăng hoa của Anh Trai Vượt Ngàn Chông Gai.',
    imageUrl: '/events/anh-trai-vuot-ngan-chong-gai-ocean-park-2024.jpg',
    featuredEvents: '1 concert sắp diễn ra',
    searchCity: 'Hưng Yên',
  },
  {
    id: 'van-phuc',
    name: 'Khu đô thị Vạn Phúc City',
    city: 'TP. Hồ Chí Minh',
    capacity: '25.000+ Khán giả',
    description: 'Không gian ven sông thoáng đãng, tổ chức chuỗi concert Anh Trai Say Hi cuồng nhiệt bậc nhất miền Nam.',
    imageUrl: '/events/anh-trai-say-hi-dem-9-tphcm-2026.jpg',
    featuredEvents: '1 concert sắp diễn ra',
    searchCity: 'TP. Hồ Chí Minh',
  },
];

export const IconicVenues: React.FC = () => {
  const { setCity } = useEvents();

  const handleVenueClick = (city: string) => {
    setCity(city);
    const el = document.getElementById('events-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="my-14 pt-6 border-t border-emerald-500/15">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-2">
            <Building2 className="size-3.5" />
            <span>Sân khấu &amp; Quảng trường</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kumo-strong">
            Điểm hẹn âm nhạc đình đám
          </h2>
          <p className="mt-1 text-base text-kumo-subtle">
            Các sân vận động và đại nhạc hội nơi cảm xúc khán giả được thăng hoa trọn vẹn
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {VENUES.map(venue => (
          <div
            key={venue.id}
            onClick={() => handleVenueClick(venue.searchCity)}
            className="group relative cursor-pointer rounded-2xl overflow-hidden bg-kumo-base ring-1 ring-emerald-500/20 hover:ring-emerald-500 hover:shadow-xl hover:shadow-emerald-950/10 transition-all hover:-translate-y-1 flex flex-col"
          >
            {/* Image Header */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-emerald-950/20">
              <img
                src={venue.imageUrl}
                alt={venue.name}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              <div className="absolute top-3 left-3">
                <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 text-xs font-medium flex items-center gap-1">
                  <MapPin className="size-3" />
                  {venue.city}
                </span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="text-xs text-emerald-300 flex items-center gap-1 mb-0.5">
                  <Users className="size-3" />
                  {venue.capacity}
                </span>
                <h3 className="text-base sm:text-lg font-bold leading-tight">
                  {venue.name}
                </h3>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
              <p className="text-sm text-kumo-subtle line-clamp-2 leading-relaxed">
                {venue.description}
              </p>

              <div className="pt-3 border-t border-kumo-hairline flex items-center justify-between text-xs">
                <span className="font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Ticket className="size-3.5" />
                  {venue.featuredEvents}
                </span>

                <span className="text-kumo-subtle group-hover:text-emerald-700 dark:group-hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors">
                  Xem show tại đây
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
