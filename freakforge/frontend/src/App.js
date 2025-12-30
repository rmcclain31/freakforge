import React, { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard/Dashboard';
import FreakFinder from './components/MetricExplorer/FreakFinder';
import VideoAnalysis from './components/VideoAnalysis/VideoAnalysis';
import Settings from './components/Settings/Settings';

// Reusable ForgedGlyph component for header
const ForgedGlyph = ({ size = '1rem', color = '#60a5fa' }) => {
  const fontSize = typeof size === 'string' ? `calc(${size} * 1.2)` : `${size * 1.2}px`;
  return (
    <span style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontStyle: 'italic',
      fontWeight: 'bold',
      fontFamily: 'Georgia, serif',
      fontSize,
      color,
      lineHeight: 1,
      marginRight: '0.25rem'
    }}>
      <span style={{ position: 'relative', zIndex: 1 }}>f</span>
      <span style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '50%',
        height: '2px',
        background: color,
        zIndex: 2
      }}></span>
    </span>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('selection');

  return (
    <div className="app-container">
      <header style={{
        background: '#1e293b',
        padding: '1rem 2rem',
        borderBottom: '2px solid #334155'
      }}>
        <h1 style={{fontSize: '1.5rem', color: '#60a5fa', fontWeight: 'bold', display: 'flex', alignItems: 'center'}}>
          <ForgedGlyph size="1.5rem" color="#60a5fa" />
          FreakForge
        </h1>
      </header>

      <nav style={{
        background: '#1e293b',
        display: 'flex',
        gap: '0.5rem',
        padding: '0 2rem',
        borderBottom: '1px solid #334155'
      }}>
        {['Selection', 'Metric Explorer', 'Charts', 'Video Analysis', 'Data Management', 'Settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '-'))}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'none',
              border: 'none',
              color: activeTab === tab.toLowerCase().replace(' ', '-') ? '#60a5fa' : '#94a3b8',
              cursor: 'pointer',
              borderBottom: activeTab === tab.toLowerCase().replace(' ', '-') ? '2px solid #60a5fa' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main style={{
        flex: 1,
        overflow: 'auto'
      }}>
        {/* Selection tab - athlete list only, no charts */}
        {activeTab === 'selection' && <Dashboard mode="selection" />}

        {/* Metric Explorer - bell curve analysis */}
        {activeTab === 'metric-explorer' && <FreakFinder />}

        {/* Charts tab - graphs only, no data cards */}
        {activeTab === 'charts' && <Dashboard mode="charts" />}

        {/* Video Analysis tab - always mounted, hidden when not active to preserve state */}
        <div style={{ display: activeTab === 'video-analysis' ? 'block' : 'none', height: '100%' }}>
          <VideoAnalysis />
        </div>

        {activeTab === 'settings' && <Settings />}

        {!['selection', 'metric-explorer', 'charts', 'video-analysis', 'settings'].includes(activeTab) && (
          <div style={{ padding: '2rem' }}>
            <h2 style={{marginBottom: '2rem', fontSize: '1.5rem'}}>
              {activeTab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </h2>
            <p style={{color: '#94a3b8'}}>
              Component for {activeTab} coming soon...
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;