// [added for E2E project]
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getToken, logout } from '../services/auth';

const Navbar = () => {
  const navigate = useNavigate();
  const loggedIn = Boolean(getToken());

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar" data-testid="navbar">
      <Link to="/" className="brand">Blog</Link>
      <div className="nav-links">
        {loggedIn ? (
          <>
            <Link to="/posts/new" data-testid="nav-new-post">New post</Link>
            <button type="button" onClick={handleLogout} data-testid="nav-logout">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" data-testid="nav-login">Login</Link>
            <Link to="/register" data-testid="nav-register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
