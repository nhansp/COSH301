import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FeatureProvider } from './context/FeatureContext';
import { EventProvider } from './context/EventContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AssistantWidget } from './components/assistant/AssistantWidget';
import { HomePage } from './pages/HomePage';
import { EventDetailPage } from './pages/EventDetailPage';
import { LoginPage } from './pages/LoginPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { OrganizerPage } from './pages/OrganizerPage';
import { PaymentReturnPage } from './pages/PaymentReturnPage';
import { TicketSelectionPage } from './pages/TicketSelectionPage';
import { SurveyPage } from './pages/SurveyPage';
import { GatePage } from './pages/GatePage';
import { SeatMonitorPage } from './pages/SeatMonitorPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <FeatureProvider>
        <AuthProvider>
          <EventProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/event/:id" element={<EventDetailPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/events/:id/tickets" element={<TicketSelectionPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/khao-sat" element={<SurveyPage />} />
              {/* VNPay sends the browser here; the page only shows what the server recorded. */}
              <Route path="/payment/vnpay/return" element={<PaymentReturnPage />} />
  
              {/* Protected Routes requiring Authentication */}
              <Route
                path="/checkout/:eventId"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-tickets"
                element={
                  <ProtectedRoute>
                    <MyTicketsPage />
                  </ProtectedRoute>
                }
              />
  
              <Route
                path="/organizer"
                element={
                  <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                    <OrganizerPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/soat-ve"
                element={
                  <ProtectedRoute roles={['GATE_STAFF', 'ORGANIZER', 'ADMIN']}>
                    <GatePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/giam-sat-ghe"
                element={
                  <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                    <SeatMonitorPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <AssistantWidget />
          </EventProvider>
        </AuthProvider>
        </FeatureProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
