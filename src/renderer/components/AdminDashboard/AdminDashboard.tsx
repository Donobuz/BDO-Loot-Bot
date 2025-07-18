import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { getDiscordAvatarUrl, getDefaultAvatarSvg } from '../../utils/avatarUtils';
import { LocationManagement } from './LocationManagement';
import { ItemManagement } from './ItemManagement';
import '../../globals.css';
import './AdminDashboard.css';

interface AdminDashboardProps {
  user: User;
  onBack: () => void;
}

export default function AdminDashboard({ user, onBack }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'manage-locations' | 'manage-items'>('dashboard');

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Load admin-specific data here
      // For now, just simulate loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load admin dashboard data
    loadAdminData();
  }, [loadAdminData]);

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="admin-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadAdminData} className="retry-button">
            Retry
          </button>
          <button onClick={onBack} className="back-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
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
              <p className="user-role">Administrator</p>
              <p className="user-id">Discord ID: {user.discord_id}</p>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={onBack} className="back-button">
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="admin-content">
        {currentView === 'dashboard' && (
          <>
            <div className="welcome-section">
              <h1>Admin Dashboard</h1>
              <p>Manage users, system settings, and monitor application health.</p>
            </div>
            
            <div className="admin-grid">
              <div className="admin-card">
                <h3>User Management</h3>
                <p>Manage user permissions and access control</p>
                <button className="admin-action-button">Manage Users</button>
              </div>

              <div className="admin-card">
                <h3>System Settings</h3>
                <p>Configure application settings and preferences</p>
                <button className="admin-action-button">System Config</button>
              </div>

              <div className="admin-card">
                <h3>Data Management</h3>
                <p>Manage locations, items, and loot tables</p>
                <div className="admin-card-buttons">
                  <button 
                    onClick={() => setCurrentView('manage-locations')}
                    className="admin-action-button"
                  >
                    Manage Locations
                  </button>
                  <button 
                    onClick={() => setCurrentView('manage-items')}
                    className="admin-action-button"
                  >
                    Manage Items
                  </button>
                </div>
              </div>

              <div className="admin-card">
                <h3>Analytics</h3>
                <p>View system usage statistics and reports</p>
                <button className="admin-action-button">View Analytics</button>
              </div>

              <div className="admin-card">
                <h3>Logs & Monitoring</h3>
                <p>Monitor system health and view logs</p>
                <button className="admin-action-button">View Logs</button>
              </div>

              <div className="admin-card">
                <h3>Backup & Maintenance</h3>
                <p>Database backups and system maintenance</p>
                <button className="admin-action-button">Maintenance</button>
              </div>
            </div>
          </>
        )}

        {currentView === 'manage-locations' && (
          <div className="admin-section">
            <div className="section-header">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="back-section-button"
              >
                ← Back to Dashboard
              </button>
            </div>
            <LocationManagement />
          </div>
        )}

        {currentView === 'manage-items' && (
          <div className="admin-section">
            <div className="section-header">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="back-section-button"
              >
                ← Back to Dashboard
              </button>
            </div>
            <ItemManagement />
          </div>
        )}
      </main>
    </div>
  );
}