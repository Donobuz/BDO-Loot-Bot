import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { ModalProvider, useModal } from './contexts/ModalContext';
import { ModalRenderer } from './components/Modal/Modal';
import './types'; // Import global types
import './globals.css';
import './App.css';

const AppContent: React.FC = () => {
  const { modals } = useModal();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authData = await window.electronAPI.checkAuthStatus();
      setIsLoggedIn(authData.isLoggedIn);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-content">
          <div className="app-loading-spinner"></div>
          <p className="app-loading-text">Loading BDO Loot Ledger...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <ModalRenderer modals={modals} />
      </>
    );
  }

  return (
    <>
      <Dashboard onLogout={handleLogout} />
      <ModalRenderer modals={modals} />
    </>
  );
};

export default function App() {
  return (
    <ModalProvider>
      <AppContent />
    </ModalProvider>
  );
}
