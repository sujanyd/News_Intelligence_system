import React, { useCallback, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import Articles from './pages/Articles'
import Sources from './pages/Sources'
import Stories from './pages/Stories'
import Comparisons from './pages/Comparisons'
import Reports from './pages/Reports'
import { NavigationContext } from './navigation'
import './styles/App.css'

/**
 * Root Application Component
 * 
 * Manages active navigation state and coordinates the responsive layout shell:
 * - Left Sidebar (desktop) & Slide-out drawer (mobile)
 * - Top Header bar with project title and breadcrumb
 * - Main view area for Dashboard, Articles, Stories, Sources, Comparisons, Reports
 * - Footer with environment status
 */
export function App() {
  // The open page, what it should show first (params), and a counter that
  // makes the page start again when the same page is opened with new params
  const [page, setPage] = useState({ tab: 'dashboard', params: null, visit: 0 })
  const activeTab = page.tab

  // Opens a page, e.g. navigate('stories', { name: 'event', eventId: 12 })
  const navigate = useCallback((tab, params = null) => {
    setPage((current) => ({ tab, params, visit: current.visit + 1 }))
    window.scrollTo(0, 0)
  }, [])
  const setActiveTab = (tab) => navigate(tab)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />
      case 'articles':
        return <Articles />
      case 'stories':
        return <Stories key={page.visit} initialView={page.params} />
      case 'sources':
        return <Sources />
      case 'comparisons':
        return <Comparisons key={page.visit} initialComparisonId={page.params?.comparisonId} />
      case 'reports':
        return <Reports key={page.visit} initialReportId={page.params?.reportId} />
      default:
        return <Dashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <NavigationContext.Provider value={navigate}>
      <div className="app-layout">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Column */}
        <div className="app-main-wrapper">
          <Header
            activeTab={activeTab}
            onToggleMobileMenu={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          />

          <main className="main-content" id="main-content-area">
            {renderActivePage()}
          </main>

          <Footer />
        </div>
      </div>
    </NavigationContext.Provider>
  )
}

export default App
