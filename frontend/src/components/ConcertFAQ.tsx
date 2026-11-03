import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'Làm thế nào để xem lại vé và mã QR sau khi đặt thành công?',
    answer:
      'Sau khi thanh toán thành công, vé của bạn sẽ xuất hiện ngay lập tức trong mục "My Tickets" trên thanh điều hướng. Bạn có thể mở vé bất kỳ lúc nào để xem chi tiết hạng ghế, thông tin sự kiện và mã QR check-in.',
  },
  {
    question: 'Tôi có thể dùng ảnh chụp màn hình mã QR để vào cổng không?',
    answer:
      'Để đảm bảo an toàn tuyệt đối và chống gian lận, chúng tôi khuyến nghị bạn mở trực tiếp vé trên website hoặc ứng dụng khi check-in tại cổng kiểm soát. Mã QR được tích hợp cơ chế bảo mật xác thực danh tính người mua.',
  },
  {
    question: 'Nếu sự kiện bị hủy hoặc dời lịch thì quyền lợi của tôi được bảo vệ ra sao?',
    answer:
      'SortMyScene cam kết chính sách bảo vệ khán giả 100%. Nếu ban tổ chức dời lịch, vé của bạn sẽ tự động có giá trị cho ngày diễn mới. Trong trường hợp concert bị hủy, hệ thống sẽ tự động hoàn tiền 100% vào tài khoản thanh toán ban đầu của bạn.',
  },
  {
    question: 'Tôi có thể đặt nhiều ghế liền kề cho nhóm bạn đi cùng không?',
    answer:
      'Có. Khi chọn sự kiện có sơ đồ ghế (Seat Map), bạn có thể trực tiếp chọn các ghế trống nằm cạnh nhau trong cùng một phân khu. Hệ thống sẽ giữ chỗ cho tất cả các ghế bạn đã chọn trong 10 phút để bạn hoàn tất đặt vé.',
  },
  {
    question: 'Thời gian mở cửa đón khán giả trước giờ diễn là bao lâu?',
    answer:
      'Thông thường cổng soát vé sẽ mở từ 2 đến 3 tiếng trước giờ biểu diễn chính thức để khán giả làm thủ tục check-in, an ninh và ổn định chỗ ngồi. Bạn nên đến sớm để có trải nghiệm check-in thuận lợi nhất.',
  },
];

export const ConcertFAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (idx: number) => {
    setOpenIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <section className="my-14 pt-6 border-t border-emerald-500/15">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-3">
          <HelpCircle className="size-3.5" />
          <span>Giải đáp thắc mắc</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kumo-strong">
          Câu hỏi thường gặp về vé concert
        </h2>
        <p className="mt-2 text-base text-kumo-subtle">
          Những thông tin quan trọng bạn cần biết để có một đêm nhạc trọn vẹn và an tâm
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'bg-kumo-base border-emerald-500/40 shadow-sm shadow-emerald-950/5'
                  : 'bg-kumo-base/60 border-kumo-line hover:border-emerald-500/30'
              }`}
            >
              <button
                onClick={() => toggleItem(index)}
                aria-expanded={isOpen}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 transition-colors"
              >
                <span className="font-semibold text-kumo-strong text-base">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`size-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-sm text-kumo-subtle leading-relaxed border-t border-kumo-hairline/60 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
