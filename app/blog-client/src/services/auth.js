// [added for E2E project] Session helpers and the current-user hook.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import API from './api';

export const getToken = () => localStorage.getItem('token');

export const logout = () => {
  localStorage.removeItem('token');
};

// Asks the server who the token belongs to. Re-checks whenever the route changes,
// so logging in or out is picked up without a page reload.
export const useCurrentUser = () => {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!getToken()) {
      setUser(null);
      setChecked(true);
      return undefined;
    }
    API.get('/users/me')
      .then((res) => !cancelled && setUser(res.data))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return { user, checked };
};

// Turns an axios error into a message for the page.
export const errorMessage = (err, fallback) => {
  if (!err.response) return 'Network error: could not reach the server. Please try again.';
  return err.response.data?.message || fallback;
};
