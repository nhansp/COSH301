import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Copy,
  ImagePlus,
  Layers,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import { SeatItem, StageLayoutConfig } from '../../types';
import {
  CreateEventZonePayload,
  CreatedOrganizerEvent,
  apiCreateOrganizerEvent,
  pricingErrorMessage
} from '../../services/organizerService';
import { PRICE_BAND_COLORS, ZoneSummary } from '../../services/venue';
import { formatPrice } from '../../services/eventService';
import { StageDesignerControls } from './StageDesignerControls';
import { StageLayoutPreview } from './StageLayoutPreview';

interface DraftZone extends CreateEventZonePayload {
  uid: string;
}

const GENRE_OPTIONS = [
  'V-pop',
  'K-pop',
  'US-UK Pop',
  'Indie',
  'EDM',
  'Rock',
  'Acoustic',
  'Hip-hop / Rap',
  'R&B / Soul',
  'Ballad',
  'Jazz / Blues',
  'Classical / Giao hưởng',
  'Nhạc Trịnh / Bolero',
  'Festival / Đa thể loại',
  'Musical / Kịch nghệ',
  'Stand-up Comedy',
  'Fan Meeting',
  'Live Session'
];
const CUSTOM_GENRE_VALUE = '__custom__';
const CITY_OPTIONS = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Đà Lạt', 'Hải Phòng', 'Cần Thơ'];
const ZONE_SWATCHES = ['#f2c982', '#f4a782', '#e38c95', '#c37aac', '#9470b9', '#5a6bb5', '#34d399', '#38bdf8'];

const BANNER_PRESETS = [
  {
    label: 'Sân vận động ánh sáng',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Festival EDM & Laser',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Sân khấu Live Band',
    url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Nhà hát Acoustic ấm áp',
    url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80'
  }
];

interface VenueTemplate {
  id: string;
  label: string;
  subtitle: string;
  layoutConfig: StageLayoutConfig;
  zones: Omit<DraftZone, 'uid'>[];
}

