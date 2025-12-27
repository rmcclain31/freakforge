import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [selectedAthletes, setSelectedAthletes] = useState([]);
  const [forgedAxes, setForgedAxes] = useState([]);
  const [filters, setFilters] = useState({
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
  const [activeFilters, setActiveFilters] = useState([]);

  // Load forged axes from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('freakforgeForgedAxes');
    if (saved) {
      try {
        setForgedAxes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load forged axes:', e);
      }
    }
  }, []);

  // Save forged axes to localStorage when changed
  useEffect(() => {
    if (forgedAxes.length > 0) {
      localStorage.setItem('freakforgeForgedAxes', JSON.stringify(forgedAxes));
    }
  }, [forgedAxes]);

  // Update active filters list whenever filters change
  useEffect(() => {
    const active = [];

    if (filters.position.length > 0) {
      active.push(`Position: ${filters.position.join(', ')}`);
    }
    if (filters.state.length > 0) {
      active.push(`State: ${filters.state.join(', ')}`);
    }
    if (filters.gradYearMin || filters.gradYearMax) {
      const min = filters.gradYearMin || '—';
      const max = filters.gradYearMax || '—';
      active.push(`Class: ${min} to ${max}`);
    }
    if (filters.heightMin || filters.heightMax) {
      const min = filters.heightMin ? `${Math.floor(filters.heightMin/12)}'${filters.heightMin%12}"` : '—';
      const max = filters.heightMax ? `${Math.floor(filters.heightMax/12)}'${filters.heightMax%12}"` : '—';
      active.push(`Height: ${min} to ${max}`);
    }
    if (filters.weightMin || filters.weightMax) {
      const min = filters.weightMin || '—';
      const max = filters.weightMax || '—';
      active.push(`Weight: ${min} to ${max} lbs`);
    }
    if (filters.dash40Min || filters.dash40Max) {
      const min = filters.dash40Min || '—';
      const max = filters.dash40Max || '—';
      active.push(`40-Time: ${min} to ${max} sec`);
    }

    setActiveFilters(active);
  }, [filters]);

  const toggleAthleteSelection = (athleteId) => {
    setSelectedAthletes(prev =>
      prev.includes(athleteId)
        ? prev.filter(id => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const clearSelectedAthletes = () => {
    setSelectedAthletes([]);
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
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
  };

  const applyFilters = (athletes) => {
    return athletes.filter(athlete => {
      // Position filter
      if (filters.position.length > 0 && !filters.position.includes(athlete.position)) {
        return false;
      }

      // State filter
      if (filters.state.length > 0 && !filters.state.includes(athlete.state)) {
        return false;
      }

      // Graduation year filter
      if (filters.gradYearMin && athlete.gradYear < filters.gradYearMin) {
        return false;
      }
      if (filters.gradYearMax && athlete.gradYear > filters.gradYearMax) {
        return false;
      }

      // Height filter
      if (filters.heightMin && athlete.height < filters.heightMin) {
        return false;
      }
      if (filters.heightMax && athlete.height > filters.heightMax) {
        return false;
      }

      // Weight filter
      if (filters.weightMin && athlete.weight < filters.weightMin) {
        return false;
      }
      if (filters.weightMax && athlete.weight > filters.weightMax) {
        return false;
      }

      // 40-yard dash filter
      if (filters.dash40Min && athlete.dash40 < filters.dash40Min) {
        return false;
      }
      if (filters.dash40Max && athlete.dash40 > filters.dash40Max) {
        return false;
      }

      return true;
    });
  };

  // Forged Profile management
  const addForgedAxis = (formula, label) => {
    if (forgedAxes.length >= 8) {
      alert('Maximum 8 custom axes reached');
      return false;
    }

    // Check if already exists
    if (forgedAxes.some(axis => axis.formula === formula)) {
      alert('This metric is already in your Forged Profile');
      return false;
    }

    setForgedAxes(prev => [...prev, { formula, label: label || formula }]);
    return true;
  };

  const removeForgedAxis = (formula) => {
    setForgedAxes(prev => prev.filter(axis => axis.formula !== formula));
  };

  const clearForgedAxes = () => {
    if (confirm('Clear all custom axes from Forged Profile?')) {
      setForgedAxes([]);
      localStorage.removeItem('freakforgeForgedAxes');
    }
  };

  const value = {
    selectedAthletes,
    toggleAthleteSelection,
    clearSelectedAthletes,
    filters,
    updateFilters,
    clearFilters,
    applyFilters,
    activeFilters,
    forgedAxes,
    addForgedAxis,
    removeForgedAxis,
    clearForgedAxes
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};