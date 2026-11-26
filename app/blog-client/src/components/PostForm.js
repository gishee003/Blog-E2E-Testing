// [added for E2E project] Create a post (mode="create") or edit one (mode="edit").
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../services/api';
import { errorMessage } from '../services/auth';

const PostForm = ({ mode }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', body: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = mode === 'edit';
  // In edit mode the fields stay disabled until the post has loaded, so a late
  // response can't overwrite what the user has already typed.
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit) return;
    API.get(`/posts/${id}`)
      .then((res) => {
        setForm({ title: res.data.title, body: res.data.body });
        setLoaded(true);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load the post')));
  }, [id, isEdit]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = isEdit
        ? await API.put(`/posts/${id}`, form)
        : await API.post('/posts', form);
      navigate(`/posts/${res.data._id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the post'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" data-testid="post-form">
      <h2>{isEdit ? 'Edit post' : 'New post'}</h2>
      <label htmlFor="title">Title</label>
      <input
        id="title"
        name="title"
        value={form.title}
        onChange={handleChange}
        maxLength={150}
        required
        disabled={!loaded}
      />
      <label htmlFor="body">Body</label>
      <textarea
        id="body"
        name="body"
        rows={8}
        value={form.body}
        onChange={handleChange}
        required
        disabled={!loaded}
      />
      {error && <p className="error" role="alert" data-testid="form-error">{error}</p>}
      <button type="submit" disabled={saving || !loaded}>
        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Publish'}
      </button>
    </form>
  );
};

export default PostForm;
