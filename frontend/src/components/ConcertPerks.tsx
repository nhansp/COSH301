import React from 'react';
import { ShieldCheck, Clock, QrCode, CreditCard, Sparkles } from 'lucide-react';

const PERKS = [
  {
    icon: ShieldCheck,
    title: '100% Vé Chính Hãng Chống Giả',
    description:
      'Vé điện tử tạo mã QR độc bản được ký số bảo mật, liên kết trực tiếp tài khoản khán giả, loại trừ hoàn toàn rủi ro vé giả mạo chợ đen.',
  },
  {
    icon: Clock,
    title: 'Giữ Chỗ Thời Gian Thực 10 Phút',
    description:
      'Tự do chọn ghế ngồi đẹp trên sơ đồ khán đài với cơ chế lock ghế tức thì, giúp bạn thư thái kiểm tra thông tin và thanh toán an toàn.',
  },
  {
    icon: QrCode,
    title: 'Check-in Không Chạm Siêu Tốc',
    description:
      'Không cần xếp hàng đổi vé giấy. Chỉ cần mở mục "Vé của tôi", đưa mã QR trước máy quét tại cổng và bước thẳng vào thế giới âm nhạc.',
  },
  {
    icon: CreditCard,
    title: 'Thanh Toán Linh Hoạt & An Tâm',
    description:
      'Hỗ trợ quét mã VietQR, thẻ thanh toán và ví điện tử tức thì. Chính sách hoàn tiền 100% minh bạch nếu sự kiện bị hoãn hoặc hủy bỏ.',
  },
];

export const ConcertPerks: React.FC = () => {
  return (
    <section className="my-14 pt-6 border-t border-emerald-500/15">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-3">
          <Sparkles className="size-3.5" />
          <span>Cam kết tiêu chuẩn 5 sao</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kumo-strong">
          Trải nghiệm mua vé trọn vẹn và an tâm
        </h2>
        <p className="mt-2 text-base text-kumo-subtle">
          Được thiết kế vì niềm tin và sự thuận tiện tối đa của hàng chục nghìn khán giả yêu nhạc
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PERKS.map((perk, index) => {
          const Icon = perk.icon;
          return (
            <div
              key={index}
              className="p-6 rounded-2xl bg-kumo-base ring-1 ring-emerald-500/20 hover:ring-emerald-500/50 hover:shadow-lg hover:shadow-emerald-950/10 transition-all hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="size-11 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 grid place-items-center mb-4 ring-1 ring-emerald-500/30">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-bold text-kumo-strong leading-snug mb-2">
                  {perk.title}
                </h3>
                <p className="text-sm text-kumo-subtle leading-relaxed">
                  {perk.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
