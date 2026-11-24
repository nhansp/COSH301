import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Asks the server for a login code; `demoCode` is set when the server shows codes on screen, `delivery` is `app` when the OTP app shows it. */
  requestOtp: (destination: string) => Promise<OtpResult & { demoCode?: string; delivery?: string }>;
  /** Signs in with a login code. Succeeds only when the server opened a session. */
  verifyOtp: (destination: string, code: string) => Promise<OtpResult>;
  /** One-click demo account; only call it when `/api/features` reports `demoLogin`. */
  demoLogin: () => Promise<OtpResult>;
  /** Drops the signed-in user after the server reports the session is gone. */
  sessionExpired: () => void;
  logout: () => void;
}

/** `error` is a message for the user, set whenever `ok` is false. */
export type OtpResult = { ok: boolean; error?: string };

const AUTH_ERRORS: Record<string, string> = {
  invalid_destination: 'Số điện thoại hoặc email không hợp lệ.',
  otp_rate_limited: 'Bạn vừa yêu cầu mã. Vui lòng đợi một chút rồi thử lại.',
  otp_invalid: 'Mã OTP không đúng hoặc đã hết hạn.',
  account_inactive: 'Tài khoản này đã bị khoá.',
  rate_limited: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
};

async function authErrorOf(res: Response): Promise<string> {
  const code = await res
    .json()
    .then((body: { error?: string }) => body.error ?? '')
    .catch(() => '');
  return AUTH_ERRORS[code] ?? 'Không đăng nhập được lúc này. Vui lòng thử lại.';
}

const OFFLINE_ERROR = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ApiUser {
  id: string;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  role?: UserRole;
}

function userFromApi(u: ApiUser): User {
  const phone = u.phone || undefined;
  const email = u.email || undefined;
  const handle = phone || email || u.id;
  return {
    id: u.id,
    name: u.fullName || (phone ? `User ${phone.slice(-4)}` : (email ? email.split('@')[0] : 'User')),
    phone,
    email,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(handle)}`,
    authProvider: phone ? 'phone' : 'email',
    role: u.role,
    createdAt: new Date().toISOString()
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // The server session (HttpOnly cookie) is the source of truth; restore it via /api/auth/me.
  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (isMounted && data?.user) setUser(userFromApi(data.user));
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Only the server can open a session: seat holds and orders are checked against its cookie.
  const signIn = async (path: string, body: object): Promise<OtpResult> => {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) return { ok: false, error: await authErrorOf(res) };
      const data = await res.json();
      setUser(userFromApi(data.user));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE_ERROR };
    }
  };

  const requestOtp = async (destination: string): Promise<OtpResult & { demoCode?: string; delivery?: string }> => {
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination })
      });
      if (!res.ok) return { ok: false, error: await authErrorOf(res) };
      const data: { demoCode?: string; delivery?: string } = await res.json();
      return { ok: true, demoCode: data.demoCode, delivery: data.delivery };
    } catch {
      return { ok: false, error: OFFLINE_ERROR };
    }
  };

  const verifyOtp = (destination: string, code: string) => signIn('/api/auth/otp/verify', { destination, code });
  const demoLogin = () => signIn('/api/auth/demo-login', {});
  const sessionExpired = () => setUser(null);

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        requestOtp,
        verifyOtp,
        demoLogin,
        sessionExpired,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
