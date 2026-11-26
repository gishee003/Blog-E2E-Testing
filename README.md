# Blog E2E Testing — CSE731 Software Testing, Final Project

End-to-end functional testing of a MERN (MongoDB, Express, React, Node.js) blog
application with **Playwright**, across Chromium, Firefox and WebKit.
Negative and edge cases use **session-data based testing**: the client's
session (a JWT in `localStorage`) is removed, tampered with, forged, expired,
swapped between users or replayed. Each test then checks the server's answer,
the client's reaction and the database.

## Repository layout

```
blog-e2e-testing/
├── app/                  Application under test
│   ├── server.js, app.js   Express API (port 5000)
│   ├── controllers/ models/ routes/ middleware/ config/
│   └── blog-client/        React front end (Create React App, port 3000)
├── docs/report/          Project report (LaTeX source + figures)
└── e2e-tests/            Playwright test project
    ├── playwright.config.js
    ├── tests/
    │   ├── 01-auth.spec.js        registration, login, logout
    │   ├── 02-posts.spec.js       create/edit/delete posts, comments, full journey
    │   ├── 03-session.spec.js     session-data based tests
    │   ├── 04-network.spec.js     network failures (aborted, offline, slow, 5xx)
    │   ├── 05-validation.spec.js  form validation and edge cases
    │   └── api/server-checks.spec.js  server-side validation and access control
    └── utils/             DB access, API shortcuts, token helpers, global setup
```

## Application credits

The application is the open-source project
[apirollijr/blog](https://github.com/apirollijr/blog) (commit `5928eab`,
package licence ISC), copied into `app/`.

Upstream, the back end is complete, but four front-end files are empty:
`pages/Post.js`, `components/PostForm.js`, `components/CommentList.js` and
`components/PostList.js`. Without them the UI can't create or edit posts or
show comments. To make end-to-end workflows possible, we added the missing UI,
and every added or changed file is marked `[added for E2E project]`:

| File | Change |
|---|---|
| `blog-client/src/pages/Post.js` | post page with author-only Edit/Delete and comments |
| `blog-client/src/components/PostForm.js` | create / edit post form |
| `blog-client/src/components/CommentList.js` | list, add and delete comments |
| `blog-client/src/components/Navbar.js` | navigation, logout (new file) |
| `blog-client/src/components/RequireAuth.js` | client-side route guard (new file) |
| `blog-client/src/services/auth.js` | session helpers (new file) |
| `blog-client/src/services/api.js` | sends the JWT; clears it on 401 |
| `blog-client/src/App.js`, `styles.css` | routes and minimal styling |

**The back end and the original Home, Login and Register pages are unchanged**,
so every defect reported against them is in the upstream code.
`components/PostList.js` is still empty upstream and is not used.

## Prerequisites

- Node.js 18+ (developed with Node 22.15) and npm
- MongoDB running locally on `mongodb://127.0.0.1:27017`
  (or set `E2E_MONGO_URI`, see below)

## Install

```bash
# Application
cd app
npm install
cp .env.example .env          # then set JWT_SECRET to a long random string
cd blog-client
npm install

# Tests
cd ../../e2e-tests
npm install
npx playwright install        # downloads Chromium, Firefox and WebKit
```

## Run the application (manual use)

```bash
cd app
npm run dev                   # API on :5000 and React on :3000
```

## Run the tests

You don't need to start anything first. Playwright builds the React app,
serves it on port 3000, and starts the API on port 5000 against a separate
database called **`blog_e2e`**, so your development data is never touched. The
test database is emptied at the start of every run.

```bash
cd e2e-tests
npx playwright test                    # everything: 3 browsers + API project
npx playwright test --project=chromium # one browser
npx playwright test tests/03-session.spec.js
npx playwright show-report             # HTML report with traces, screenshots, videos
```

Results are also written to `e2e-tests/test-results/results.json`.

| Variable | Default | Purpose |
|---|---|---|
| `E2E_MONGO_URI` | `mongodb://127.0.0.1:27017/blog_e2e` | test database |
| `E2E_JWT_SECRET` | `e2e-test-secret-do-not-use-in-prod` | secret given to the API under test; tests use it to sign expired tokens and tokens for deleted users |

If ports 3000 or 5000 are already in use by your own running copy of the app,
Playwright reuses it. Stop it first, because it won't be using the test
database or the test secret.

## Note on failing tests

Some tests fail **on purpose**: they assert the correct behaviour and so
expose defects in the application (for example, deleting a post returns
`500 post.remove is not a function`). Each failing test maps to an entry in the
bug report. We didn't fix the application, so the results show its real state.
