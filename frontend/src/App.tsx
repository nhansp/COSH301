import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FeatureProvider } from './context/FeatureContext';
import { EventProvider } from './context/EventContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { EventDetailPage } from './pages/EventDetailPage';
import { LoginPage } from './pages/LoginPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { OrganizerPage } from './pages/OrganizerPage';
import { PricingPage } from './pages/PricingPage';
import { OrganizerEventPage } from './pages/OrganizerEventPage';
import { TicketSelectionPage } from './pages/TicketSelectionPage';

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
                path="/organizer/events/:id"
                element={
                  <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                    <OrganizerEventPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizer/events/:id/pricing"
                element={
                  <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                    <PricingPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </EventProvider>
        </AuthProvider>
        </FeatureProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
