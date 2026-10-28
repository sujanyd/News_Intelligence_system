# News Bias and Framing Analysis System - Frontend

The frontend for the **News Bias and Framing Analysis System** is built using **React** and **Vite**. It provides a modern, responsive interface for journalists, analysts, and researchers to explore media framing patterns, ideological slants, and cross-source coverage divergence.

---

## 📁 Directory Structure

```text
frontend/
├── public/                 # Static assets and icons
├── src/
│   ├── api/                # API client configuration & request utilities
│   │   ├── client.js       # One request helper: timeouts, readable errors, JSON checks
│   │   ├── config.js       # VITE_API_BASE_URL and VITE_API_PREFIX settings
│   │   ├── newsApi.js      # Article & source calls (live or mock mode)
│   │   └── normalize.js    # Checks backend replies before pages use them
│   │
│   ├── components/         # Reusable UI components
│   │   ├── AddSourceForm.jsx  # Form to add a news source (with validation)
│   │   ├── AlertMessage.jsx   # Error / success / warning message box
│   │   ├── ArticleDetails.jsx # Details panel for one article
│   │   ├── Card.jsx        # Standardized content card container
│   │   ├── DataModeBadge.jsx  # "Mock data" or "Live API" badge
│   │   ├── DataTable.jsx   # Table that becomes cards on phones
│   │   ├── EmptyState.jsx  # Reusable empty state with icon and description
│   │   ├── Footer.jsx      # Application footer with backend indicator
│   │   ├── FormField.jsx   # Label + input + error message
│   │   ├── Header.jsx      # Top app header with breadcrumbs and mobile toggle
│   │   ├── LoadingState.jsx # Spinner with a loading message
│   │   ├── MetricCard.jsx  # Metric KPI cards with placeholder tags
│   │   ├── Navbar.jsx      # Navigation bar
│   │   ├── PageHeader.jsx  # Page title, subtitle, and action badge layout
│   │   ├── Pagination.jsx  # Previous / Next page buttons
│   │   ├── Sidebar.jsx     # Desktop sidebar and mobile slide-out drawer
│   │   └── StatusBadge.jsx # Dynamic status badges (primary, success, warning, info)
│   │
│   ├── mocks/
│   │   ├── mockApi.js      # Pretend backend (only when VITE_USE_MOCK_DATA=true, and in tests)
│   │   └── mockData.js     # Sample sources & articles for the pretend backend
│   │
│   ├── utils/
│   │   ├── formatDate.js   # Readable dates ("Not available" when missing)
│   │   └── validateSource.js # Checks for the add-source form
│   │
│   ├── pages/              # View pages corresponding to navigation tabs
│   │   ├── Dashboard.jsx   # Metrics, recent articles empty state & pipeline overview
│   │   ├── Articles.jsx    # Article table with search, source filter & pages
│   │   ├── Sources.jsx     # Source list and add-source form
│   │   ├── Comparisons.jsx # Cross-publisher framing comparison placeholder
│   │   └── Reports.jsx     # Analytical bias distribution reports placeholder
│   │
│   ├── styles/             # Application styling system
│   │   ├── index.css       # Design tokens, color palette, typography & reset
│   │   └── App.css         # Responsive layout, grid, and navigation styling
│   │
│   ├── tests/              # Verification & unit tests
│   │   ├── setup.js        # Vitest & React Testing Library setup
│   │   ├── App.test.jsx    # Rendering, navigation & API configuration tests
│   │   ├── Articles.test.jsx # Articles page tests
│   │   ├── Sources.test.jsx  # Sources page & form tests
│   │   ├── client.test.js    # API client: URLs, errors, timeouts, network failures
│   │   ├── normalize.test.js # Checking of backend replies
│   │   └── newsApi.test.js   # Validation, date and live-API tests
│   │
│   ├── App.jsx             # Main layout & navigation state manager
│   └── main.jsx            # Application entry point
│
├── API_CONTRACT.md         # Proposed article & source data shapes (for the backend)
├── .env.example            # Environment variable template
├── .env                    # Local environment settings
├── .gitignore              # Node modules and build output exclusions
├── index.html              # HTML shell with Google Fonts
├── package.json            # Dependencies and npm scripts
└── vite.config.js          # Vite build and Vitest configuration
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

### 1. Installation

Navigate into the `frontend` folder and install dependencies:

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

A template is provided in `.env.example`:

```bash
cp .env.example .env
```

| Variable | Example | What it does |
| -------- | ------- | ------------ |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Address of the FastAPI backend. **Required**: there is no default, so the app shows "Not configured" if it is missing. |
| `VITE_API_PREFIX` | `/api` | Path before `/sources` and `/articles`. Use `/api/v1` if the backend puts the routes under its versioned prefix. |
| `VITE_USE_MOCK_DATA` | `false` | `true` shows sample data from `src/mocks/` (yellow **Mock data** badge). `false` calls the real backend (green **Live API** badge). |

> **Security**: Vite copies every `VITE_` variable into the browser code, where anyone can read it. Never put passwords, database URLs or API keys in `frontend/.env`.

> Restart `npm run dev` after changing `.env`.

### Connecting to the backend

1. Start PostgreSQL and fill it with sample data, from the project root:
   ```bash
   docker compose up -d
   python -m app.db.seed
   ```
2. Start the backend from the project root so it runs at `http://localhost:8000`:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
3. In `frontend/.env`, set `VITE_API_BASE_URL=http://localhost:8000`, `VITE_API_PREFIX=/api` and `VITE_USE_MOCK_DATA=false`.
4. Start the frontend and click **Check Backend Connection** on the Dashboard. It calls `GET /health`.
5. Open **Sources** and **Articles**: they now show the records stored in the database.
6. If the backend runs on another computer or port, change `VITE_API_BASE_URL` to match. The backend must allow the frontend's address in its CORS settings (`app/main.py`).

