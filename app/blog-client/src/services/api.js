import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// [added for E2E project] Attach the JWT kept in localStorage to every request.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// [added for E2E project] If the server rejects a token we sent (expired,
// tampered, user gone), drop it and send the user back to the login page.
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const sentToken = Boolean(err.config?.headers?.Authorization);
    if (err.response?.status === 401 && sentToken) {
      localStorage.removeItem('token');
      window.location.assign('/login?session=expired');
    }
    return Promise.reject(err);
  }
);

export default API;
