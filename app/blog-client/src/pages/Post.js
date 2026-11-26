// [added for E2E project] Single post page: content, author actions, comments.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API from '../services/api';
import { errorMessage, useCurrentUser } from '../services/auth';
import CommentList from '../components/CommentList';

const Post = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get(`/posts/${id}`)
      .then((res) => setPost(res.data))
      .catch((err) => setError(errorMessage(err, 'Could not load the post')));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    setError('');
    try {
      await API.delete(`/posts/${id}`);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the post'));
    }
  };

  if (!post) {
    return error ? <p className="error" role="alert" data-testid="post-error">{error}</p> : <p>Loading…</p>;
  }

  const isAuthor = user && post.author?._id === user.id;

  return (
    <article className="card" data-testid="post">
      <h1 data-testid="post-title">{post.title}</h1>
      <p className="meta">by <span data-testid="post-author">{post.author?.username || 'unknown'}</span></p>
      <p className="post-body" data-testid="post-body">{post.body}</p>
      {error && <p className="error" role="alert" data-testid="post-error">{error}</p>}
      {isAuthor && (
        <div className="actions">
          <Link to={`/posts/${id}/edit`} data-testid="post-edit">Edit</Link>
          <button type="button" onClick={handleDelete} data-testid="post-delete">Delete</button>
        </div>
      )}
      <CommentList postId={id} user={user} />
    </article>
  );
};

export default Post;
