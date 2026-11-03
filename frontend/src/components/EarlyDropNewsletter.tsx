import React, { useState } from 'react';
import { Bell, CheckCircle2, Send, Sparkles } from 'lucide-react';

export const EarlyDropNewsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setIsSubscribed(true);
    }
  };

  return (
    <section className="my-14 pt-6 border-t border-emerald-500/15">
      <div className="relative rounded-3xl overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-emerald-600/[0.12] via-emerald-500/[0.06] to-teal-500/[0.1] p-8 sm:p-10 md:p-12 text-center max-w-4xl mx-auto shadow-sm">
        {/* Ambient background blur */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-emerald-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-72 rounded-full bg-teal-500/15 blur-3xl"
        />

        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <Bell className="size-3.5" />
            <span>Early-Bird Ticket Drops</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-kumo-strong">
            Đừng bỏ lỡ concert tiếp theo của thần tượng
          </h2>

          <p className="text-sm sm:text-base text-kumo-subtle leading-relaxed">
            Đăng ký nhận thông báo mở bán sớm 15-30 phút trước giờ mở cổng vé chính thức. Nhận mã ưu đãi độc quyền và lịch diễn các tour concert mới nhất.
          </p>

          {isSubscribed ? (
            <div className="pt-4 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-500/15 py-3 px-6 rounded-xl border border-emerald-500/30 w-fit mx-auto animate-fade-in">
              <CheckCircle2 className="size-5" />
              <span>Đã đăng ký thành công! Bạn sẽ nhận được thông báo vé sớm nhất qua email.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pt-4 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Nhập địa chỉ email của bạn..."
                aria-label="Địa chỉ email nhận thông báo"
                className="flex-1 h-11 sm:h-12 px-4 rounded-xl bg-kumo-base ring-1 ring-emerald-500/30 text-kumo-default placeholder:text-kumo-placeholder focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm sm:text-base shadow-xs"
              />
              <button
                type="submit"
                className="h-11 sm:h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
              >
                <span>Nhận tin sớm</span>
                <Send className="size-4" />
              </button>
            </form>
          )}

          <p className="text-xs text-kumo-subtle pt-2">
            Cam kết không spam. Khán giả có thể hủy đăng ký bất kỳ lúc nào với 1 click.
          </p>
        </div>
      </div>
    </section>
  );
};
