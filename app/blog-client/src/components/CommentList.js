// [added for E2E project] Comments for one post: list, add, delete own.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { errorMessage } from '../services/auth';

const CommentList = ({ postId, user }) => {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    API.get(`/comments/${postId}`)
      .then((res) => setComments(res.data))
      .catch((err) => setError(errorMessage(err, 'Could not load comments')));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await API.post('/comments', { postId, text });
      setText('');
      load();
    } catch (err) {
      setError(errorMessage(err, 'Could not add the comment'));
    }
  };

  const handleDelete = async (commentId) => {
    setError('');
    try {
      await API.delete(`/comments/${commentId}`);
      load();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the comment'));
    }
  };

  return (
    <section className="comments" data-testid="comments">
      <h3>Comments ({comments.length})</h3>
      {error && <p className="error" role="alert" data-testid="comment-error">{error}</p>}
      <ul>
        {comments.map((c) => (
          <li key={c._id} data-testid="comment">
            <strong>{c.author?.username || 'unknown'}</strong>: <span>{c.text}</span>
            {user && c.author?._id === user.id && (
              <button
                type="button"
                className="link-button"
                onClick={() => handleDelete(c._id)}
                data-testid="comment-delete"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {user ? (
        <form onSubmit={handleAdd} data-testid="comment-form">
          <textarea
            name="text"
            aria-label="Comment"
            placeholder="Write a comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <button type="submit">Add comment</button>
        </form>
      ) : (
        <p><Link to="/login">Log in</Link> to comment.</p>
      )}
    </section>
  );
};

export default CommentList;