const VENUE_TEMPLATES: VenueTemplate[] = [
  {
    id: 'stadium_thrust',
    label: 'Concert Sân vận động',
    subtitle: 'Sân khấu chữ T · 2 khu đứng + 4 khán đài',
    layoutConfig: {
      stageShape: 'thrust',
      layoutStyle: 'horseshoe',
      stageTheme: 'electric',
      stageLabel: 'MAIN STAGE',
      stageWidth: 18,
      stageDepth: 6,
      stageHeight: 1.4,
      catwalkLength: 7.5,
      catwalkWidth: 3.5,
      tierSpanDeg: 155,
      zonesPerRing: 3,
      pitWidth: 20,
      pitDepth: 3.4
    },
    zones: [
      {
        code: 'VIP_LEFT',
        name: 'VIP Fanzone Trái (đứng)',
        floor: 'Sàn chính',
        kind: 'standing',
        rows: 2,
        seatsPerRow: 10,
        basePrice: 4500000,
        floorPrice: 3600000,
        ceilingPrice: 5400000,
        isDynamicPricingEnabled: true,
        color: '#f2c982'
      },
      {
        code: 'VIP_RIGHT',
        name: 'VIP Fanzone Phải (đứng)',
        floor: 'Sàn chính',
        kind: 'standing',
        rows: 2,
        seatsPerRow: 10,
        basePrice: 4500000,
        floorPrice: 3600000,
        ceilingPrice: 5400000,
        isDynamicPricingEnabled: true,
        color: '#f4a782'
      },
      {
        code: 'PLATINUM',
        name: 'Platinum (ghế ngồi)',
        floor: 'Khán đài 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 12,
        basePrice: 3200000,
        floorPrice: 2560000,
        ceilingPrice: 3840000,
        isDynamicPricingEnabled: true,
        color: '#e38c95'
      },
      {
        code: 'CAT1',
        name: 'CAT 1 Trung tâm (ghế ngồi)',
        floor: 'Khán đài 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 12,
        basePrice: 2400000,
        floorPrice: 1920000,
        ceilingPrice: 2880000,
        isDynamicPricingEnabled: false,
        color: '#c37aac'
      },
      {
        code: 'CAT2',
        name: 'CAT 2 Cánh (ghế ngồi)',
        floor: 'Khán đài 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 12,
        basePrice: 1800000,
        floorPrice: 1440000,
        ceilingPrice: 2160000,
        isDynamicPricingEnabled: false,
        color: '#9470b9'
      },
      {
        code: 'CAT3',
        name: 'CAT 3 Tầng trên (ghế ngồi)',
        floor: 'Khán đài 2',
        kind: 'seated',
        rows: 2,
        seatsPerRow: 14,
        basePrice: 1100000,
        floorPrice: 880000,
        ceilingPrice: 1320000,
        isDynamicPricingEnabled: false,
        color: '#5a6bb5'
      }
    ]
  },
  {
    id: 'theater_acoustic',
    label: 'Nhà hát / Acoustic',
    subtitle: 'Bố cục nhà hát 92° · Toàn bộ ghế ngồi',
    layoutConfig: {
      stageShape: 'standard',
      layoutStyle: 'theater',
      stageTheme: 'gold',
      stageLabel: 'CONCERT HALL',
      stageWidth: 15,
      stageDepth: 6,
      stageHeight: 1.0,
      tierSpanDeg: 92,
      zonesPerRing: 2,
      pitWidth: 14,
      pitDepth: 3.0
    },
    zones: [
      {
        code: 'VVIP_A',
        name: 'VVIP Orchestra Trái',
        floor: 'Tầng trệt',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 10,
        basePrice: 3500000,
        floorPrice: 2800000,
        ceilingPrice: 4200000,
        isDynamicPricingEnabled: false,
        color: '#f2c982'
      },
      {
        code: 'VVIP_B',
        name: 'VVIP Orchestra Phải',
        floor: 'Tầng trệt',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 10,
        basePrice: 3500000,
        floorPrice: 2800000,
        ceilingPrice: 4200000,
        isDynamicPricingEnabled: false,
        color: '#f4a782'
      },
      {
        code: 'GOLD',
        name: 'Hạng Vàng (Mezzanine)',
        floor: 'Tầng 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 12,
        basePrice: 2200000,
        floorPrice: 1760000,
        ceilingPrice: 2640000,
        isDynamicPricingEnabled: false,
        color: '#c37aac'
      },
      {
        code: 'BALCONY',
        name: 'Ban công (Balcony)',
        floor: 'Tầng 2',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 12,
        basePrice: 1350000,
        floorPrice: 1080000,
        ceilingPrice: 1620000,
        isDynamicPricingEnabled: false,
        color: '#5a6bb5'
      }
    ]
  },
  {
    id: 'edm_catwalk',
    label: 'Lễ hội EDM / Festival',
    subtitle: 'Catwalk Runway · 3 khu đứng + 2 khu VIP ngồi',
    layoutConfig: {
      stageShape: 'catwalk',
      layoutStyle: 'horseshoe',
      stageTheme: 'emerald',
      stageLabel: 'DJ DECK',
      stageWidth: 20,
      stageDepth: 6,
      stageHeight: 1.8,
      catwalkLength: 8.5,
      catwalkWidth: 3.2,
      tierSpanDeg: 145,
      zonesPerRing: 2,
      pitWidth: 22,
      pitDepth: 3.6
    },
    zones: [
      {
        code: 'FRONT_L',
        name: 'Front Pit Trái (đứng)',
        floor: 'Sàn lễ hội',
        kind: 'standing',
        rows: 3,
        seatsPerRow: 12,
        basePrice: 2200000,
        floorPrice: 1760000,
        ceilingPrice: 2800000,
        isDynamicPricingEnabled: true,
        color: '#34d399'
      },
      {
        code: 'FRONT_R',
        name: 'Front Pit Phải (đứng)',
        floor: 'Sàn lễ hội',
        kind: 'standing',
        rows: 3,
        seatsPerRow: 12,
        basePrice: 2200000,
        floorPrice: 1760000,
        ceilingPrice: 2800000,
        isDynamicPricingEnabled: true,
        color: '#38bdf8'
      },
      {
        code: 'GA_FLOOR',
        name: 'GA Dance Floor (đứng)',
        floor: 'Sàn lễ hội',
        kind: 'standing',
        rows: 3,
        seatsPerRow: 16,
        basePrice: 1100000,
        floorPrice: 880000,
        ceilingPrice: 1450000,
        isDynamicPricingEnabled: true,
        color: '#9470b9'
      },
      {
        code: 'VIP_DECK_L',
        name: 'VIP Lounge Trái',
        floor: 'Đài VIP',
        kind: 'seated',
        rows: 2,
        seatsPerRow: 10,
        basePrice: 4800000,
        floorPrice: 3840000,
        ceilingPrice: 6000000,
        isDynamicPricingEnabled: true,
        color: '#f2c982'
      },
      {
        code: 'VIP_DECK_R',
        name: 'VIP Lounge Phải',
        floor: 'Đài VIP',
        kind: 'seated',
        rows: 2,
        seatsPerRow: 10,
        basePrice: 4800000,
        floorPrice: 3840000,
        ceilingPrice: 6000000,
        isDynamicPricingEnabled: true,
        color: '#f4a782'
      }
    ]
  },
  {
    id: 'arena_360',
    label: 'Đấu trường 360°',
    subtitle: 'Sân khấu đảo trung tâm · Khán đài bao quanh',
    layoutConfig: {
      stageShape: 'center',
      layoutStyle: 'arena360',
      stageTheme: 'sunset',
      stageLabel: '360° STAGE',
      stageWidth: 11,
      stageDepth: 10,
      stageHeight: 1.4,
      tierSpanDeg: 310,
      zonesPerRing: 4,
      pitWidth: 14,
      pitDepth: 3.0
    },
    zones: [
      {
        code: 'PIT_SOUTH',
        name: 'Standing Nam (đứng)',
        floor: 'Sàn trung tâm',
        kind: 'standing',
        rows: 2,
        seatsPerRow: 10,
        basePrice: 3800000,
        floorPrice: 3040000,
        ceilingPrice: 4560000,
        isDynamicPricingEnabled: true,
        color: '#f2c982'
      },
      {
        code: 'PIT_WEST',
        name: 'Standing Tây (đứng)',
        floor: 'Sàn trung tâm',
        kind: 'standing',
        rows: 2,
        seatsPerRow: 10,
        basePrice: 3800000,
        floorPrice: 3040000,
        ceilingPrice: 4560000,
        isDynamicPricingEnabled: true,
        color: '#f4a782'
      },
      {
        code: 'RING_A',
        name: 'Khán đài A (360°)',
        floor: 'Vòng 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 10,
        basePrice: 2600000,
        floorPrice: 2080000,
        ceilingPrice: 3120000,
        isDynamicPricingEnabled: false,
        color: '#e38c95'
      },
      {
        code: 'RING_B',
        name: 'Khán đài B (360°)',
        floor: 'Vòng 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 10,
        basePrice: 2600000,
        floorPrice: 2080000,
        ceilingPrice: 3120000,
        isDynamicPricingEnabled: false,
        color: '#c37aac'
      },
      {
        code: 'RING_C',
        name: 'Khán đài C (360°)',
        floor: 'Vòng 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 10,
        basePrice: 2200000,
        floorPrice: 1760000,
        ceilingPrice: 2640000,
        isDynamicPricingEnabled: false,
        color: '#9470b9'
      },
      {
        code: 'RING_D',
        name: 'Khán đài D (360°)',
        floor: 'Vòng 1',
        kind: 'seated',
        rows: 3,
        seatsPerRow: 10,
        basePrice: 2200000,
        floorPrice: 1760000,
        ceilingPrice: 2640000,
        isDynamicPricingEnabled: false,
        color: '#5a6bb5'
      }
    ]
  }
];

