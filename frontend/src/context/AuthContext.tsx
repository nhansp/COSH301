import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Booking } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bookings: Booking[];
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
  cancelBooking: (bookingId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'sms_auth_user';
const BOOKINGS_STORAGE_KEY = 'sms_user_bookings';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session from localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      const savedBookings = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      if (savedBookings) {
        setBookings(JSON.parse(savedBookings));
      }
    } catch (e) {
      console.error('Error loading stored auth state:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save changes to localStorage
  const saveUserSession = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  const sendPhoneOtp = async (phoneNumber: string) => {
    // Simulate real SMS gateway / Firebase Phone Auth verifyPhoneNumber with reCAPTCHA
    await new Promise(resolve => setTimeout(resolve, 800));
    // Provide a deterministic demo code (123456) for instant verification
    const demoCode = '123456';
    return {
      success: true,
      demoCode,
      message: `Mã OTP đã được gửi đến số ${phoneNumber}. Mã thử nghiệm là ${demoCode}`
    };
  };

  const verifyPhoneOtp = async (phoneNumber: string, code: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    // Accepts 123456 or any 6-digit code for testing convenience
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
    await new Promise(resolve => setTimeout(resolve, 800));
    const demoCode = '123456';
    return {
      success: true,
      demoCode,
      message: `Mã xác thực đã được gửi về email ${email}. Mã thử nghiệm là ${demoCode}`
    };
  };

  const verifyEmailOtp = async (email: string, code: string): Promise<boolean> => {
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

  const cancelBooking = (bookingId: string) => {
    const updated = bookings.map(b => (b.id === bookingId ? { ...b, status: 'cancelled' as const } : b));
    setBookings(updated);
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        bookings,
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
