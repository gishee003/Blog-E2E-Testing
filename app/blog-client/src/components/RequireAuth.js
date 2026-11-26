// [added for E2E project] Client-side guard: pages that need a login redirect
// to /login when no token is stored. The server still enforces auth on its own.
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../services/auth';

const RequireAuth = ({ children }) => {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default RequireAuth;
