import React, { useState } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import Articles from './pages/Articles'
import Comparisons from './pages/Comparisons'
import Reports from './pages/Reports'
import './styles/App.css'

/**
 * Root Application Component
 * 
 * Manages active navigation state and renders the responsive shell layout.
 */
export function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'articles':
        return <Articles />
      case 'comparisons':
        return <Comparisons />
      case 'reports':
        return <Reports />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />
      <main className="main-content">
        {renderActivePage()}
      </main>
      <Footer />
    </div>
  )
}

export default App
