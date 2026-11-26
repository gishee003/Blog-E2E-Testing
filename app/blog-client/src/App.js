import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Post from './pages/Post';
// [added for E2E project] navigation, protected routes, create/edit post
import Navbar from './components/Navbar';
import RequireAuth from './components/RequireAuth';
import PostForm from './components/PostForm';
import './styles.css';

function App() {
  return (
    <Router>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/posts/new"
            element={<RequireAuth><PostForm mode="create" /></RequireAuth>}
          />
          <Route path="/posts/:id" element={<Post />} />
          <Route
            path="/posts/:id/edit"
            element={<RequireAuth><PostForm mode="edit" /></RequireAuth>}
          />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
