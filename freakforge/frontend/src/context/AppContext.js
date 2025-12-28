import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Athlete selection state
  const [selectedAthletes, setSelectedAthletes] = useState([]);

  // Forged axes state
  const [forgedAxes, setForgedAxes] = useState([]);

  // #8: Shared sidebar filter state across all tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    positions: [],
    states: [],
    gradYears: [],
    heightRange: { min: null, max: null },
    weightRange: { min: null, max: null }
  });

  // #3: ME bell curve slider state - persists across tab switches
  const [meZScoreFilterLow, setMeZScoreFilterLow] = useState(0);
  const [meZScoreFilterHigh, setMeZScoreFilterHigh] = useState(0);

  // #1: Statistic filter state for Selection tab
  const [statisticFilter, setStatisticFilter] = useState({
    enabled: false,
    low: -3,
    high: 1.5,
    keepOutside: true // true = keep outside (remove players with no z-scores >= cutoff), false = keep inside
  });

  // #4: Recalculate statistics based on filtered population
  const [recalcStatsFromFilters, setRecalcStatsFromFilters] = useState(false);

  // #6: Filter pane collapsed state
  const [filterPaneCollapsed, setFilterPaneCollapsed] = useState(false);

  // #4: Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    details: [],
    onConfirm: null,
    onCancel: null
  });

  const showConfirmDialog = (title, message, details, onConfirm, onCancel) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      details,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const toggleAthleteSelection = (athleteId) => {
    setSelectedAthletes(prev =>
      prev.includes(athleteId)
        ? prev.filter(id => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const removeAthleteSelection = (athleteId) => {
    setSelectedAthletes(prev => prev.filter(id => id !== athleteId));
  };

  const clearSelectedAthletes = () => {
    setSelectedAthletes([]);
  };

  const addForgedAxis = (formula, label) => {
    setForgedAxes(prev => {
      if (prev.some(axis => axis.formula === formula)) return prev;
      return [...prev, { formula, label }];
    });
  };

  const removeForgedAxis = (formula) => {
    setForgedAxes(prev => prev.filter(axis => axis.formula !== formula));
  };

  const clearForgedAxes = () => {
    setForgedAxes([]);
  };

  // #8: Filter helper functions
  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      const current = prev[filterType];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [filterType]: updated };
    });
  };

  const clearAllFilters = () => {
    setFilters({
      positions: [],
      states: [],
      gradYears: [],
      heightRange: { min: null, max: null },
      weightRange: { min: null, max: null }
    });
    setStatisticFilter({
      enabled: false,
      low: -3,
      high: 1.5,
      keepOutside: true
    });
  };

  const hasActiveFilters = () => {
    return filters.positions.length > 0 ||
      filters.states.length > 0 ||
      filters.gradYears.length > 0 ||
      filters.heightRange.min !== null ||
      filters.heightRange.max !== null ||
      filters.weightRange.min !== null ||
      filters.weightRange.max !== null ||
      statisticFilter.enabled;
  };

  const value = {
    selectedAthletes,
    setSelectedAthletes,
    toggleAthleteSelection,
    removeAthleteSelection,
    clearSelectedAthletes,
    forgedAxes,
    addForgedAxis,
    removeForgedAxis,
    clearForgedAxes,
    // #8: Shared filter state
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    toggleFilter,
    clearAllFilters,
    hasActiveFilters,
    // #3: ME slider state
    meZScoreFilterLow,
    setMeZScoreFilterLow,
    meZScoreFilterHigh,
    setMeZScoreFilterHigh,
    // #1: Statistic filter
    statisticFilter,
    setStatisticFilter,
    // #4: Recalc stats from filters
    recalcStatsFromFilters,
    setRecalcStatsFromFilters,
    // #6: Filter pane collapsed
    filterPaneCollapsed,
    setFilterPaneCollapsed,
    // #4: Confirmation dialog
    confirmDialog,
    showConfirmDialog,
    closeConfirmDialog
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export default AppContext;