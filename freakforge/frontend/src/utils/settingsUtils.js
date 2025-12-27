/**
 * Settings Utilities
 * Helper functions for managing app settings and sigma calculations
 */

export const getSettings = () => {
  const saved = localStorage.getItem('freakforgeSettings');
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    greenIsGood: false,
    metricFlips: {
      dash40: false,
      proAgility: false,
      lDrill: false,
      verticalJump: false,
      broadJump: false,
      height: false,
      weight: false
    }
  };
};

export const applySigmaFlip = (metricKey, sigma) => {
  const settings = getSettings();
  
  if (settings.metricFlips[metricKey]) {
    return -sigma;
  }
  
  return sigma;
};

export const getSigmaColor = (sigma) => {
  return sigma > 0 ? '#10b981' : '#ef4444';
};

export const formatSigma = (sigma) => {
  return `${sigma > 0 ? '+' : ''}${sigma.toFixed(2)}σ`;
};