function defaultDateRange(): { startsAt: string; endsAt: string } {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  start.setHours(19, 30, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return { startsAt: fmt(start), endsAt: fmt(end) };
}

function hydrateZones(list: Omit<DraftZone, 'uid'>[]): DraftZone[] {
  return list.map((z, idx) => ({ ...z, uid: `dz-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}` }));
}

function toLocalISOOffset(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  if (datetimeLocal.includes('Z') || /[+-]\d{2}:\d{2}$/.test(datetimeLocal)) return datetimeLocal;
  return `${datetimeLocal}:00+07:00`;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

async function readAndOptimizeImage(file: File): Promise<{ dataUrl: string; sizeKb: number }> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh định dạng JPG, PNG, WebP hoặc GIF.');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Ảnh quá lớn (tối đa 10 MB). Vui lòng chọn tệp nhỏ hơn.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Không thể đọc tệp ảnh.')));
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });

  // Preserve animated GIFs directly if already under 1.2 MB.
  if (file.type === 'image/gif' && rawDataUrl.length < 1_500_000) {
    return { dataUrl: rawDataUrl, sizeKb: Math.max(1, Math.round((rawDataUrl.length * 0.75) / 1024)) };
  }

  // Resize & compress onto an offscreen canvas so persisted banners stay crisp and fast to load.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Tệp ảnh không hợp lệ hoặc bị hỏng.'));
    el.src = rawDataUrl;
  });

  const maxW = 1400;
  const maxH = 900;
  const scale = Math.min(1, maxW / Math.max(1, img.width), maxH / Math.max(1, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: rawDataUrl, sizeKb: Math.max(1, Math.round((rawDataUrl.length * 0.75) / 1024)) };
  }
  ctx.drawImage(img, 0, 0, width, height);

  let dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  if (dataUrl.length > 1_600_000) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  }
  if (dataUrl.length > 1_950_000) {
    throw new Error('Ảnh sau nén vẫn vượt quá 1.5 MB. Hãy chọn ảnh có độ phân giải nhỏ hơn.');
  }
  return { dataUrl, sizeKb: Math.max(1, Math.round((dataUrl.length * 0.75) / 1024)) };
}

interface EventCreatorStudioProps {
  onClose?: () => void;
  onCreated: (created: CreatedOrganizerEvent) => void;
  standalone?: boolean;
}

