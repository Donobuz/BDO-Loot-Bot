import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import './AdminDashboard.css';

interface AdminDashboardProps {
  user: User;
  onBack: () => void;
}

export default function AdminDashboard({ user, onBack }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'manage-locations'>('dashboard');

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
          <button onClick={onBack} className="back-button">
            ← Back to Dashboard
          </button>
          <h1>Admin Dashboard</h1>
          <div className="admin-user-info">
            <span>Welcome, {user.username}</span>
          </div>
        </div>
      </header>

      <main className="admin-content">
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
            <button 
              onClick={() => setCurrentView('manage-locations')}
              className="admin-action-button"
            >
              Manage Locations
            </button>
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
      </main>
    </div>
  );
}