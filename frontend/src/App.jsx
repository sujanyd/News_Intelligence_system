import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import Articles from './pages/Articles'
import Sources from './pages/Sources'
import Comparisons from './pages/Comparisons'
import Reports from './pages/Reports'
import './styles/App.css'

/**
 * Root Application Component
 * 
 * Manages active navigation state and coordinates the responsive layout shell:
 * - Left Sidebar (desktop) & Slide-out drawer (mobile)
 * - Top Header bar with project title and breadcrumb
 * - Main view area for Dashboard, Articles, Sources, Comparisons, Reports
 * - Footer with environment status
 */
export function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />
      case 'articles':
        return <Articles />
      case 'sources':
        return <Sources />
      case 'comparisons':
        return <Comparisons />
      case 'reports':
        return <Reports />
      default:
        return <Dashboard onNavigate={setActiveTab} />
    }
  }

  return (
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
  )
}

export default App
