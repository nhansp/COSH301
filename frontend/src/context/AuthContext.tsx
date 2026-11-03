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
  }) => Booking;
  cancelBooking: (bookingId: string, reason?: string) => Promise<boolean>;
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

  const loginDemo = async (role: UserRole = 'CUSTOMER'): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        saveUserSession(userFromApi(data.user));
        return true;
      }
    } catch (e) {
      console.error('Demo login API failed, using fallback:', e);
    }

    const fallbackUser: User = {
      id: `usr_demo_${Date.now()}`,
      name: role === 'ORGANIZER' ? 'Ban Tổ chức' : 'Khán giả Demo',
      email: role === 'ORGANIZER' ? 'btc@cosh301.nhansp.id.vn' : 'khangia.demo@sortmyscene.live',
      avatar: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=demo`,
      authProvider: 'email',
      role: role,
      createdAt: new Date().toISOString()
    };
    saveUserSession(fallbackUser);
    return true;
  };

  const sendPhoneOtp = async (phoneNumber: string) => {
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ destination: phoneNumber, channel: 'SMS' }),
      });
      if (res.ok) {
        const data = await res.json();
        const demoCode = data.demoCode || data.mock_code || '123456';
        return {
          success: true,
          demoCode,
          message: `Mã OTP đã được gửi đến số ${phoneNumber}. Mã thử nghiệm là ${demoCode}`
        };
      }
    } catch {
      // API unreachable, use local simulation
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    const demoCode = '123456';
    return {
      success: true,
      demoCode,
      message: `Mã OTP đã được gửi đến số ${phoneNumber}. Mã thử nghiệm là ${demoCode}`
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
      if (res.ok) {
        const data = await res.json();
        saveUserSession(userFromApi(data.user));
        return true;
      }
    } catch {
      // Fallback to local
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    if (code.trim().length === 6) {
      const newUser: User = {
        id: `usr_${Date.now()}`,
        name: `User ${phoneNumber.slice(-4) || 'VIP'}`,
        phone: phoneNumber,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${phoneNumber}`,
        authProvider: 'phone',
        createdAt: new Date().toISOString()
      };
      saveUserSession(newUser);
      return true;
    }
    return false;
  };

  const sendEmailOtp = async (email: string) => {
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ destination: email, channel: 'EMAIL' }),
      });
      if (res.ok) {
        const data = await res.json();
        const demoCode = data.demoCode || data.mock_code || '123456';
        return {
          success: true,
          demoCode,
          message: `Mã xác thực đã được gửi về email ${email}. Mã thử nghiệm là ${demoCode}`
        };
      }
    } catch {
      // Fallback
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    const demoCode = '123456';
    return {
      success: true,
      demoCode,
      message: `Mã xác thực đã được gửi về email ${email}. Mã thử nghiệm là ${demoCode}`
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
      if (res.ok) {
        const data = await res.json();
        saveUserSession(userFromApi(data.user));
        return true;
      }
    } catch {
      // Fallback
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    if (code.trim().length === 6) {
      const namePart = email.split('@')[0];
      const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const newUser: User = {
        id: `usr_${Date.now()}`,
        name: capitalized,
        email: email,
        avatar: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${email}`,
        authProvider: 'email',
        createdAt: new Date().toISOString()
      };
      saveUserSession(newUser);
      return true;
    }
    return false;
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
  }): Booking => {
    const bookingCode = `SMS-${Math.floor(100000 + Math.random() * 900000)}`;
    const qrData = encodeURIComponent(`https://sortmyscene.live/ticket/${bookingCode}`);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}&bgcolor=1a0b2e&color=f3e8ff&margin=10`;

    const newBooking: Booking = {
      id: `bk_${Date.now()}`,
      ...bookingData,
      bookingCode,
      qrCodeUrl,
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

  const cancelBooking = async (bookingId: string, reason?: string): Promise<boolean> => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return false;

    // 1. Ghi nhận log huỷ vé vào bảng audit_logs trong database
    try {
      await fetch('/api/tickets/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          eventId: booking.eventId,
          reason: reason || 'Khách hàng xác nhận hủy vé trên ứng dụng',
          seats: booking.selectedSeats || [],
          ticketDetails: {
            eventTitle: booking.eventTitle,
            venue: booking.venue,
            tierName: booking.tierName,
            quantity: booking.quantity,
            totalAmount: booking.totalAmount,
            attendeeName: booking.attendeeName,
            attendeeEmail: booking.attendeeEmail,
          },
        }),
      });
    } catch (e) {
      console.error('Error logging cancellation to database audit_logs:', e);
    }

    // 2. Remove ticket from active bookings list
    const updated = bookings.filter(b => b.id !== bookingId);
    setBookings(updated);
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));

    // 3. Restore seats status to available in local cache
    if (booking.selectedSeats && booking.selectedSeats.length > 0) {
      try {
        const storageKey = `sms_event_seats_${booking.eventId}`;
        const existing = localStorage.getItem(storageKey);
        if (existing) {
          const parsedSeats = JSON.parse(existing);
          const restoredSeats = parsedSeats.map((s: { id: string; status: string }) =>
            booking.selectedSeats?.includes(s.id) ? { ...s, status: 'available' } : s
          );
          localStorage.setItem(storageKey, JSON.stringify(restoredSeats));
        }
      } catch (err) {
        console.error('Failed to restore seat status upon booking cancellation:', err);
      }
    }

    return true;
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
        cancelBooking
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
