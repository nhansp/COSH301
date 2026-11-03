import React from 'react';
import { Star, MessageSquareQuote, CheckCircle2 } from 'lucide-react';

interface Review {
  id: string;
  name: string;
  location: string;
  concert: string;
  avatar: string;
  rating: number;
  content: string;
  date: string;
}

const REVIEWS: Review[] = [
  {
    id: '1',
    name: 'Nguyễn Lan Anh',
    location: 'Hà Nội',
    concert: 'Mỹ Tâm Live Concert "See The Light"',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    content:
      'Lần đầu tiên mình săn vé concert mà không gặp tình trạng crash web lúc mở bán! Giao diện tông màu xanh lá cây nhìn rất dịu mắt, thao tác chọn vị trí ghế VIP trên sơ đồ cực kỳ mượt mà. 10/10 trải nghiệm!',
    date: 'Tháng 12, 2025',
  },
  {
    id: '2',
    name: 'Trần Minh Quân',
    location: 'TP. Hồ Chí Minh',
    concert: 'Anh Trai "Say Hi" - Đêm 9 (Vạn Phúc City)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    content:
      'Vé điện tử lưu sẵn trong mục Vé của tôi, mở offline vẫn hiển thị rõ nét mã QR. Đến cổng Vạn Phúc City giơ màn hình trước máy quét chưa đầy 2 giây là xong, không phải chen chúc đổi vé cứng.',
    date: 'Tháng 4, 2026',
  },
  {
    id: '3',
    name: 'Lê Thảo Vy',
    location: 'Đà Nẵng',
    concert: 'BLACKPINK Born Pink World Tour Hanoi',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    content:
      'Rất thích chính sách giữ chỗ 10 phút, mình và hội bạn có đủ thời gian thống nhất vị trí ngồi cạnh nhau rồi thanh toán VietQR trong nháy mắt. An tâm tuyệt đối vì không sợ mua phải vé chợ đen giả.',
    date: 'Tháng 7, 2023',
  },
];

export const FanReviews: React.FC = () => {
  return (
    <section className="my-14 pt-6 border-t border-emerald-500/15">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-3">
          <MessageSquareQuote className="size-3.5" />
          <span>Cộng đồng khán giả</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kumo-strong">
          Khán giả nói gì về SortMyScene?
        </h2>
        <p className="mt-2 text-base text-kumo-subtle">
          Những chia sẻ chân thực từ những người hâm mộ đã trực tiếp hòa mình vào không khí đêm nhạc
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {REVIEWS.map(rev => (
          <div
            key={rev.id}
            className="p-6 rounded-2xl bg-kumo-base ring-1 ring-emerald-500/20 hover:ring-emerald-500/40 hover:shadow-lg hover:shadow-emerald-950/10 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Star rating */}
              <div className="flex items-center gap-1 text-amber-500 mb-4">
                {Array.from({ length: rev.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Review text */}
              <p className="text-sm text-kumo-default leading-relaxed italic">
                "{rev.content}"
              </p>
            </div>

            {/* Author info */}
            <div className="pt-4 mt-6 border-t border-kumo-hairline flex items-center gap-3">
              <img
                src={rev.avatar}
                alt={rev.name}
                className="size-10 rounded-full object-cover ring-2 ring-emerald-500/30"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-bold text-kumo-strong truncate">
                    {rev.name}
                  </h4>
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-kumo-subtle truncate">
                  {rev.location} • {rev.concert}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
