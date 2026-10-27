# News Bias and Framing Analysis System - Frontend

The frontend for the **News Bias and Framing Analysis System** is built using **React** and **Vite**. It provides a modern, responsive interface for journalists, analysts, and researchers to explore media framing patterns, ideological slants, and cross-source coverage divergence.

---

## 📁 Directory Structure

```text
frontend/
├── public/                 # Static assets and icons
├── src/
│   ├── api/                # API client configuration & request utilities
│   │   ├── client.js       # Reusable GET/POST wrappers (no hardcoded URLs)
│   │   ├── config.js       # Centralized API base URL config (VITE_API_BASE_URL)
│   │   └── newsApi.js      # Article & source calls (mock or live mode)
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
│   │   └── mockData.js     # Sample sources & articles (used until the backend is ready)
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

The frontend connects to the FastAPI backend using `VITE_API_BASE_URL`.

A template is provided in `.env.example`:

```bash
cp .env.example .env
```

Contents of `.env`:
```env
# Backend API Base URL (FastAPI)
VITE_API_BASE_URL=http://localhost:8000

# Use sample (mock) data for Articles and Sources
VITE_USE_MOCK_DATA=true
```

> **Note**: Change this URL if your FastAPI backend runs on a different host or port. The frontend reads this variable through `src/api/config.js` and does not hardcode URLs anywhere in the UI.

> **Mock data**: The backend does not have article or source endpoints yet, so the Articles and Sources pages show sample data from `src/mocks/mockData.js` and display a yellow **Mock data** badge. When the endpoints described in [`API_CONTRACT.md`](API_CONTRACT.md) are ready, set `VITE_USE_MOCK_DATA=false` and the pages call the backend instead (badge changes to **Live API**).

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
10. Live mode: `newsApi.js` calls the backend paths instead of using mock data.

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
- `src/api/config.js` manages `VITE_API_BASE_URL`.
- `src/api/client.js` provides `apiGet` and `apiPost` helpers.
- `src/api/newsApi.js` holds every article and source call. Pages never call `fetch` directly.
- The proposed endpoints (`GET /api/v1/articles`, `GET /api/v1/sources`, `POST /api/v1/sources`) and their data shapes are documented in [`API_CONTRACT.md`](API_CONTRACT.md) for agreement with the backend team. They are not implemented in the backend yet.
