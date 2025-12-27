import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import dataService from '../../utils/dataService';

function FilterPanel({ isOpen, onClose, allAthletes }) {
  const { filters, updateFilters, clearFilters, applyFilters } = useAppContext();
  const [localFilters, setLocalFilters] = useState(filters);
  const [availableOptions, setAvailableOptions] = useState({
    positions: [],
    states: [],
    gradYears: { min: 2018, max: 2025 }
  });
  const [filteredCount, setFilteredCount] = useState(0);

  useEffect(() => {
    // Extract unique positions and states from all athletes
    const positions = [...new Set(allAthletes.map(a => a.position))].sort();
    const states = [...new Set(allAthletes.map(a => a.state).filter(Boolean))].sort();
    const years = allAthletes.map(a => a.gradYear).filter(Boolean);
    const gradYears = {
      min: Math.min(...years),
      max: Math.max(...years)
    };
    
    setAvailableOptions({ positions, states, gradYears });
  }, [allAthletes]);

  useEffect(() => {
    // Update filtered count
    const filtered = applyFilters(allAthletes);
    setFilteredCount(filtered.length);
  }, [localFilters, allAthletes, applyFilters]);

  const handleApply = () => {
    updateFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({
      position: [],
      state: [],
      gradYearMin: null,
      gradYearMax: null,
      heightMin: null,
      heightMax: null,
      weightMin: null,
      weightMax: null,
      dash40Min: null,
      dash40Max: null
    });
    clearFilters();
  };

  const toggleArrayFilter = (filterKey, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [filterKey]: prev[filterKey].includes(value)
        ? prev[filterKey].filter(v => v !== value)
        : [...prev[filterKey], value]
    }));
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: '0.5rem',
        padding: '2rem',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.5rem' }}>🔍 Advanced Filters</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          background: '#0f172a',
          borderRadius: '0.375rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Matching Athletes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
              {filteredCount.toLocaleString()} / {allAthletes.length.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Position Filter */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Position</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {availableOptions.positions.map(pos => (
              <button
                key={pos}
                onClick={() => toggleArrayFilter('position', pos)}
                style={{
                  padding: '0.5rem 1rem',
                  background: localFilters.position.includes(pos) ? '#1e40af' : '#334155',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* State Filter */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>State</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
            {availableOptions.states.map(state => (
              <button
                key={state}
                onClick={() => toggleArrayFilter('state', state)}
                style={{
                  padding: '0.5rem 1rem',
                  background: localFilters.state.includes(state) ? '#1e40af' : '#334155',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {state}
              </button>
            ))}
          </div>
        </div>

        {/* Graduation Year Range */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Graduation Year</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                From
              </label>
              <input
                type="number"
                value={localFilters.gradYearMin || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, gradYearMin: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="Min"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                To
              </label>
              <input
                type="number"
                value={localFilters.gradYearMax || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, gradYearMax: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="Max"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
          </div>
        </div>

        {/* Height Range */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Height (inches)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                From
              </label>
              <input
                type="number"
                value={localFilters.heightMin || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, heightMin: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Min (e.g., 60)"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                To
              </label>
              <input
                type="number"
                value={localFilters.heightMax || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, heightMax: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Max (e.g., 78)"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
          </div>
        </div>

        {/* Weight Range */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Weight (lbs)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                From
              </label>
              <input
                type="number"
                value={localFilters.weightMin || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, weightMin: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Min"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                To
              </label>
              <input
                type="number"
                value={localFilters.weightMax || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, weightMax: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Max"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
          </div>
        </div>

        {/* 40-Yard Dash Range */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>40-Yard Dash (sec)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                From
              </label>
              <input
                type="number"
                step="0.01"
                value={localFilters.dash40Min || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, dash40Min: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Min"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                To
              </label>
              <input
                type="number"
                step="0.01"
                value={localFilters.dash40Max || ''}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, dash40Max: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Max"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0'
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#334155',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#e2e8f0',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#10b981',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

export default FilterPanel;
