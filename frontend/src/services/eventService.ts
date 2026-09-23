import { EventItem, SeatItem, SeatZoneConfig, TicketTier } from '../types';

export const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';
export const DEFAULT_BANNER_IMAGE = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80';

export const MOCK_EVENTS: EventItem[] = [
  {
    id: 'bismil-ki-mehfil-2025',
    title: 'Bismil ki Mehfil - Main Hoon Sufi',
    subTitle: 'An enchanting evening of soulful Sufi music and live percussion',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    date: 'Sun Nov 09',
    time: '08:00 PM',
    rawDate: '2025-11-09',
    venue: 'Tipsy Tiger, Mumbai',
    city: 'Mumbai',
    address: 'Plot 14, Royal Palms Estate, Aarey Colony, Goregaon East, Mumbai',
    priceStart: 1199,
    currency: '₹',
    genre: 'Sufi & Bollywood',
    isTrending: true,
    isPopular: true,
    description: 'Get ready for an electrifying night with Bismil Ki Mehfil, India’s foremost Sufi & Fusion ensemble! Experience heart-touching shayaris, qawwalis, and modern symphonic orchestrations in an intimate amphitheater ambience.',
    ageRestriction: '18+',
    organizer: {
      name: 'Encore Live Events',
      verified: true,
      contact: 'events@encorelive.in'
    },
    artists: [
      { name: 'Bismil', role: 'Lead Vocalist & Sufi Maestro', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' },
      { name: 'The Sufi Strings Band', role: 'Live Symphony & Dholak', avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-early-bismil',
        name: 'Phase 1 - Early Bird GA',
        description: 'General admission standing zone with direct stage view',
        price: 1199,
        available: 35,
        perks: ['1 Welcome Beverage', 'General Entry Zone', 'Live Sound Experience']
      },
      {
        id: 'tier-fan-bismil',
        name: 'VIP Fan Pit',
        description: 'Exclusive front row proximity to Bismil & expedited entry',
        price: 2499,
        available: 18,
        perks: ['Fast-track VIP Gate', 'Front-row Viewing Pit', '2 Signature Cocktails', 'Signed Poster']
      },
      {
        id: 'tier-table-bismil',
        name: 'Royal Lounge Table (4 Pax)',
        description: 'Dedicated elevated couch seating with bottle service',
        price: 9999,
        available: 4,
        perks: ['Dedicated Butler Service', 'Premium Spirits Bottle', 'Gourmet Tapas Platter', 'Valet Parking']
      }
    ]
  },
  {
    id: 'guy-j-ankytrixx-mumbai',
    title: 'Guy J & Ankytrixx - Mumbai',
    subTitle: 'Progressive House & Melodic Techno Odyssey',
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    date: 'Fri Nov 14',
    time: '09:00 PM',
    rawDate: '2025-11-14',
    venue: 'Tipsy Tiger, Mumbai',
    city: 'Mumbai',
    address: 'Tipsy Tiger Terrace, Link Road, Andheri West, Mumbai',
    priceStart: 999,
    currency: '₹',
    genre: 'Electronic & Techno',
    isTrending: true,
    isPopular: true,
    description: 'The legendary Lost & Found founder Guy J returns to Mumbai alongside India’s sonic pioneer Ankytrixx for an immersive 6-hour extended deep musical journey.',
    ageRestriction: '21+',
    organizer: {
      name: 'Submerge & Paradox',
      verified: true,
      contact: 'booking@submerge.in'
    },
    artists: [
      { name: 'Guy J', role: 'Lost & Found Boss / DJ', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' },
      { name: 'Ankytrixx', role: 'Pioneer DJ / Producer', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-ga-guyj',
        name: 'Phase 1 - GA Entry',
        description: 'Standard access to dancefloor and main bar area',
        price: 999,
        available: 60,
        perks: ['Entry before 11 PM', 'Access to Main Arena']
      },
      {
        id: 'tier-backstage-guyj',
        name: 'Backstage Artist Deck',
        description: 'Elevated platform directly behind the DJ booth with private bar',
        price: 2999,
        available: 12,
        perks: ['Behind DJ Booth Access', 'VIP Express Entry', 'Cover charge ₹1000 included']
      }
    ]
  },
  {
    id: 'tipsy-tiger-thai-food-fest',
    title: 'Tipsy Tiger Thai Food & Music Festival',
    subTitle: 'Culinary Delights paired with Chill Hop & Tropical House Beats',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80',
    date: 'Sun Nov 09',
    time: '08:00 PM',
    rawDate: '2025-11-09',
    venue: 'Tipsy Tiger, Mumbai',
    city: 'Mumbai',
    address: 'Tipsy Tiger Courtyard, Bandra Kurla Complex, Mumbai',
    priceStart: 0,
    currency: '₹',
    genre: 'Food & Live Indie',
    isTrending: false,
    isPopular: true,
    description: 'Savor authentic street food from Bangkok while listening to indie singer-songwriters and acoustic loop artists under warm fairy lights.',
    ageRestriction: 'All Ages',
    organizer: {
      name: 'Tipsy Tiger Hospitality',
      verified: true,
      contact: 'hello@tipsytiger.in'
    },
    artists: [
      { name: 'DJ Mango & Citrus', role: 'Tropical House Resident', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-free-thai',
        name: 'RSVP - Free Entry',
        description: 'Complimentary entry pass. Food and drinks purchased à la carte.',
        price: 0,
        available: 120,
        perks: ['Free Entry before 9 PM', 'Complimentary Tasting Voucher']
      },
      {
        id: 'tier-tasting-thai',
        name: 'Chef Tasting Experience',
        description: 'Includes 5-course sampling menu and 2 signature Asian cocktails',
        price: 1499,
        available: 25,
        perks: ['Reserved Table', '5 Tasting Dishes', '2 Cocktails', 'Chef interaction']
      }
    ]
  },
  {
    id: 'one-last-time-vaibhav-shah',
    title: 'One Last Time - Hosted by Vaibhav Shah',
    subTitle: 'A high-energy nostalgia night celebrating the 2010s golden EDM era',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    date: 'Sat Nov 15',
    time: '10:00 PM',
    rawDate: '2025-11-15',
    venue: 'Tipsy Tiger, Mumbai',
    city: 'Mumbai',
    address: 'Tipsy Tiger Club Room, Mumbai',
    priceStart: 0,
    currency: '₹',
    genre: 'EDM & Party',
    isTrending: false,
    isPopular: true,
    description: 'Relive the timeless anthems of Avicii, Swedish House Mafia, Calvin Harris, and David Guetta hosted by renowned MC Vaibhav Shah.',
    ageRestriction: '21+',
    organizer: {
      name: 'Nightlife Syndicate',
      verified: true,
      contact: 'vip@nightlifesyndicate.com'
    },
    artists: [
      { name: 'Vaibhav Shah', role: 'Celebrity Host & MC', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-guestlist-olt',
        name: 'Couple Guestlist (Free)',
        description: 'Free entry for couples before 11 PM',
        price: 0,
        available: 50,
        perks: ['Free Entry for 2', 'Priority Line Access']
      },
      {
        id: 'tier-stag-olt',
        name: 'Single Male / Female Pass',
        description: 'Entry with ₹1000 full cover for food and bar',
        price: 1000,
        available: 30,
        perks: ['Full Cover on Bar/Food', 'Club Access']
      }
    ]
  },
  {
    id: 'retro-bollywood-night-mumbai',
    title: 'Retro Bollywood & Disco Night',
    subTitle: '80s & 90s Chartbusters, Disco Dancers & Neon Lights',
    imageUrl: 'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1600&q=80',
    date: 'Fri Nov 21',
    time: '09:00 PM',
    rawDate: '2025-11-21',
    venue: 'Tipsy Tiger, Mumbai',
    city: 'Mumbai',
    address: 'Tipsy Tiger Ballroom, Mumbai',
    priceStart: 0,
    currency: '₹',
    genre: 'Bollywood',
    isTrending: true,
    isPopular: true,
    description: 'Dust off the bell-bottoms and vintage sparkles! A non-stop retro dance fever featuring iconic Bollywood tracks from Kishore Kumar to AR Rahman.',
    ageRestriction: '18+',
    organizer: {
      name: 'Desi Disco Collective',
      verified: true,
      contact: 'info@desidisco.in'
    },
    artists: [
      { name: 'DJ Suketu & Retro Boyz', role: 'Headliner DJ', avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-retro-free',
        name: 'Early RSVP (Free Onwards)',
        description: 'Free entry for early RSVPs strictly before 10 PM',
        price: 0,
        available: 75,
        perks: ['Free Entry before 10 PM', 'Glow Band on Arrival']
      },
      {
        id: 'tier-retro-vip',
        name: 'VIP Bollywood Pass',
        description: 'Guaranteed entry all night with unlimited snacks & beer',
        price: 1899,
        available: 20,
        perks: ['All-night Entry', 'Unlimited Starters for 2 hrs', '2 Beers included']
      }
    ]
  },
  {
    id: 'glowfest-pre-holi-bash',
    title: 'Glowfest: Pre-Holi Neon Bash - Featuring Viraj',
    subTitle: 'UV Paint, Neon Cannons & Organic Color Blast',
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    date: 'Sat Mar 22',
    time: '10:00 PM',
    rawDate: '2026-03-22',
    venue: 'Tipsy Tiger Open Arena, Mumbai',
    city: 'Mumbai',
    address: 'Arena Lawns, Mumbai',
    priceStart: 0,
    currency: '₹',
    genre: 'Hip Hop & EDM',
    isTrending: true,
    isPopular: true,
    description: 'Experience Mumbai’s most vibrant glow-in-the-dark festival featuring DJ Viraj with thunderous bass, neon smoke cannons, and certified non-toxic organic colors.',
    ageRestriction: '18+',
    organizer: {
      name: 'Holi Vibe India',
      verified: true,
      contact: 'fest@holivibe.in'
    },
    artists: [
      { name: 'DJ Viraj', role: 'Bass & EDM Producer', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-glow-free',
        name: 'Free Early Access',
        description: 'Free entry for first 100 registered guests',
        price: 0,
        available: 30,
        perks: ['Early Arena Entry', 'Neon Glasses']
      },
      {
        id: 'tier-glow-pack',
        name: 'Glow Warrior Kit + Pass',
        description: 'Full pass plus neon merch kit and 5 packets of organic neon colors',
        price: 899,
        available: 45,
        perks: ['Express Gate', 'Glow Paint Kit', '5x Organic Colors', 'Festival Bandana']
      }
    ]
  },
  {
    id: 'coldplay-spheres-tour-2025',
    title: 'Coldplay: Music of the Spheres World Tour',
    subTitle: 'Live Stadium Spectacular with Sustainable Kinetic Lightshow',
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80',
    date: 'Sat Dec 12',
    time: '07:30 PM',
    rawDate: '2025-12-12',
    venue: 'DY Patil Stadium, Navi Mumbai',
    city: 'Mumbai',
    address: 'Sector 7, Nerul, Navi Mumbai, Maharashtra',
    priceStart: 3500,
    currency: '₹',
    genre: 'Rock & Pop',
    isTrending: true,
    isPopular: true,
    description: 'Chris Martin, Jonny Buckland, Guy Berryman, and Will Champion bring the ground-breaking Music of the Spheres world tour. Experience Yellow, Fix You, Viva La Vida, and Higher Power under millions of flashing LED wristbands.',
    ageRestriction: 'All Ages',
    organizer: {
      name: 'BookMyShow Live & Live Nation',
      verified: true,
      contact: 'coldplay@livenation.com'
    },
    artists: [
      { name: 'Coldplay', role: 'Headline Band', avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-standing-coldplay',
        name: 'Floor Pitch Standing',
        description: 'Immersive ground floor standing right in front of the A & B stages',
        price: 4500,
        available: 15,
        perks: ['LED Wristband', 'Ground Floor Access', 'Ecological Commemorative Cup']
      },
      {
        id: 'tier-tier1-coldplay',
        name: 'Grandstand Tier 1 (Reserved Seating)',
        description: 'Elevated panoramic views with cushioned reserved seating',
        price: 8000,
        available: 10,
        perks: ['Reserved Seat', 'Stadium Fast Track', 'Tour Program']
      },
      {
        id: 'tier-infinity-coldplay',
        name: 'Ultimate Spheres VIP Lounge',
        description: 'Luxury hospitality lounge, pre-show dinner, and stage-adjacent viewing platform',
        price: 25000,
        available: 2,
        perks: ['Backstage Tour', 'Exclusive Merch Gift', 'Open Bar & Gourmet Dining', 'Dedicated Host']
      }
    ]
  },
  {
    id: 'son-tung-mtp-live-concert',
    title: 'Sơn Tùng M-TP - Sky Wave Concert 2025',
    subTitle: 'Đêm nhạc đẳng cấp quốc tế bùng nổ cùng cộng đồng Sky',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    date: 'Sat Oct 25',
    time: '07:30 PM',
    rawDate: '2025-10-25',
    venue: 'Sân vận động Quân khu 7, TP. Hồ Chí Minh',
    city: 'Hồ Chí Minh',
    address: '202 Hoàng Văn Thụ, Phường 9, Phú Nhuận, Hồ Chí Minh',
    priceStart: 950000,
    currency: '₫',
    genre: 'Pop & Hip Hop',
    isTrending: true,
    isPopular: true,
    description: 'Cháy hết mình cùng nghệ sĩ Sơn Tùng M-TP trong live concert công phu bậc nhất năm. Sân khấu 360 độ công nghệ visual đỉnh cao, pháo hoa và toàn bộ các bản hit triệu views từ Lạc Trôi, Chúng Ta Của Tương Lai đến Đừng Làm Trái Tim Anh Đau.',
    ageRestriction: '14+',
    organizer: {
      name: 'M-TP Entertainment',
      verified: true,
      contact: 'booking@mtp-entertainment.com'
    },
    artists: [
      { name: 'Sơn Tùng M-TP', role: 'Main Artist', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-sky-ga',
        name: 'Vé GA (Standing)',
        description: 'Khu vực đứng sôi động gần sân khấu phụ',
        price: 950000,
        available: 80,
        perks: ['Lightstick cổ vũ chính thức', 'Vòng tay lưu niệm Sky']
      },
      {
        id: 'tier-sky-fanzone',
        name: 'Khu Fanzone A1 & A2',
        description: 'Vị trí trực diện sân khấu chính, gần thần tượng nhất',
        price: 1850000,
        available: 24,
        perks: ['Lightstick Bluetooth sync', 'Áo thun Limited Edition', 'Lối đi ưu tiên']
      },
      {
        id: 'tier-sky-vip',
        name: 'Vé VVIP Sky Diamond',
        description: 'Khu vực khán đài sofa VIP với tiệc trà nhẹ và quà tặng ký tên',
        price: 3500000,
        available: 6,
        perks: ['Gặp gỡ Meet & Greet mini', 'Ghế sofa bọc da riêng', 'Photobook có chữ ký']
      }
    ]
  },
  {
    id: 'vu-bao-tang-cua-nuoi-tiec',
    title: 'Vũ. Concert Tour - Bảo Tàng Của Nuối Tiếc',
    subTitle: 'Không gian acoustic mộc mạc lắng đọng cùng "Hoàng tử Indie"',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    date: 'Fri Nov 07',
    time: '08:00 PM',
    rawDate: '2025-11-07',
    venue: 'Trung tâm Hội nghị Quốc gia, Hà Nội',
    city: 'Hà Nội',
    address: 'Đại lộ Thăng Long, Mễ Trì, Nam Từ Liêm, Hà Nội',
    priceStart: 650000,
    currency: '₫',
    genre: 'Indie & Acoustic',
    isTrending: false,
    isPopular: true,
    description: 'Tour diễn xuyên Việt quảng bá album mới của Vũ. Mang đến những bản tình ca mộc mạc, sâu lắng như Lạ Lùng, Bước Qua Mùa Cô Đơn, Đông Kiếm Em và Những Lời Hứa Bỏ Quên cùng dàn nhạc giao hưởng thính phòng.',
    ageRestriction: '12+',
    organizer: {
      name: 'Warner Music Vietnam',
      verified: true,
      contact: 'events@warnermusic.vn'
    },
    artists: [
      { name: 'Vũ.', role: 'Singer & Songwriter', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' }
    ],
    ticketTiers: [
      {
        id: 'tier-vu-standard',
        name: 'Hạng Vé Tiêu Chuẩn',
        description: 'Khán đài tầng 2 với tầm nhìn bao quát toàn bộ sân khấu',
        price: 650000,
        available: 40,
        perks: ['Vòng tay phát sáng', 'Sticker concert']
      },
      {
        id: 'tier-vu-premium',
        name: 'Hạng Vé Cao Cấp (Tầng 1)',
        description: 'Khu vực chính diện tầng 1, trải nghiệm âm học tốt nhất',
        price: 1200000,
        available: 15,
        perks: ['Poster có chữ ký tươi', 'Đĩa CD độc quyền', 'Lối vào riêng']
      }
    ]
  }
];

export async function fetchEventsFromAPI(): Promise<EventItem[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY;

  if (apiKey && apiKey !== 'YOUR_TICKETMASTER_API_KEY' && apiKey.trim().length > 5) {
    try {
      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&size=20&apikey=${apiKey}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data._embedded && data._embedded.events && data._embedded.events.length > 0) {
          const apiEvents: EventItem[] = data._embedded.events.map((ev: any, idx: number) => {
            const price = ev.priceRanges?.[0]?.min || 899;
            const currency = ev.priceRanges?.[0]?.currency === 'USD' ? '$' : '₹';
            const venue = ev._embedded?.venues?.[0]?.name || 'City Arena';
            const city = ev._embedded?.venues?.[0]?.city?.name || 'Mumbai';
            const rawDate = ev.dates?.start?.localDate || '2025-11-20';
            const time = ev.dates?.start?.localTime ? ev.dates.start.localTime.slice(0, 5) : '08:00 PM';
            const bestImage = ev.images?.find((img: any) => img.width > 600)?.url || ev.images?.[0]?.url;

            return {
              id: ev.id || `tm-${idx}`,
              title: ev.name,
              subTitle: ev.info || 'Live Music Concert Tour Experience',
              imageUrl: bestImage || MOCK_EVENTS[0].imageUrl,
              bannerUrl: bestImage || MOCK_EVENTS[0].bannerUrl,
              date: new Date(rawDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              time: time,
              rawDate: rawDate,
              venue: `${venue}, ${city}`,
              city: city,
              address: `${venue}, ${city}`,
              priceStart: Math.round(price),
              currency: currency,
              genre: ev.classifications?.[0]?.genre?.name || 'Live Concert',
              isTrending: idx % 2 === 0,
              isPopular: true,
              description: ev.info || `${ev.name} live in concert with state-of-the-art acoustics and unforgettable performances.`,
              ageRestriction: ev.ageRestrictions?.legalAgeEnforced ? '18+' : 'All Ages',
              organizer: {
                name: ev.promoter?.name || 'Global Touring Network',
                verified: true,
                contact: 'support@ticketmaster.com'
              },
              artists: [
                {
                  name: ev.name.split(' - ')[0] || ev.name,
                  role: 'Headliner',
                  avatar: bestImage || MOCK_EVENTS[0].imageUrl
                }
              ],
              ticketTiers: [
                {
                  id: `tier-std-${ev.id}`,
                  name: 'Standard Pass',
                  description: 'General entry to concert venue',
                  price: Math.round(price),
                  available: 45,
                  perks: ['General Entry', 'Concert Guide']
                },
                {
                  id: `tier-vip-${ev.id}`,
                  name: 'VIP Front Stage',
                  description: 'Premium front stage viewing with express lane',
                  price: Math.round(price * 2.2),
                  available: 15,
                  perks: ['VIP Lane', 'Front Stage Zone', 'Complimentary Drink']
                }
              ]
            };
          });

          // Merge with our distinct hero concert items from screenshot for full visual parity
          return [...MOCK_EVENTS, ...apiEvents];
        }
      }
    } catch (err) {
      console.warn('Could not fetch from Ticketmaster API, using curated high-fidelity concert dataset:', err);
    }
  }

  // Curated live events matching the screenshot design
  return MOCK_EVENTS;
}

export function formatPrice(amount: number, currency: string = '₹'): string {
  if (amount === 0) return 'Free Onwards';
  if (currency === '₫') {
    return `${amount.toLocaleString('vi-VN')}₫`;
  }
  if (currency === '$') {
    return `$${amount.toLocaleString('en-US')}`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getInitialSeatsForEvent(eventId: string, tiers: TicketTier[]): SeatItem[] {
  const storageKey = `sms_event_seats_${eventId}`;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // fallback to generation
    }
  }

  const vipTier = tiers[1] || tiers[0] || { id: 'vip', price: 1500000, name: 'VIP' };
  const stdTier = tiers[0] || { id: 'std', price: 800000, name: 'Standard' };
  const ecoTier = tiers[2] || tiers[0] || { id: 'eco', price: 500000, name: 'Economy' };

  const zones: SeatZoneConfig[] = [
    {
      id: 'vip',
      name: 'Khu VIP (Cận sân khấu)',
      colorName: 'purple',
      rows: ['A', 'B', 'C'],
      seatsPerRow: 10,
      tierId: vipTier.id,
      price: vipTier.price
    },
    {
      id: 'standard',
      name: 'Khu Khán đài A (Trung tâm)',
      colorName: 'blue',
      rows: ['D', 'E', 'F'],
      seatsPerRow: 12,
      tierId: stdTier.id,
      price: stdTier.price
    },
    {
      id: 'economy',
      name: 'Khu Khán đài B (Tầng lầu)',
      colorName: 'emerald',
      rows: ['G', 'H'],
      seatsPerRow: 14,
      tierId: ecoTier.id,
      price: ecoTier.price
    }
  ];

  const seats: SeatItem[] = [];

  zones.forEach(zone => {
    zone.rows.forEach(row => {
      for (let num = 1; num <= zone.seatsPerRow; num++) {
        const id = `${row}${num < 10 ? '0' + num : num}`;
        const hash = (id.charCodeAt(0) * 17 + num * 23 + eventId.length * 7) % 100;
        let status: 'available' | 'sold' | 'held' = 'available';
        if (hash < 25) {
          status = 'sold';
        } else if (hash < 35) {
          status = 'held';
        }

        seats.push({
          id,
          zoneId: zone.id,
          zoneName: zone.name,
          row,
          number: num,
          price: zone.price,
          status,
          tierId: zone.tierId
        });
      }
    });
  });

  localStorage.setItem(storageKey, JSON.stringify(seats));
  return seats;
}

export function saveSeatsForEvent(eventId: string, seats: SeatItem[]): void {
  const storageKey = `sms_event_seats_${eventId}`;
  localStorage.setItem(storageKey, JSON.stringify(seats));
}