> **Status**: the Articles and Sources pages were tested end to end with the real backend and PostgreSQL on 28 Oct 2026. See [`API_CONTRACT.md`](API_CONTRACT.md) for the results and one open backend issue (Alembic migrations).

### 3. Start Development Server

Run the Vite development server:

```bash
npm run dev
```

By default, Vite will start the app at `http://localhost:5173/`. Open this URL in your web browser.

---

## 🧪 Running Tests & Verification

Automated tests are configured using [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/):

```bash
npm test
```

To run tests in watch mode during development:

```bash
npm run test:watch
```

The test suite verifies:
1. Application header and project title rendering (**News Bias and Framing Analysis System**).
2. All 5 primary navigation links (**Dashboard**, **Articles**, **Sources**, **Comparisons**, **Reports**).
3. The 4 metric KPI cards (**Total articles**, **News sources**, **Stories and events**, **Comparisons completed**).
4. Recent articles section empty state behavior.
5. Tab navigation and dynamic view switching.
6. Mobile menu drawer toggling.
7. Environment variable resolution and API endpoint formatting.
8. Articles page: loading, table columns, search, source filter, pagination, details view, empty and error states.
9. Sources page: source list, required-field validation, adding a source, duplicate names, empty and error states.
10. Live mode: `newsApi.js` calls the right backend paths with `limit`, `offset` and `source_id`.
11. API client: backend error messages, network failures, timeouts, non-JSON replies and a missing backend URL.
12. Reply checking: broken or unexpected replies become errors instead of wrong data.

The tests never call a real server: page tests use the pretend backend in `src/mocks/`, and API tests replace `fetch` with a fake one. Test settings are fixed in `vite.config.js`, so your own `.env` does not change the results.

---

## 📦 Building for Production

To create an optimized production build:

```bash
npm run build
```

The output will be placed in `frontend/dist/`. To preview the production bundle locally:

```bash
npm run preview
```

---

## 🔗 Backend Integration Plan

The frontend is prepared for seamless integration with the FastAPI backend:
- `src/api/config.js` reads `VITE_API_BASE_URL` and `VITE_API_PREFIX`.
- `src/api/client.js` sends every request, with a 10-second timeout and readable error messages.
- `src/api/normalize.js` checks every reply before the pages use it.
- `src/api/newsApi.js` holds every article and source call. Pages never call `fetch` directly.
- The planned endpoints (`/api/sources`, `/api/sources/{id}`, `/api/articles`, `/api/articles/{id}`), the open questions for the backend team, and the current status are in [`API_CONTRACT.md`](API_CONTRACT.md).