export const EventCreatorStudio: React.FC<EventCreatorStudioProps> = ({
  onClose,
  onCreated,
  standalone = false
}) => {
  const initialTemplate = VENUE_TEMPLATES[0];
  const initialDates = useMemo(defaultDateRange, []);

  const [section, setSection] = useState<'details' | 'stage' | 'zones'>('details');
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('V-pop');
  const [customGenre, setCustomGenre] = useState('');
  const [city, setCity] = useState('TP. Hồ Chí Minh');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [startsAt, setStartsAt] = useState(initialDates.startsAt);
  const [endsAt, setEndsAt] = useState(initialDates.endsAt);
  const [imageUrl, setImageUrl] = useState(BANNER_PRESETS[0].url);
  const [attachedFile, setAttachedFile] = useState<{ name: string; sizeKb: number } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError(null);
    setIsProcessingImage(true);
    try {
      const optimized = await readAndOptimizeImage(file);
      setImageUrl(optimized.dataUrl);
      setAttachedFile({ name: file.name, sizeKb: optimized.sizeKb });
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Không thể xử lý tệp ảnh.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSelectPresetOrUrl = (url: string) => {
    setImageUrl(url);
    setAttachedFile(null);
    setImageError(null);
  };
  const [maxTicketsInput, setMaxTicketsInput] = useState('4');
  const [status, setStatus] = useState<'ON_SALE' | 'DRAFT'>('ON_SALE');

  const [layoutConfig, setLayoutConfig] = useState<StageLayoutConfig>(initialTemplate.layoutConfig);
  const [zones, setZones] = useState<DraftZone[]>(() => hydrateZones(initialTemplate.zones));
  const [selectedZoneUid, setSelectedZoneUid] = useState<string | null>(() => null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeZoneUid = selectedZoneUid && zones.some(z => z.uid === selectedZoneUid) ? selectedZoneUid : zones[0]?.uid ?? null;

  // Build live ZoneSummary[] and synthetic SeatItem[] so StageLayoutPreview renders real-time rows & seats.
  const { previewZones, previewSeats, effectiveLayoutConfig } = useMemo(() => {
    const sorted = [...zones].sort((a, b) => b.basePrice - a.basePrice);
    const lastRank = Math.max(1, sorted.length - 1);
    const zoneStyles: Record<string, { color?: string; rows?: number; seatsPerRow?: number }> = {
      ...(layoutConfig.zoneStyles ?? {})
    };

    const pZones: ZoneSummary[] = sorted.map((z, rank) => {
      const cap = z.rows * z.seatsPerRow;
      const band = Math.round((rank / lastRank) * (PRICE_BAND_COLORS.length - 1));
      const color = z.color || PRICE_BAND_COLORS[band];
      const code = z.code.trim().toUpperCase() || `Z${rank + 1}`;
      zoneStyles[code] = { color, rows: z.rows, seatsPerRow: z.seatsPerRow };
      return {
        id: z.uid,
        code,
        name: z.name || code,
        shortName: (z.name || code).replace(/\s*\([^)]*\)\s*$/, '').trim() || code,
        kind: z.kind,
        basePrice: z.basePrice,
        priceFrom: z.basePrice,
        capacity: cap,
        available: cap,
        rank,
        band,
        color
      };
    });

    const pSeats: SeatItem[] = [];
    for (const z of sorted) {
      for (let r = 0; r < z.rows; r++) {
        const rowLabel = String.fromCharCode(65 + r);
        for (let n = 1; n <= z.seatsPerRow; n++) {
          pSeats.push({
            id: `${z.uid}-${rowLabel}${n}`,
            label: `${rowLabel}${n}`,
            zoneId: z.uid,
            zoneCode: z.code,
            zoneName: z.name,
            row: rowLabel,
            number: n,
            price: z.basePrice,
            status: 'available',
            tierId: z.uid
          });
        }
      }
    }

    return {
      previewZones: pZones,
      previewSeats: pSeats,
      effectiveLayoutConfig: { ...layoutConfig, zoneStyles }
    };
  }, [zones, layoutConfig]);

  const totalCapacity = useMemo(() => zones.reduce((acc, z) => acc + z.rows * z.seatsPerRow, 0), [zones]);

  const applyTemplate = (tpl: VenueTemplate) => {
    setLayoutConfig({ ...tpl.layoutConfig });
    const nextZones = hydrateZones(tpl.zones);
    setZones(nextZones);
    setSelectedZoneUid(nextZones[0]?.uid ?? null);
    setError(null);
  };

  const updateZone = (uid: string, patch: Partial<DraftZone>) => {
    setZones(prev =>
      prev.map(z => {
        if (z.uid !== uid) return z;
        const next = { ...z, ...patch };
        if (patch.basePrice !== undefined && patch.floorPrice === undefined && patch.ceilingPrice === undefined) {
          next.floorPrice = Math.round(patch.basePrice * 0.8);
          next.ceilingPrice = Math.round(patch.basePrice * 1.2);
        }
        return next;
      })
    );
  };

  const addZone = (kind: 'seated' | 'standing') => {
    if (zones.length >= 16) return;
    const idx = zones.length + 1;
    const base = kind === 'standing' ? 1800000 : 1500000;
    const next: DraftZone = {
      uid: `dz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `${kind === 'standing' ? 'PIT' : 'CAT'}_${idx}`,
      name: kind === 'standing' ? `Khu đứng ${idx} (đứng)` : `Khán đài ${idx} (ghế ngồi)`,
      floor: kind === 'standing' ? 'Sàn chính' : 'Khán đài',
      kind,
      rows: 2,
      seatsPerRow: 10,
      basePrice: base,
      floorPrice: Math.round(base * 0.8),
      ceilingPrice: Math.round(base * 1.2),
      isDynamicPricingEnabled: false,
      color: ZONE_SWATCHES[idx % ZONE_SWATCHES.length]
    };
    setZones(prev => [...prev, next]);
    setSelectedZoneUid(next.uid);
  };

  const duplicateZone = (z: DraftZone) => {
    if (zones.length >= 16) return;
    const copy: DraftZone = {
      ...z,
      uid: `dz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `${z.code}_2`.slice(0, 36),
      name: `${z.name} (bản sao)`
    };
    setZones(prev => [...prev, copy]);
    setSelectedZoneUid(copy.uid);
  };

  const removeZone = (uid: string) => {
    if (zones.length <= 1) return;
    setZones(prev => prev.filter(z => z.uid !== uid));
  };

  const moveZone = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= zones.length) return;
    setZones(prev => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !venueName.trim() || !city.trim()) {
      setError('Vui lòng nhập Tên sự kiện, Tên địa điểm và Thành phố ở mục Thông tin.');
      setSection('details');
      return;
    }
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
      setSection('details');
      return;
    }
    const parsedMaxTickets = Number.parseInt(maxTicketsInput.trim(), 10);
    if (!Number.isInteger(parsedMaxTickets) || parsedMaxTickets < 1 || parsedMaxTickets > 1500) {
      setError('Vé tối đa / khách phải là số nguyên từ 1 đến 1.500.');
      setSection('details');
      return;
    }
    const resolvedGenre = genre === CUSTOM_GENRE_VALUE ? customGenre.trim() : genre.trim();
    if (!resolvedGenre) {
      setError('Vui lòng chọn hoặc nhập thể loại sự kiện.');
      setSection('details');
      return;
    }
    if (totalCapacity > 1500) {
      setError('Tổng sức chứa tối đa là 1.500 chỗ cho mỗi sự kiện.');
      setSection('zones');
      return;
    }
    const seenCodes = new Set<string>();
    for (const z of zones) {
      const c = z.code.trim().toUpperCase();
      if (!z.name.trim() || !c) {
        setError('Mỗi khu vực cần có tên và mã khu.');
        setSection('zones');
        return;
      }
      if (seenCodes.has(c)) {
        setError(`Mã khu vực "${c}" đang bị trùng lặp.`);
        setSection('zones');
        return;
      }
      seenCodes.add(c);
      if (z.floorPrice > z.basePrice || z.basePrice > z.ceilingPrice || z.floorPrice < 0) {
        setError(`Biên giá của khu "${z.name}" chưa hợp lệ (cần Giá sàn ≤ Giá cơ bản ≤ Giá trần).`);
        setSection('zones');
        return;
      }
    }

    setIsSubmitting(true);
    const res = await apiCreateOrganizerEvent({
      name: name.trim(),
      description: description.trim() || `Sự kiện âm nhạc ${name.trim()} tại ${venueName.trim()}, ${city.trim()}.`,
      genre: resolvedGenre,
      city: city.trim(),
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim(),
      imageUrl: imageUrl.trim() || BANNER_PRESETS[0].url,
      startsAt: toLocalISOOffset(startsAt),
      endsAt: toLocalISOOffset(endsAt),
      status,
      maxTicketsPerUser: parsedMaxTickets,
      layoutConfig: effectiveLayoutConfig,
      zones: zones.map(z => ({
        code: z.code.trim().toUpperCase(),
        name: z.name.trim(),
        floor: z.floor?.trim() || '',
        kind: z.kind,
        rows: z.rows,
        seatsPerRow: z.seatsPerRow,
        basePrice: z.basePrice,
        floorPrice: z.floorPrice,
        ceilingPrice: z.ceilingPrice,
        isDynamicPricingEnabled: z.isDynamicPricingEnabled,
        color: z.color
      }))
    });
    setIsSubmitting(false);

    if (res.error || !res.event) {
      setError(pricingErrorMessage(res.error ?? 'unknown'));
      return;
    }
    onCreated(res.event);
  };

  return (
    <section
      aria-labelledby={standalone ? undefined : 'create-event-studio-title'}
      className={
        standalone
          ? 'overflow-hidden rounded-2xl bg-kumo-base ring ring-kumo-line'
          : 'mb-8 overflow-hidden rounded-2xl bg-kumo-base ring-2 ring-violet-ink/60 shadow-xl'
      }
    >
      {/* Studio Top Bar (omitted when hosted on its own dedicated page) */}
      {!standalone && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kumo-hairline bg-kumo-recessed/65 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-violet/20 text-violet-ink">
                <Wand2 className="size-4" />
              </span>
              <div>
                <h2 id="create-event-studio-title" className="text-base font-semibold text-kumo-strong">
                  Tạo sự kiện mới &amp; Thiết kế sân khấu
                </h2>
                <p className="text-xs text-kumo-subtle">
                  Cấu hình thông tin đêm diễn, hình dáng sân khấu, bố cục khán đài và tự động sinh sơ đồ ghế 2D/3D.
                </p>
              </div>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trình tạo sự kiện"
              className="btn btn-quiet btn-sm h-9"
            >
              <X className="size-4" />
              <span>Đóng</span>
            </button>
          )}
        </div>
      )}

      {/* Quick Starter Templates Strip */}
      <div className="border-b border-kumo-hairline bg-kumo-base px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-kumo-subtle">Mẫu nhanh:</span>
          {VENUE_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="rounded-full bg-kumo-recessed px-3 py-1 text-xs font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint hover:text-kumo-strong hover:ring-violet-ink/60"
              title={tpl.subtitle}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,1fr)]">
        {/* Left: 3-Step Configuration Tabs */}
        <div className="space-y-5">
          <div role="tablist" aria-label="Các bước tạo sự kiện" className="inline-flex flex-wrap gap-1 rounded-full bg-kumo-recessed p-1">
            {(
              [
                ['details', '1. Thông tin sự kiện', CalendarDays],
                ['stage', '2. Sân khấu & Bố cục', Sparkles],
                ['zones', `3. Khu vực & Ghế (${zones.length})`, Layers]
              ] as const
            ).map(([key, label, Icon]) => {
              const active = section === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSection(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active ? 'bg-kumo-contrast text-kumo-inverse' : 'text-kumo-subtle hover:text-kumo-strong'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {section === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-kumo-default">Tên sự kiện *</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="VD: Đêm Nhạc Hoàng Hôn Sài Gòn 2026"
                    className="field mt-1"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-kumo-default">Tên địa điểm (Venue) *</span>
                  <input
                    type="text"
                    required
                    value={venueName}
                    onChange={e => setVenueName(e.target.value)}
                    placeholder="VD: Nhà thi đấu Phú Thọ"
                    className="field mt-1"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-kumo-default">Thành phố *</span>
                  <input
                    type="text"
                    list="sms-city-options"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="TP. Hồ Chí Minh"
                    className="field mt-1"
                  />
                  <datalist id="sms-city-options">
                    {CITY_OPTIONS.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-kumo-default">Địa chỉ chi tiết</span>
                  <input
                    type="text"
                    value={venueAddress}
                    onChange={e => setVenueAddress(e.target.value)}
                    placeholder="VD: Số 1 Lữ Gia, Phường 15, Quận 11, TP. Hồ Chí Minh"
                    className="field mt-1"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-kumo-default">Bắt đầu *</span>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={e => setStartsAt(e.target.value)}
                    className="field mt-1 tabular-nums"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-kumo-default">Kết thúc *</span>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={e => setEndsAt(e.target.value)}
                    className="field mt-1 tabular-nums"
                  />
                </label>

                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-kumo-default">Thể loại</span>
                    <select
                      value={genre}
                      onChange={e => setGenre(e.target.value)}
                      className="field mt-1"
                    >
                      {GENRE_OPTIONS.map(g => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                      <option value={CUSTOM_GENRE_VALUE}>Thể loại khác (tự nhập)...</option>
                    </select>
                  </label>
                  {genre === CUSTOM_GENRE_VALUE && (
                    <input
                      type="text"
                      value={customGenre}
                      onChange={e => setCustomGenre(e.target.value)}
                      placeholder="Nhập thể loại sự kiện..."
                      className="field text-xs"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="text-xs font-semibold text-kumo-default">Vé tối đa / khách</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={maxTicketsInput}
                      onChange={e => setMaxTicketsInput(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="VD: 4, 10, 50..."
                      className="field mt-1 tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-kumo-default">Trạng thái</span>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as 'ON_SALE' | 'DRAFT')}
                      className="field mt-1"
                    >
                      <option value="ON_SALE">Mở bán ngay</option>
                      <option value="DRAFT">Lưu nháp</option>
                    </select>
                  </label>
                </div>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-kumo-default">Mô tả sự kiện</span>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Giới thiệu nghệ sĩ, điểm nhấn sân khấu, lịch trình mở cửa..."
                    className="field mt-1"
                  />
                </label>

                <div className="sm:col-span-2 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-kumo-default">Ảnh bìa sự kiện</span>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleAttachFile}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={isProcessingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-secondary btn-sm h-8 text-xs"
                      >
                        <Paperclip className="size-3.5 text-violet-ink" />
                        <span>{isProcessingImage ? 'Đang xử lý ảnh...' : 'Đính kèm ảnh'}</span>
                      </button>
                    </div>
                  </div>

                  {attachedFile ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-kumo-recessed/70 p-2.5 ring ring-violet-ink/60">
                      <img
                        src={imageUrl}
                        alt={attachedFile.name}
                        className="h-16 w-28 shrink-0 rounded-lg object-cover ring ring-kumo-line"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-kumo-strong">{attachedFile.name}</p>
                        <p className="mt-0.5 text-[11px] text-kumo-subtle tabular-nums">
                          Ảnh đã đính kèm · ~{attachedFile.sizeKb} KB (tự động tối ưu HD)
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn btn-secondary btn-sm h-8 text-xs"
                        >
                          <ImagePlus className="size-3.5" />
                          <span>Đổi ảnh</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectPresetOrUrl(BANNER_PRESETS[0].url)}
                          aria-label="Xóa ảnh đính kèm"
                          className="rounded-lg p-1.5 text-kumo-subtle transition-colors hover:bg-kumo-danger-tint hover:text-kumo-danger"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={e => handleSelectPresetOrUrl(e.target.value)}
                      placeholder="Hoặc dán URL ảnh https://..."
                      className="field"
                    />
                  )}

                  {imageError && (
                    <p role="alert" className="flex items-center gap-1.5 rounded-lg bg-kumo-danger-tint px-3 py-1.5 text-xs text-kumo-danger">
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>{imageError}</span>
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {BANNER_PRESETS.map(p => (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => handleSelectPresetOrUrl(p.url)}
                        className={`group overflow-hidden rounded-lg text-left transition-all ${
                          !attachedFile && imageUrl === p.url
                            ? 'ring-2 ring-violet-ink'
                            : 'ring ring-kumo-line hover:ring-kumo-interact'
                        }`}
                      >
                        <img src={p.url} alt={p.label} className="h-12 w-full object-cover" />
                        <span className="block truncate px-2 py-1 text-[10px] font-medium text-kumo-default">
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'stage' && (
            <StageDesignerControls value={layoutConfig} onChange={setLayoutConfig} />
          )}

          {section === 'zones' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-kumo-subtle">
                  Nhấn vào từng khu vực (hoặc trực tiếp trên sơ đồ bên phải) để chỉnh số hàng, số ghế, giá vé và màu sắc.
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => addZone('seated')}
                    disabled={zones.length >= 16}
                    className="btn btn-secondary btn-sm h-8 text-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Thêm khu ngồi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addZone('standing')}
                    disabled={zones.length >= 16}
                    className="btn btn-secondary btn-sm h-8 text-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Thêm khu đứng</span>
                  </button>
                </div>
              </div>

              <div className="max-h-[30rem] space-y-2.5 overflow-y-auto pr-1">
                {zones.map((z, idx) => {
                  const isActive = z.uid === activeZoneUid;
                  const cap = z.rows * z.seatsPerRow;
                  return (
                    <div
                      key={z.uid}
                      onClick={() => setSelectedZoneUid(z.uid)}
                      className={`rounded-xl p-3.5 transition-all ${
                        isActive
                          ? 'bg-kumo-tint/70 ring-2 ring-violet-ink'
                          : 'bg-kumo-recessed/55 ring ring-kumo-line hover:ring-kumo-interact'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-3 shrink-0 rounded-full ring-1 ring-black/15"
                            style={{ backgroundColor: z.color || PRICE_BAND_COLORS[idx % PRICE_BAND_COLORS.length] }}
                          />
                          <span className="truncate text-sm font-semibold text-kumo-strong">{z.name || z.code}</span>
                          <span className="rounded-full bg-kumo-base px-2 py-0.5 text-[10px] font-medium text-kumo-subtle ring ring-kumo-line">
                            {z.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'} · {cap} chỗ
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              moveZone(idx, -1);
                            }}
                            disabled={idx === 0}
                            aria-label="Đưa khu lên"
                            className="rounded-lg p-1 text-kumo-subtle hover:bg-kumo-base hover:text-kumo-strong disabled:opacity-35"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              moveZone(idx, 1);
                            }}
                            disabled={idx === zones.length - 1}
                            aria-label="Đưa khu xuống"
                            className="rounded-lg p-1 text-kumo-subtle hover:bg-kumo-base hover:text-kumo-strong disabled:opacity-35"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              duplicateZone(z);
                            }}
                            aria-label="Nhân bản khu"
                            className="rounded-lg p-1 text-kumo-subtle hover:bg-kumo-base hover:text-kumo-strong"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              removeZone(z.uid);
                            }}
                            disabled={zones.length <= 1}
                            aria-label="Xóa khu"
                            className="rounded-lg p-1 text-kumo-subtle hover:bg-kumo-danger-tint hover:text-kumo-danger disabled:opacity-35"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {isActive && (
                        <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-kumo-hairline pt-3 sm:grid-cols-3">
                          <label className="col-span-2 block text-xs">
                            <span className="text-kumo-subtle">Tên khu vực</span>
                            <input
                              type="text"
                              value={z.name}
                              onChange={e => updateZone(z.uid, { name: e.target.value })}
                              className="field mt-1 text-xs"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="text-kumo-subtle">Mã khu</span>
                            <input
                              type="text"
                              value={z.code}
                              onChange={e => updateZone(z.uid, { code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                              className="field mt-1 text-xs uppercase"
                            />
                          </label>

                          <label className="block text-xs">
                            <span className="text-kumo-subtle">Loại khu</span>
                            <select
                              value={z.kind}
                              onChange={e => updateZone(z.uid, { kind: e.target.value as 'seated' | 'standing' })}
                              className="field mt-1 text-xs"
                            >
                              <option value="seated">Ghế ngồi</option>
                              <option value="standing">Khu đứng</option>
                            </select>
                          </label>
                          <label className="block text-xs">
                            <span className="text-kumo-subtle">Số hàng (1–12)</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={z.rows}
                              onChange={e => updateZone(z.uid, { rows: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
                              className="field mt-1 text-xs tabular-nums"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="text-kumo-subtle">Ghế / hàng (1–24)</span>
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={z.seatsPerRow}
                              onChange={e =>
                                updateZone(z.uid, { seatsPerRow: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })
                              }
                              className="field mt-1 text-xs tabular-nums"
                            />
                          </label>

                          <div className="col-span-2 sm:col-span-3">
                            <span className="block text-[11px] font-medium text-kumo-subtle">
                              Chế độ giá cho khu vực này
                            </span>
                            <div
                              role="radiogroup"
                              aria-label={`Chế độ giá ${z.name}`}
                              className="mt-1.5 grid grid-cols-2 gap-2"
                            >
                              <button
                                type="button"
                                role="radio"
                                aria-checked={!z.isDynamicPricingEnabled}
                                onClick={() =>
                                  updateZone(z.uid, {
                                    isDynamicPricingEnabled: false,
                                    floorPrice: z.basePrice,
                                    ceilingPrice: z.basePrice
                                  })
                                }
                                className={`rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                                  !z.isDynamicPricingEnabled
                                    ? 'bg-kumo-tint font-semibold text-kumo-strong ring-2 ring-violet-ink'
                                    : 'bg-kumo-base text-kumo-subtle ring ring-kumo-line hover:text-kumo-strong'
                                }`}
                              >
                                Giá cố định (Fixed)
                              </button>
                              <button
                                type="button"
                                role="radio"
                                aria-checked={z.isDynamicPricingEnabled}
                                onClick={() => {
                                  const needsBand = z.basePrice > 0 && z.floorPrice === z.basePrice && z.ceilingPrice === z.basePrice;
                                  updateZone(z.uid, {
                                    isDynamicPricingEnabled: true,
                                    floorPrice: needsBand ? Math.round((z.basePrice * 0.8) / 1000) * 1000 : z.floorPrice,
                                    ceilingPrice: needsBand ? Math.round((z.basePrice * 1.2) / 1000) * 1000 : z.ceilingPrice
                                  });
                                }}
                                className={`rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                                  z.isDynamicPricingEnabled
                                    ? 'bg-kumo-tint font-semibold text-kumo-strong ring-2 ring-violet-ink'
                                    : 'bg-kumo-base text-kumo-subtle ring ring-kumo-line hover:text-kumo-strong'
                                }`}
                              >
                                Giá động (Dynamic)
                              </button>
                            </div>
                          </div>

                          {z.isDynamicPricingEnabled ? (
                            <>
                              <label className="block text-xs">
                                <span className="text-kumo-subtle">Giá cơ bản (VND)</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={50000}
                                  value={z.basePrice}
                                  onChange={e => updateZone(z.uid, { basePrice: Math.max(0, Number(e.target.value) || 0) })}
                                  className="field mt-1 text-xs tabular-nums"
                                />
                                <span className="mt-0.5 block text-[10px] text-kumo-subtle">{formatPrice(z.basePrice)}</span>
                              </label>
                              <label className="block text-xs">
                                <span className="text-kumo-subtle">Giá sàn</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={50000}
                                  value={z.floorPrice}
                                  onChange={e => updateZone(z.uid, { floorPrice: Math.max(0, Number(e.target.value) || 0) })}
                                  className="field mt-1 text-xs tabular-nums"
                                />
                              </label>
                              <label className="block text-xs">
                                <span className="text-kumo-subtle">Giá trần</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={50000}
                                  value={z.ceilingPrice}
                                  onChange={e => updateZone(z.uid, { ceilingPrice: Math.max(0, Number(e.target.value) || 0) })}
                                  className="field mt-1 text-xs tabular-nums"
                                />
                              </label>
                            </>
                          ) : (
                            <label className="col-span-2 block text-xs sm:col-span-3">
                              <span className="text-kumo-subtle">Giá cố định (VND)</span>
                              <input
                                type="number"
                                min={0}
                                step={50000}
                                value={z.basePrice}
                                onChange={e => {
                                  const nextPrice = Math.max(0, Number(e.target.value) || 0);
                                  updateZone(z.uid, {
                                    basePrice: nextPrice,
                                    floorPrice: nextPrice,
                                    ceilingPrice: nextPrice
                                  });
                                }}
                                className="field mt-1 text-xs tabular-nums"
                              />
                              <span className="mt-0.5 block text-[10px] text-kumo-subtle">
                                {formatPrice(z.basePrice)} · Giá niêm yết cố định cho khu vực này
                              </span>
                            </label>
                          )}

                          <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1 sm:col-span-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-kumo-subtle">Màu khu:</span>
                              {ZONE_SWATCHES.map(hex => (
                                <button
                                  key={hex}
                                  type="button"
                                  aria-label={`Màu ${hex}`}
                                  onClick={() => updateZone(z.uid, { color: hex })}
                                  className={`size-4 rounded-full transition-transform ${
                                    (z.color || '').toLowerCase() === hex.toLowerCase()
                                      ? 'scale-110 ring-2 ring-kumo-strong ring-offset-1 ring-offset-kumo-base'
                                      : 'hover:scale-110'
                                  }`}
                                  style={{ backgroundColor: hex }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {section !== 'zones' ? (
                <button
                  type="button"
                  onClick={() => setSection(section === 'details' ? 'stage' : 'zones')}
                  className="btn btn-secondary btn-sm h-10"
                >
                  <span>Bước tiếp theo →</span>
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting || totalCapacity > 1500}
                className="btn btn-ink btn-sm h-10"
              >
                <CheckCircle2 className="size-4" />
                <span>{isSubmitting ? 'Đang khởi tạo sự kiện...' : 'Tạo sự kiện & Sinh sơ đồ ghế'}</span>
              </button>
            </div>

            {error && (
              <p role="alert" className="flex items-center gap-1.5 rounded-lg bg-kumo-danger-tint px-3 py-2 text-xs text-kumo-danger">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>

        {/* Right: Sticky Live Stage & Layout Preview */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <StageLayoutPreview
            zones={previewZones}
            seats={previewSeats}
            layoutConfig={effectiveLayoutConfig}
            selectedZoneId={activeZoneUid}
            onSelectZone={uid => {
              setSelectedZoneUid(uid);
              if (section === 'details') setSection('zones');
            }}
            title={name.trim() ? `Bố cục · ${name.trim()}` : 'Xem trước sân khấu & sơ đồ chỗ ngồi'}
          />
          <p className="mt-2.5 text-center text-[11px] text-kumo-subtle">
            Sơ đồ 2D và sân khấu 3D cho khán giả sẽ tự động dựng trực tiếp từ thiết kế này.
          </p>
        </div>
      </form>
    </section>
  );
};
