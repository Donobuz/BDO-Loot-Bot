import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { getDiscordAvatarUrl, getDefaultAvatarSvg } from '../../utils/avatarUtils';
import './Dashboard.css';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get user data from main process
      const userData = await window.electronAPI.getCurrentUser();
      
      if (userData) {
        setUser(userData);
      } else {
        setError('No user data found');
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI.logout();
      onLogout();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadUserData} className="retry-button">
            Retry
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard">
        <div className="dashboard-error">
          <h2>No User Data</h2>
          <p>Unable to load user information</p>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="user-info">
          <div className="avatar-container">
            <img 
              src={getDiscordAvatarUrl(user.discord_id, user.avatar)} 
              alt={`${user.username}'s avatar`}
              className="user-avatar"
              onError={(e) => {
                // Fallback to custom default avatar if image fails to load
                const target = e.target as HTMLImageElement;
                target.src = getDefaultAvatarSvg();
              }}
            />
            <div className="online-indicator"></div>
          </div>
          <div className="user-details">
            <h2 className="username">{user.username}</h2>
            <p className="user-id">Discord ID: {user.discord_id}</p>
            <p className="member-since">
              Member since: {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome to BDO Loot Ledger</h1>
          <p>Track your grinding sessions, loot drops, and profits!</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h3>Active Session</h3>
            <p>No active grinding session</p>
            <button className="primary-button">Start New Session</button>
          </div>

          <div className="dashboard-card">
            <h3>Recent Sessions</h3>
            <p>Loading session history...</p>
          </div>

          <div className="dashboard-card">
            <h3>Statistics</h3>
            <p>Loading statistics...</p>
          </div>

          <div className="dashboard-card">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              <button className="action-button">View Locations</button>
              <button className="action-button">Browse Items</button>
              <button className="action-button">Session History</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
