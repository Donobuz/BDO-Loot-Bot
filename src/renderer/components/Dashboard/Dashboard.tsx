import React, { useEffect, useState, useCallback } from "react";
import { UserWithPreferences, UserPreferences } from "../../types";
import {
  getDiscordAvatarUrl,
  getDefaultAvatarSvg,
} from "../../utils/avatarUtils";
import { UserSettingsModal } from "../UserSettingsModal";
import { SessionControl } from "../SessionControl";
import { DEFAULT_REGION } from "../../constants/regions";
import AdminDashboard from "../AdminDashboard";
import "./Dashboard.css";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [user, setUser] = useState<UserWithPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsFocusSection, setSettingsFocusSection] = useState<
    "ocr" | null
  >(null);
  const [updatingPreferences, setUpdatingPreferences] = useState(false);

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user data with permissions from main process
      const userData = await window.electronAPI.getCurrentUser();

      if (userData) {
        // Get or create user preferences
        const preferencesResult =
          await window.electronAPI.userPreferences.getOrCreate(userData.id, {
            preferred_region: DEFAULT_REGION,
            display_regions: [DEFAULT_REGION],
          });

        if (preferencesResult.success) {
          const userWithPreferences: UserWithPreferences = {
            ...userData,
            preferences: preferencesResult.data,
          };
          setUser(userWithPreferences);
        } else {
          setUser(userData);
        }
      } else {
        setError("No user data found");
      }
    } catch (err) {
      console.error("Error loading user data:", err);
      setError("Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleLogout = async () => {
    try {
      await window.electronAPI.logout();
      onLogout();
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const handleSaveSettings = async (preferences: Partial<UserPreferences>) => {
    if (!user || updatingPreferences) return;
    try {
      setUpdatingPreferences(true);
      // Update user preferences in database
      const result = await window.electronAPI.userPreferences.update(
        user.id,
        preferences
      );
      if (result.success) {
        // Update local user state
        setUser((prev) =>
          prev
            ? {
                ...prev,
                preferences: {
                  ...prev.preferences!,
                  ...preferences,
                },
              }
            : null
        );
      } else {
        console.error("Failed to update user preferences:", result.error);
      }
    } catch (err) {
      console.error("Error updating user preferences:", err);
    } finally {
      setUpdatingPreferences(false);
    }
  };

  const handleShowAdmin = () => {
    setShowAdminDashboard(true);
  };

  const handleBackFromAdmin = () => {
    setShowAdminDashboard(false);
  };

  // Show admin dashboard if requested
  if (showAdminDashboard && user) {
    return <AdminDashboard user={user} onBack={handleBackFromAdmin} />;
  }

  if (loading) {
    return (
      <div className='dashboard'>
        <div className='dashboard-loading'>
          <div className='loading-spinner'></div>
          <p>Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='dashboard'>
        <div className='dashboard-error'>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadUserData} className='retry-button'>
            Retry
          </button>
          <button onClick={handleLogout} className='logout-button'>
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className='dashboard'>
        <div className='dashboard-error'>
          <h2>No User Data</h2>
          <p>Unable to load user information</p>
          <button onClick={handleLogout} className='logout-button'>
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Check if user has admin permissions
  const isAdmin = user?.permissions?.includes("admin") || false;

  return (
    <div className='dashboard'>
      <header className='dashboard-header'>
        <div className='dashboard-header-content'>
          <div className='user-info'>
            <div className='avatar-container'>
              <img
                src={getDiscordAvatarUrl(user.discord_id, user.avatar)}
                alt={`${user.username}'s avatar`}
                className='user-avatar'
                onError={(e) => {
                  // Fallback to custom default avatar if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.src = getDefaultAvatarSvg();
                }}
              />
              <div className='online-indicator'></div>
            </div>
            <div className='user-details'>
              <h2 className='username'>{user.username}</h2>
              <p className='user-id'>Discord ID: {user.discord_id}</p>
              <p className='member-since'>
                Member since: {new Date(user.created).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className='header-actions'>
            <button
              onClick={() => {
                setSettingsFocusSection(null);
                setShowSettingsModal(true);
              }}
              className='settings-button'
              title='User Settings'
            >
              ⚙️
            </button>
            {isAdmin && (
              <button onClick={handleShowAdmin} className='admin-button'>
                Admin Panel
              </button>
            )}
            <button onClick={handleLogout} className='logout-button'>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className='dashboard-content'>
        <div className='welcome-section'>
          <h1>BDO Loot Ledger</h1>
          <p>Automatically track your drops during a grind session</p>
        </div>

        <div className='main-session-area'>
          {user?.preferences && (
            <SessionControl
              userPreferences={user.preferences}
              onOpenSettings={() => {
                setSettingsFocusSection("ocr");
                setShowSettingsModal(true);
              }}
            />
          )}
        </div>
      </main>

      {/* User Settings Modal */}
      {user?.preferences && (
        <UserSettingsModal
          isOpen={showSettingsModal}
          onClose={() => {
            setShowSettingsModal(false);
            setSettingsFocusSection(null);
          }}
          currentPreferences={user.preferences}
          onSave={handleSaveSettings}
          isLoading={updatingPreferences}
          focusSection={settingsFocusSection}
        />
      )}
    </div>
  );
}
