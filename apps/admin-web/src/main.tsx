import { QuotePlaylistsPage } from './pages/QuotePlaylistsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DisplayThemesPage } from './pages/DisplayThemesPage';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './style.css';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MosqueSettingsPage } from './pages/MosqueSettingsPage';
import { PrayerSettingsPage } from './pages/PrayerSettingsPage';
import { AgendaPage } from './pages/AgendaPage';
import { ContentPage } from './pages/ContentPage';
import { AudioLibraryPage } from './pages/AudioLibraryPage';
import { AudioSchedulePage } from './pages/AudioSchedulePage';
import { PlayersPage } from './pages/PlayersPage';
import { HistoryPage } from './pages/HistoryPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/audio-schedule-public" element={<AudioSchedulePage publicMode />} />
          <Route path="/quote-playlists-public" element={<QuotePlaylistsPage publicMode />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/mosque" element={<MosqueSettingsPage />} />
            <Route path="/prayer-settings" element={<PrayerSettingsPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/content" element={<ContentPage />} />
            <Route path="/audio" element={<AudioLibraryPage />} />
            <Route path="/quote-playlists" element={<QuotePlaylistsPage />} />
            <Route path="/audio-schedule" element={<AudioSchedulePage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/display-themes" element={<DisplayThemesPage />} /><Route path="/history" element={<HistoryPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

