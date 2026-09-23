import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Phone, Mail, ShieldCheck, ArrowLeft, ArrowRight, Sparkles, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const navigate = useNavigate();
  const { isAuthenticated, sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, verifyEmailOtp } = useAuth();
  const { getEventById } = useEvents();

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

  // Fast demo test filler
  const handleQuickDemoLogin = async () => {
    const demoPhone = '0987654321';
    setPhoneNumber(demoPhone);
    setAuthMethod('phone');
    setIsSending(true);
    await new Promise(r => setTimeout(r, 300));
    setOtpSent(true);
    setOtpValues(['1', '2', '3', '4', '5', '6']);
    setIsSending(false);
    await handleVerifyOtp('123456');
  };

  return (
    <div className="min-h-screen purple-glow-bg flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Top bar with back to home */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-purple-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang chủ</span>
        </Link>
        <span className="font-extrabold text-sm tracking-wider text-white font-mono">
          SORT<span className="text-purple-400 font-light italic">MY</span>SCENE
        </span>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="rounded-3xl bg-[#1d0e32]/95 border border-purple-700/60 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Informational Banner if redirected from Buy Tickets button */}
          {targetEvent && (
            <div className="mb-6 p-3.5 rounded-2xl bg-purple-950/80 border border-purple-600/40 flex items-start gap-3">
              <img
                src={targetEvent.imageUrl}
                alt={targetEvent.title}
                className="w-12 h-12 rounded-xl object-cover border border-purple-500/30 flex-shrink-0"
              />
              <div className="text-xs">
                <div className="font-bold text-white line-clamp-1">{targetEvent.title}</div>
                <div className="text-purple-300/80 line-clamp-1">{targetEvent.venue}</div>
                <div className="text-pink-400 font-medium mt-0.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Cần xác thực để tiếp tục đặt vé sự kiện này</span>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center mx-auto mb-3 text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Đăng nhập / Xác thực OTP
            </h1>
            <p className="text-xs text-purple-300/70 mt-1">
              Bảo mật tài khoản và lưu trữ vé điện tử chính hãng của bạn
            </p>
          </div>

          {/* Method Tabs: Phone OTP vs Email OTP */}
          {!otpSent && (
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#130920] border border-purple-900/80 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setErrorMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authMethod === 'phone'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-purple-300/70 hover:text-white'
                }`}
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
                className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authMethod === 'email'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Địa chỉ Email</span>
              </button>
            </div>
          )}

          {/* Alert messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-xs text-red-200 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Enter Phone Number or Email */}
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {authMethod === 'phone' ? (
                <div>
                  <label className="block text-xs font-semibold text-purple-200 mb-2">
                    Số điện thoại nhận mã OTP *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="w-24 px-2 py-2.5 rounded-xl bg-[#140a24] border border-purple-900/80 text-xs text-purple-100 focus:outline-none focus:border-purple-500"
                    >
                      <option value="+84">🇻🇳 +84</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+65">🇸🇬 +65</option>
                    </select>

                    <div className="relative flex-1">
                      <input
                        type="tel"
                        required
                        placeholder="987 654 321"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className="w-full pl-3.5 pr-3 py-2.5 rounded-xl bg-[#140a24] border border-purple-900/80 text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 font-mono tracking-wider"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-purple-200 mb-2">
                    Địa chỉ Email nhận mã xác thực *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="tenban@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#140a24] border border-purple-900/80 text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Simulated Firebase Phone reCAPTCHA Notice */}
              <div className="p-2.5 rounded-xl bg-[#130822] border border-purple-950 flex items-center gap-2 text-[11px] text-purple-400/70">
                <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>Được bảo vệ bởi Firebase Auth &amp; Google reCAPTCHA v3</span>
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSending ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>Gửi mã OTP xác thực</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Enter 6-digit OTP code */
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-xs text-purple-300">
                  Nhập mã OTP 6 chữ số vừa được gửi tới:
                </p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {authMethod === 'phone' ? `${countryCode} ${phoneNumber}` : email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpValues(['', '', '', '', '', '']);
                    setErrorMsg(null);
                  }}
                  className="text-xs text-pink-400 hover:underline mt-1 inline-block"
                >
                  Đổi số điện thoại / email khác
                </button>
              </div>

              {/* 6-box OTP Input */}
              <div className="flex items-center justify-between gap-2 max-w-xs mx-auto">
                {otpValues.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    className="w-11 h-13 text-center text-xl font-bold rounded-xl bg-[#130822] border-2 border-purple-800 focus:border-purple-400 focus:bg-purple-950/40 text-white focus:outline-none transition-all"
                  />
                ))}
              </div>

              {/* Resend OTP timer */}
              <div className="text-center text-xs text-purple-300/80">
                {timer > 0 ? (
                  <span>Gửi lại mã sau: <strong className="text-purple-300">{timer}s</strong></span>
                ) : (
                  <button
                    onClick={() => handleSendOtp()}
                    disabled={isSending}
                    className="text-purple-400 hover:text-white font-semibold underline"
                  >
                    Gửi lại mã OTP ngay
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={isVerifying}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifying ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <span>Xác nhận &amp; Đăng nhập</span>
                )}
              </button>
            </div>
          )}

          {/* Quick Demo Test Helper Banner */}
          <div className="mt-6 pt-5 border-t border-purple-900/60 text-center">
            <button
              onClick={handleQuickDemoLogin}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-600/40 text-xs font-semibold text-purple-200 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>⚡ Đăng nhập thử nhanh (Demo 1-Click)</span>
            </button>
            <p className="text-[11px] text-purple-400/60 mt-1.5">
              Mã OTP thử nghiệm định sẵn: <strong className="text-purple-300 font-mono">123456</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-purple-400/60">
        SortMyScene Authentication System • Firebase OTP Architecture
      </div>
    </div>
  );
};
