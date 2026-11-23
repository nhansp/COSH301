import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Booking } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bookings: Booking[];
  /** Asks the server for a login code; `demoCode` is set when the server shows codes on screen. */
  requestOtp: (destination: string) => Promise<OtpResult & { demoCode?: string }>;
  /** Signs in with a login code. Succeeds only when the server opened a session. */
  verifyOtp: (destination: string, code: string) => Promise<OtpResult>;
  /** One-click demo account; available while the server runs outside production. */
  demoLogin: () => Promise<OtpResult>;
  /** Drops the signed-in user after the server reports the session is gone. */
  sessionExpired: () => void;
  logout: () => void;
  createBooking: (bookingData: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    city: string;
    imageUrl: string;
    tierId: string;
    tierName: string;
    quantity: number;
    totalAmount: number;
    attendeeName: string;
    attendeePhone: string;
    attendeeEmail: string;
    paymentMethod: string;
    selectedSeats?: string[];
    seatLabels?: string[];
  }) => Booking;
  cancelBooking: (bookingId: string) => void;
  /** Tickets the signed-in user holds in confirmed bookings for one event. */
  ticketsBookedFor: (eventId: string) => number;
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

const BOOKINGS_STORAGE_KEY = 'sms_user_bookings';

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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // The server session (HttpOnly cookie) is the source of truth; restore it via /api/auth/me.
  useEffect(() => {
    let isMounted = true;
    try {
      const savedBookings = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      if (savedBookings) {
        setBookings(JSON.parse(savedBookings));
      }
    } catch (e) {
      console.error('Error loading stored bookings:', e);
    }

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

  const requestOtp = async (destination: string): Promise<OtpResult & { demoCode?: string }> => {
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination })
      });
      if (!res.ok) return { ok: false, error: await authErrorOf(res) };
      const data: { demoCode?: string } = await res.json();
      return { ok: true, demoCode: data.demoCode };
    } catch {
      return { ok: false, error: OFFLINE_ERROR };
    }
  };

  const verifyOtp = (destination: string, code: string) => signIn('/api/auth/otp/verify', { destination, code });
  const demoLogin = () => signIn('/api/auth/demo-login', { role: 'CUSTOMER' });
  const sessionExpired = () => setUser(null);

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  const createBooking = (bookingData: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    city: string;
    imageUrl: string;
    tierId: string;
    tierName: string;
    quantity: number;
    totalAmount: number;
    attendeeName: string;
    attendeePhone: string;
    attendeeEmail: string;
    paymentMethod: string;
    selectedSeats?: string[];
    seatLabels?: string[];
  }): Booking => {
    const bookingCode = `SMS-${Math.floor(100000 + Math.random() * 900000)}`;

    const newBooking: Booking = {
      id: `bk_${Date.now()}`,
      ...bookingData,
      userId: user?.id,
      bookingCode,
      purchasedAt: new Date().toISOString(),
      status: 'confirmed'
    };

    const updatedBookings = [newBooking, ...bookings];
    setBookings(updatedBookings);
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updatedBookings));

    // Update seat map status to permanently 'sold' for confirmed seats
    if (bookingData.selectedSeats && bookingData.selectedSeats.length > 0) {
      try {
        const storageKey = `sms_event_seats_${bookingData.eventId}`;
        const existing = localStorage.getItem(storageKey);
        if (existing) {
          const parsedSeats = JSON.parse(existing);
          const updatedSeats = parsedSeats.map((s: { id: string; status: string }) =>
            bookingData.selectedSeats?.includes(s.id) ? { ...s, status: 'sold' } : s
          );
          localStorage.setItem(storageKey, JSON.stringify(updatedSeats));
        }
      } catch (err) {
        console.error('Failed to update seat status upon booking:', err);
      }
    }

    return newBooking;
  };

  const cancelBooking = (bookingId: string) => {
    const updated = bookings.map(b => (b.id === bookingId ? { ...b, status: 'cancelled' as const } : b));
    setBookings(updated);
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
  };

  const ticketsBookedFor = (eventId: string) => {
    if (!user) return 0;
    return bookings
      .filter(b => b.eventId === eventId && b.status === 'confirmed' && b.userId === user.id)
      .reduce((sum, b) => sum + b.quantity, 0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        bookings,
        requestOtp,
        verifyOtp,
        demoLogin,
        sessionExpired,
        logout,
        createBooking,
        cancelBooking,
        ticketsBookedFor
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
