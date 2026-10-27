import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import AppMainLayout from '../ui/layouts/MainLayout';
import SettingsLayout from '../ui/layouts/SettingsLayout';
import IndexView from '../ui/views/IndexView';
import NotFoundView from '../ui/views/NotFoundView';
import OAuthCallbackView from '../ui/views/OAuthCallbackView';
import SettingsView from '../ui/views/SettingsView';
import ResetPasswordView from '../ui/views/ResetPasswordView';
import AdminManagementView from '../ui/views/AdminManagementView';
import LoginView from '../ui/views/LoginView';
import { getAccessToken } from '../app/authStorage';
import { resolveDefaultRedirectRoute } from './defaultRoute';

function hasAdminRole() {
  try {
    const value = localStorage.getItem('user');
    if (!value) {
      return false;
    }

    const user = JSON.parse(value);
    return user?.appRole === 'admin';
  } catch {
    return false;
  }
}

function DefaultRedirect() {
  const [route, setRoute] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    resolveDefaultRedirectRoute().then((nextRoute) => {
      if (isMounted) {
        setRoute(nextRoute);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return route ? <Navigate to={route} replace /> : null;
}

function RootEntry() {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }

  return <DefaultRedirect />;
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }: { children: React.ReactElement }) {
  if (!hasAdminRole()) {
    return <Navigate to="/settings" replace />;
  }
  return children;
}

const AppRouteProvider = () => {
  return (
    <Router>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordView />} />
        <Route path="/oauth" element={<OAuthCallbackView />} />
        <Route path="/login" element={<LoginView />} />
        <Route path="/" element={<RootEntry />} />

        <Route
          path="/servers/:serverId/channels/:channelId"
          element={
            <ProtectedRoute>
              <AppMainLayout>
                <IndexView />
              </AppMainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsLayout>
                <SettingsView />
              </SettingsLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/admin"
          element={
            <ProtectedRoute>
              <SettingsLayout>
                <AdminRoute>
                  <AdminManagementView />
                </AdminRoute>
              </SettingsLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundView />} />
      </Routes>
    </Router>
  );
};

export default AppRouteProvider;
