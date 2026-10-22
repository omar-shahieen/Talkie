import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
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

  return route ? <Redirect to={route} /> : null;
}

function RootEntry() {
  if (!getAccessToken()) {
    return <Redirect to="/login" />;
  }

  return <DefaultRedirect />;
}

const AppRouteProvider = () => {
  return (
    <Router>
      <Switch>
        <Route path="/reset-password/:path?">
          <Switch>
            <Route
              path="/reset-password/"
              component={ResetPasswordView}
              exact
            />

            <Route path="*" component={NotFoundView}></Route>
          </Switch>
        </Route>

        <Route path="/oauth" component={OAuthCallbackView} exact />

        <Route path="/login" component={LoginView} exact />

        <Route path="/" component={RootEntry} exact />

        <Route
          path="/servers/:path?"
          render={() =>
            !getAccessToken() ? (
              <Redirect to="/login" />
            ) : (
              <Switch>
                <AppMainLayout>
                  <Route
                    path="/servers/:serverId/channels/:channelId"
                    component={IndexView}
                    exact
                  />
                </AppMainLayout>

                <Route path="*" component={NotFoundView} />
              </Switch>
            )
          }
        />

        <Route
          path="/settings/:path?"
          render={() =>
            !getAccessToken() ? (
              <Redirect to="/login" />
            ) : (
              <Switch>
                <SettingsLayout>
                  <Route path="/settings/" component={SettingsView} exact />
                  <Route
                    path="/settings/admin"
                    render={() =>
                      hasAdminRole() ? (
                        <AdminManagementView />
                      ) : (
                        <Redirect to="/settings/" />
                      )
                    }
                    exact
                  />
                </SettingsLayout>

                <Route path="*" component={NotFoundView} />
              </Switch>
            )
          }
        />

        <Route path="*" component={NotFoundView}></Route>
      </Switch>
    </Router>
  );
};

export default AppRouteProvider;
