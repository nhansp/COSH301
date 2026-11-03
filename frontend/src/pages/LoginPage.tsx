import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Phone, Mail, ShieldCheck, ArrowLeft, Sparkles, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';
import { useFeatures } from '../context/FeatureContext';
import { Logo } from '../components/Logo';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const navigate = useNavigate();
  const { isAuthenticated, loginDemo, sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, verifyEmailOtp } = useAuth();
  const { getEventById } = useEvents();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();

  // Extract event info if redirecting to checkout
  const checkoutEventId = redirectUrl.startsWith('/checkout/')
    ? redirectUrl.replace('/checkout/', '').split('?')[0]
    : null;
  const targetEvent = checkoutEventId ? getEventById(checkoutEventId) : null;

  // Active method tab: 'phone' or 'email'
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');

  // Phone state
  const [countryCode, setCountryCode] = useState('+84');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Email state
  const [email, setEmail] = useState('');

  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectUrl]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: any = null;
    if (otpSent && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpSent, timer]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSending(true);

    try {
      if (authMethod === 'phone') {
        const cleanNumber = phoneNumber.trim().replace(/^0+/, '');
        if (!cleanNumber || cleanNumber.length < 7) {
          setErrorMsg('Vui lòng nhập số điện thoại hợp lệ (từ 8-11 chữ số).');
          setIsSending(false);
          return;
        }
        const fullPhone = `${countryCode} ${cleanNumber}`;
        const res = await sendPhoneOtp(fullPhone);
        setOtpSent(true);
        setTimer(60);
        setSuccessMsg(res.message);
      } else {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
          setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
          setIsSending(false);
          return;
        }
        const res = await sendEmailOtp(trimmedEmail);
        setOtpSent(true);
        setTimer(60);
        setSuccessMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    // Only digits
    const cleaned = val.replace(/\D/g, '');
    const newOtp = [...otpValues];

    if (cleaned.length > 1) {
      // Handle paste of full 6-digit code
      const pastedChars = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedChars[i] || '';
      }
      setOtpValues(newOtp);
      const nextFocus = Math.min(pastedChars.length, 5);
      otpInputsRef.current[nextFocus]?.focus();
      return;
    }

    newOtp[index] = cleaned.slice(-1);
    setOtpValues(newOtp);

    // Auto-focus next input
    if (cleaned && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    setErrorMsg(null);
    setIsVerifying(true);
    const code = codeToVerify || otpValues.join('');

    if (code.length !== 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã OTP.');
      setIsVerifying(false);
      return;
    }

    try {
      let success = false;
      if (authMethod === 'phone') {
        const fullPhone = `${countryCode} ${phoneNumber.trim()}`;
        success = await verifyPhoneOtp(fullPhone, code);
      } else {
        success = await verifyEmailOtp(email.trim(), code);
      }

      if (success) {
        setSuccessMsg('Xác thực thành công! Đang chuyển hướng...');
        setTimeout(() => {
          navigate(redirectUrl, { replace: true });
        }, 600);
      } else {
        setErrorMsg('Mã OTP không chính xác. Mã thử nghiệm hợp lệ là: 123456');
      }
    } catch (err: any) {
      setErrorMsg('Đã có lỗi xảy ra khi xác thực OTP.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Fast demo test 1-click login - bypass OTP with a real authenticated session
  const handleQuickDemoLogin = async (role: 'CUSTOMER' | 'ORGANIZER' = 'CUSTOMER') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsVerifying(true);
    try {
      const ok = await loginDemo(role);
      if (ok) {
        setSuccessMsg(
          role === 'ORGANIZER'
            ? 'Đăng nhập Ban Tổ Chức thành công! Đang chuyển hướng...'
            : 'Đăng nhập Khán giả Demo thành công! Đang chuyển hướng đến trang mua vé...'
        );
        setTimeout(() => {
          navigate(redirectUrl, { replace: true });
        }, 300);
      } else {
        setErrorMsg('Không thể đăng nhập thử nhanh. Vui lòng thử lại.');
      }
    } catch {
      setErrorMsg('Đã có lỗi xảy ra khi đăng nhập thử nhanh.');
    } finally {
      setIsVerifying(false);
    }
  };

  const inputClass =
    'h-11 sm:h-9 w-full min-w-0 rounded-lg bg-kumo-control px-3 text-base text-kumo-default ring ring-kumo-line placeholder:text-kumo-placeholder focus:outline-none focus:ring-2 focus:ring-kumo-brand';
  const primaryButtonClass =
    'flex h-11 sm:h-10 w-full items-center justify-center gap-2 rounded-lg bg-kumo-brand px-3.5 font-medium text-kumo-on-brand transition-colors hover:bg-kumo-brand-hover disabled:cursor-not-allowed disabled:opacity-50';
  const tabClass = (active: boolean) =>
    `flex h-11 sm:h-8 min-w-0 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${
      active
        ? 'bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line'
        : 'text-kumo-subtle hover:text-kumo-default'
    }`;


  if (featuresLoading || !isEnabled('otp_login')) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 text-center">
        {featuresLoading ? (
          <div className="size-8 rounded-full border-2 border-kumo-interact border-t-kumo-brand animate-spin" />
        ) : (
          <div>
            <p className="mb-4 text-kumo-default">Tính năng đăng nhập hiện chưa được mở.</p>
            <Link to="/" className="text-kumo-link underline decoration-kumo-interact hover:decoration-current underline-offset-2">
              Về trang chủ
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      {/* Top bar with back to home */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between gap-3">
        <Link
          to="/"
          aria-label="Quay lại trang chủ"
          className="inline-flex min-h-9 min-w-9 items-center justify-center sm:justify-start gap-1.5 rounded-md px-1.5 -ml-1.5 text-sm text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Quay lại trang chủ</span>
        </Link>
        <Logo />
      </div>

      {/* Main Login Card */}
      <div className="flex-1 w-full sm:flex sm:items-center">
      <div className="max-w-md w-full mx-auto pt-6 pb-8 sm:py-8">
        <div className="sm:rounded-xl sm:bg-kumo-base sm:p-8 sm:shadow-xs sm:ring sm:ring-kumo-line">
          {/* Informational Banner if redirected from Buy Tickets button */}
          {targetEvent && (
            <div className="mb-6 p-3 rounded-lg bg-kumo-recessed flex items-start gap-3">
              <img
                src={targetEvent.imageUrl}
                alt={targetEvent.title}
                className="w-12 h-12 rounded-md object-cover ring ring-kumo-line flex-shrink-0"
              />
              <div className="text-sm min-w-0 flex-1">
                <div className="font-semibold text-kumo-strong line-clamp-1">{targetEvent.title}</div>
                <div className="text-kumo-subtle line-clamp-1">{targetEvent.venue}</div>
                <div className="text-kumo-warning text-xs font-medium mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Cần xác thực để tiếp tục đặt vé sự kiện này</span>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <div className="size-10 rounded-lg bg-kumo-recessed ring ring-kumo-line grid place-items-center mb-4 text-kumo-default">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-kumo-strong tracking-tight">
              Đăng nhập / Xác thực OTP
            </h1>
            <p className="text-kumo-subtle mt-1">
              Bảo mật tài khoản và lưu trữ vé điện tử chính hãng của bạn
            </p>
          </div>

          {/* Method Tabs: Phone OTP vs Email OTP */}
          {!otpSent && (
            <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-kumo-recessed ring ring-kumo-line mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setErrorMsg(null);
                }}
                className={tabClass(authMethod === 'phone')}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Số điện thoại</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setErrorMsg(null);
                }}
                className={tabClass(authMethod === 'email')}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Địa chỉ Email</span>
              </button>
            </div>
          )}

          {/* Alert messages */}
          {errorMsg && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-kumo-danger-tint text-sm text-kumo-danger flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div role="status" className="mb-4 p-3 rounded-lg bg-kumo-success-tint text-sm text-kumo-success flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Enter Phone Number or Email */}
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {authMethod === 'phone' ? (
                <div>
                  <label htmlFor="login-phone" className="block text-sm font-medium text-kumo-default mb-1.5">
                    Số điện thoại nhận mã OTP *
                  </label>
                  <div className="flex gap-2">
                    <select
                      aria-label="Mã quốc gia"
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="h-11 sm:h-9 w-[5.75rem] shrink-0 rounded-lg bg-kumo-control px-2 text-base text-kumo-default ring ring-kumo-line focus:outline-none focus:ring-2 focus:ring-kumo-brand"
                    >
                      <option value="+84">🇻🇳 +84</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+65">🇸🇬 +65</option>
                    </select>

                    <div className="relative flex-1 min-w-0">
                      <input
                        id="login-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        required
                        placeholder="987 654 321"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className={`${inputClass} tabular-nums`}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-kumo-default mb-1.5">
                    Địa chỉ Email nhận mã xác thực *
                  </label>
                  <div className="relative">
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="tenban@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {/* Simulated Firebase Phone reCAPTCHA Notice */}
              <div className="flex items-center gap-2 text-xs text-kumo-subtle">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Được bảo vệ bởi Firebase Auth &amp; Google reCAPTCHA v3</span>
              </div>

              <button type="submit" disabled={isSending} className={primaryButtonClass}>
                {isSending ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <span>Gửi mã OTP xác thực</span>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Enter 6-digit OTP code */
            <div className="space-y-5">
              <div>
                <p className="text-kumo-subtle">
                  Nhập mã OTP 6 chữ số vừa được gửi tới:
                </p>
                <p className="text-lg font-semibold text-kumo-strong mt-0.5 tabular-nums break-all">
                  {authMethod === 'phone' ? `${countryCode} ${phoneNumber}` : email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpValues(['', '', '', '', '', '']);
                    setErrorMsg(null);
                  }}
                  className="min-h-9 text-sm text-kumo-link underline decoration-kumo-interact hover:decoration-current underline-offset-2 inline-flex items-center"
                >
                  Đổi số điện thoại / email khác
                </button>
              </div>

              {/* 6-box OTP Input */}
              <div className="flex items-center justify-center sm:justify-between gap-2">
                {otpValues.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    aria-label={`Chữ số OTP thứ ${idx + 1}`}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    className="h-12 flex-1 min-w-0 max-w-12 rounded-lg bg-kumo-control text-center text-xl font-semibold tabular-nums text-kumo-strong ring ring-kumo-line focus:outline-none focus:ring-2 focus:ring-kumo-brand transition-shadow"
                  />
                ))}
              </div>

              {/* Resend OTP timer */}
              <div className="text-sm text-kumo-subtle">
                {timer > 0 ? (
                  <span>
                    Gửi lại mã sau: <strong className="font-medium text-kumo-default tabular-nums">{timer}s</strong>
                  </span>
                ) : (
                  <button
                    onClick={() => handleSendOtp()}
                    disabled={isSending}
                    className="min-h-9 text-kumo-link font-medium underline decoration-kumo-interact hover:decoration-current underline-offset-2 disabled:opacity-50"
                  >
                    Gửi lại mã OTP ngay
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={isVerifying}
                className={primaryButtonClass}
              >
                {isVerifying ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <span>Xác nhận &amp; Đăng nhập</span>
                )}
              </button>
            </div>
          )}

          {/* Quick Demo Test Helper Banner */}
          <div className="mt-6 pt-5 border-t border-kumo-hairline text-center space-y-2">
            <button
              onClick={() => handleQuickDemoLogin('CUSTOMER')}
              disabled={isVerifying}
              className="flex h-11 sm:h-9 w-full items-center justify-center gap-2 rounded-lg bg-kumo-base px-3 font-medium text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-kumo-warning" />
              <span>⚡ Đăng nhập thử nhanh (Demo Khán giả)</span>
            </button>
            <button
              onClick={() => handleQuickDemoLogin('ORGANIZER')}
              disabled={isVerifying}
              className="flex h-11 sm:h-9 w-full items-center justify-center gap-2 rounded-lg bg-kumo-base px-3 text-sm font-medium text-kumo-subtle ring ring-kumo-line transition-colors hover:bg-kumo-tint hover:text-kumo-default disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-kumo-subtle" />
              <span>Đăng nhập thử Ban Tổ Chức (Organizer Demo)</span>
            </button>
            <p className="text-xs text-kumo-subtle mt-2">
              Chế độ Demo: Tự động khởi tạo phiên xác thực thực tế trên máy chủ mà không cần gửi OTP.
            </p>
          </div>
        </div>
      </div>

      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-kumo-subtle">
        SortMyScene Authentication System, Firebase OTP Architecture
      </div>
    </div>
  );
};
