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
│   │   └── config.js       # Centralized API base URL config (VITE_API_BASE_URL)
│   │
│   ├── components/         # Reusable UI components
│   │   ├── Card.jsx        # Standardized content card container
│   │   ├── EmptyState.jsx  # Reusable empty state with icon and description
│   │   ├── Footer.jsx      # Application footer with backend indicator
│   │   ├── Header.jsx      # Top app header with breadcrumbs and mobile toggle
│   │   ├── MetricCard.jsx  # Metric KPI cards with placeholder tags
│   │   ├── Navbar.jsx      # Navigation bar
│   │   ├── PageHeader.jsx  # Page title, subtitle, and action badge layout
│   │   ├── Sidebar.jsx     # Desktop sidebar and mobile slide-out drawer
│   │   └── StatusBadge.jsx # Dynamic status badges (primary, success, warning, info)
│   │
│   ├── pages/              # View pages corresponding to navigation tabs
│   │   ├── Dashboard.jsx   # Metrics, recent articles empty state & pipeline overview
│   │   ├── Articles.jsx    # Ingested news stream & filter placeholder
│   │   ├── Sources.jsx     # Monitored publisher catalog placeholder
│   │   ├── Comparisons.jsx # Cross-publisher framing comparison placeholder
│   │   └── Reports.jsx     # Analytical bias distribution reports placeholder
│   │
│   ├── styles/             # Application styling system
│   │   ├── index.css       # Design tokens, color palette, typography & reset
│   │   └── App.css         # Responsive layout, grid, and navigation styling
│   │
│   ├── tests/              # Verification & unit tests
│   │   ├── setup.js        # Vitest & React Testing Library setup
│   │   └── App.test.jsx    # Rendering, navigation & API configuration tests
│   │
│   ├── App.jsx             # Main layout & navigation state manager
│   └── main.jsx            # Application entry point
│
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
```

> **Note**: Change this URL if your FastAPI backend runs on a different host or port. The frontend reads this variable through `src/api/config.js` and does not hardcode URLs anywhere in the UI.

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
- In future milestones, backend endpoints (such as `GET /api/v1/articles` or `GET /api/v1/sources`) will be wired into the corresponding pages without altering the layout architecture.
