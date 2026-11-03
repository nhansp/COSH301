import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FeatureProvider } from './context/FeatureContext';
import { EventProvider } from './context/EventContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NavigationProgressBar } from './components/NavigationProgressBar';
import { ScrollToTopOnNavigate } from './components/ScrollToTopOnNavigate';
import { HomePage } from './pages/HomePage';
import { EventDetailPage } from './pages/EventDetailPage';
import { LoginPage } from './pages/LoginPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { OrganizerPage } from './pages/OrganizerPage';

function AnimatedAppRoutes() {
  const location = useLocation();

  return (
    <>
      {/* Visual route navigation progress bar & scroll reset */}
      <NavigationProgressBar />
      <ScrollToTopOnNavigate />

      {/* Smooth page transition animations */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{
            duration: 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex-1 flex flex-col w-full min-h-screen"
        >
          <Routes location={location}>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/event/:id" element={<EventDetailPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
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

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <FeatureProvider>
          <AuthProvider>
            <EventProvider>
              <AnimatedAppRoutes />
            </EventProvider>
          </AuthProvider>
        </FeatureProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
