import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Booking } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bookings: Booking[];
  loginDemo: (role?: UserRole) => Promise<boolean>;
  sendPhoneOtp: (phoneNumber: string) => Promise<{ success: boolean; demoCode: string; message: string }>;
  verifyPhoneOtp: (phoneNumber: string, code: string) => Promise<boolean>;
  sendEmailOtp: (email: string) => Promise<{ success: boolean; demoCode: string; message: string }>;
  verifyEmailOtp: (email: string, code: string) => Promise<boolean>;
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
    currency: string;
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

    fetch('/api/auth/me', { credentials: 'include' })
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

  const saveUserSession = (newUser: User | null) => setUser(newUser);

  const otpRequestError = (code?: string) => {
    switch (code) {
      case 'otp_rate_limited':
        return 'Bạn vừa yêu cầu mã OTP. Vui lòng chờ 60 giây rồi thử lại.';
      case 'invalid_destination':
        return 'Số điện thoại hoặc địa chỉ email không hợp lệ.';
      case 'feature_disabled':
        return 'Tính năng đăng nhập OTP hiện đang tắt.';
      default:
        return 'Không thể gửi mã OTP tới máy chủ. Vui lòng thử lại.';
    }
  };

  const loginDemo = async (role: UserRole = 'CUSTOMER'): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.user) return false;
      saveUserSession(userFromApi(data.user));
      return true;
    } catch {
      return false;
    }
  };

  const sendPhoneOtp = async (phoneNumber: string) => {
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ destination: phoneNumber, channel: 'SMS' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(otpRequestError(data.error));
    }
    const demoCode: string = data.demoCode || data.mock_code || '';
    return {
      success: true,
      demoCode,
      message: demoCode
        ? `Mã OTP đã được gửi đến số ${phoneNumber}. Mã thử nghiệm là ${demoCode}`
        : `Mã OTP đã được gửi đến số ${phoneNumber}.`
    };
  };

  const verifyPhoneOtp = async (phoneNumber: string, code: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ destination: phoneNumber, code }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      saveUserSession(userFromApi(data.user));
      return true;
    } catch {
      return false;
    }
  };

  const sendEmailOtp = async (email: string) => {
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ destination: email, channel: 'EMAIL' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(otpRequestError(data.error));
    }
    const demoCode: string = data.demoCode || data.mock_code || '';
    return {
      success: true,
      demoCode,
      message: demoCode
        ? `Mã xác thực đã được gửi về email ${email}. Mã thử nghiệm là ${demoCode}`
        : `Mã xác thực đã được gửi về email ${email}.`
    };
  };

  const verifyEmailOtp = async (email: string, code: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ destination: email, code }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      saveUserSession(userFromApi(data.user));
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    try {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    } catch {}
    saveUserSession(null);
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
    currency: string;
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
    const target = bookings.find(b => b.id === bookingId);
    const updated = bookings.map(b => (b.id === bookingId ? { ...b, status: 'cancelled' as const } : b));
    setBookings(updated);
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));

    if (target) {
      fetch('/api/tickets/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookingId: target.id,
          bookingCode: target.bookingCode,
          eventId: target.eventId,
          reason: 'Khách hàng xác nhận hủy vé trên ứng dụng',
          seats: target.selectedSeats || [],
          concert: {
            id: target.eventId,
            name: target.eventTitle,
            title: target.eventTitle,
            date: target.eventDate,
            time: target.eventTime,
            venue: target.venue,
            city: target.city,
            imageUrl: target.imageUrl,
          },
          ticketDetails: {
            eventTitle: target.eventTitle,
            eventDate: target.eventDate,
            eventTime: target.eventTime,
            venue: target.venue,
            city: target.city,
            tierName: target.tierName,
            tierId: target.tierId,
            quantity: target.quantity,
            totalAmount: target.totalAmount,
            currency: target.currency,
            attendeeName: target.attendeeName,
            attendeeEmail: target.attendeeEmail,
            attendeePhone: target.attendeePhone,
            paymentMethod: target.paymentMethod,
            purchasedAt: target.purchasedAt,
          },
        }),
      }).catch(err => console.error('Failed to sync ticket cancellation with server:', err));
    }
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
        loginDemo,
        sendPhoneOtp,
        verifyPhoneOtp,
        sendEmailOtp,
        verifyEmailOtp,
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
