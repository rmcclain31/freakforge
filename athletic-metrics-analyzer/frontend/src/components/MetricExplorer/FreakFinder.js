import React, { useState, useEffect, useRef } from 'react';
import dataService from '../../utils/dataService';
import { exportAthleteToPDF } from '../../utils/pdfExport';
import { useAppContext } from '../../context/AppContext';

// Metric explanations database
const METRIC_EXPLANATIONS = {
  'dash40': 'Measures linear speed and acceleration. Elite high school times are under 4.5 seconds. Critical for positions requiring straight-line speed.',
  'verticalJump': 'Measures explosive leg power and lower body strength. Important for positions that require jumping ability and quick bursts of movement.',
  'broadJump': 'Measures horizontal explosive power and lower body strength. Correlates strongly with acceleration and power output.',
  'proAgility': 'Tests lateral quickness, change of direction ability, and body control. Essential for positions requiring side-to-side movement.',
  'lDrill': 'Measures ability to change direction while maintaining speed. Tests agility, balance, and flexibility in multiple planes of motion.',
  'height': 'Physical measurement affecting leverage, reach, and positional requirements. Advantages vary by position.',
  'weight': 'Indicates body mass and potential for power generation. Must be considered relative to other metrics for true athletic assessment.',
  'verticaljump/weight': 'Power-to-weight ratio for vertical explosion. Higher values indicate exceptional explosive power relative to body mass. Elite athletes generate significant force despite their size.',
  'broadjump/weight': 'Horizontal power-to-weight ratio. Measures ability to generate explosive horizontal force relative to body mass. Key indicator of acceleration potential.',
  'weight/dash40': 'Speed-for-size metric. Higher values mean the athlete maintains good speed despite larger body mass. Valuable for power positions requiring speed.',
  'broadjump/dash40': 'Combines explosive power with speed. High values indicate rare combination of acceleration and explosive strength. Often seen in elite skill position players.',
  'verticaljump/dash40': 'Explosive power combined with speed. Athletes with high values possess rare combination of vertical explosion and linear speed.',
  'broadjump/height': 'Explosive power normalized by height. Shows jumping ability relative to body length. High values indicate exceptional leg power for frame size.',
  'height/weight': 'Body density indicator. Lower values suggest more compact, dense build. Higher values suggest leaner, longer frame. Context depends on position.'
};

function FreakFinder() {
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [calculatedMetrics, setCalculatedMetrics] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]); // Track selected points
  const [hoveredMetricInfo, setHoveredMetricInfo] = useState(null); // For legend
  const [showExplanation, setShowExplanation] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const canvasRef = useRef(null);
  const { selectedAthletes, toggleAthleteSelection, clearSelectedAthletes, addForgedAxis, removeForgedAxis, forgedAxes } = useAppContext();

  useEffect(() => {
    dataService.loadData().then(data => {
      setAthletes(data.athletes);
      if (data.athletes.length > 0) {
        setSelectedAthlete(data.athletes[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedAthlete) {
      calculateAllMetrics();
    }
  }, [selectedAthlete]);

  useEffect(() => {
    if (calculatedMetrics.length > 0 && canvasRef.current) {
      drawBellCurve();
    }
  }, [calculatedMetrics, hoveredPoint, hoveredMetricInfo, selectedMetrics]);

  const getMetricUnits = (formula) => {
    const parts = formula.split(' / ');
    if (parts.length !== 2) {
      const unitMap = {
        '40-Yard Dash': 'sec',
        'Vertical Jump': 'in',
        'Broad Jump': 'in',
        'Pro Agility': 'sec',
        'L-Drill': 'sec',
        'Height': 'in',
        'Weight': 'lbs'
      };
      return unitMap[formula] || '';
    }

    const numeratorUnits = {
      '40-Yard Dash': 'sec',
      'Vertical Jump': 'in',
      'Broad Jump': 'in',
      'Pro Agility': 'sec',
      'L-Drill': 'sec',
      'Height': 'in',
      'Weight': 'lbs'
    };

    const num = numeratorUnits[parts[0]] || '';
    const den = numeratorUnits[parts[1]] || '';

    if (num && den) {
      return `${num}/${den}`;
    }
    return '';
  };

  const isReciprocal = (metric1, metric2) => {
    const parts1 = metric1.formula.split(' / ');
    const parts2 = metric2.formula.split(' / ');

    if (parts1.length !== 2 || parts2.length !== 2) return false;

    return parts1[0] === parts2[1] && parts1[1] === parts2[0];
  };

  const getPreferredMetric = (metric1, metric2) => {
    const timeMetrics = ['40-Yard Dash', 'Pro Agility', 'L-Drill'];

    const parts1 = metric1.formula.split(' / ');
    const parts2 = metric2.formula.split(' / ');

    if (timeMetrics.includes(parts1[1]) && !timeMetrics.includes(parts2[1])) {
      return [metric1, metric2];
    }
    if (timeMetrics.includes(parts2[1]) && !timeMetrics.includes(parts1[1])) {
      return [metric2, metric1];
    }

    if (parts1[1] === 'Weight' && parts2[1] !== 'Weight') {
      return [metric1, metric2];
    }
    if (parts2[1] === 'Weight' && parts1[1] !== 'Weight') {
      return [metric2, metric1];
    }

    return [metric1, metric2];
  };

  const calculateSigmaBands = (athlete) => {
    const metrics = calculateMetricsForAthlete(athlete);
    const bands = {
      'minus3': 0, 'minus2': 0, 'minus1': 0, 'zero': 0,
      'plus1': 0, 'plus2': 0, 'plus3': 0
    };

    metrics.forEach(m => {
      const sigma = m.sigma;
      if (sigma < -3) bands.minus3++;
      else if (sigma < -2) bands.minus2++;
      else if (sigma < -1) bands.minus1++;
      else if (sigma < 1) bands.zero++;
      else if (sigma < 2) bands.plus1++;
      else if (sigma < 3) bands.plus2++;
      else bands.plus3++;
    });

    return bands;
  };

  const calculateMetricsForAthlete = (athlete) => {
    const metrics = [
      { key: 'dash40', name: '40-Yard Dash', isTime: true },
      { key: 'verticalJump', name: 'Vertical Jump' },
      { key: 'broadJump', name: 'Broad Jump' },
      { key: 'proAgility', name: 'Pro Agility', isTime: true },
      { key: 'lDrill', name: 'L-Drill', isTime: true },
      { key: 'height', name: 'Height' },
      { key: 'weight', name: 'Weight' }
    ];

    const calculated = [];

    metrics.forEach(metric => {
      const value = athlete[metric.key];
      if (value) {
        const sigma = dataService.calculateSigma(metric.key, value);
        calculated.push({
          formula: metric.name,
          value: value,
          sigma: sigma,
          isStandard: true,
          metricKey: metric.key,
          jitter: (Math.random() - 0.5) * 160  // Random y-offset, calculated once
        });
      }
    });

    for (let i = 0; i < metrics.length; i++) {
      for (let j = 0; j < metrics.length; j++) {
        if (i === j) continue;

        const numerator = metrics[i];
        const denominator = metrics[j];

        const numValue = athlete[numerator.key];
        const denValue = athlete[denominator.key];

        if (numValue && denValue && denValue !== 0) {
          const ratio = numValue / denValue;

          const allRatios = athletes
            .map(a => {
              const n = a[numerator.key];
              const d = a[denominator.key];
              return (n && d && d !== 0) ? n / d : null;
            })
            .filter(r => r !== null);

          if (allRatios.length > 1) {
            const mean = allRatios.reduce((a, b) => a + b, 0) / allRatios.length;
            const variance = allRatios.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allRatios.length;
            const std = Math.sqrt(variance);

            if (std > 0) {
              const sigma = (ratio - mean) / std;

              calculated.push({
                formula: `${numerator.name} / ${denominator.name}`,
                value: ratio,
                sigma: sigma,
                isStandard: false,
                numeratorKey: numerator.key,
                denominatorKey: denominator.key,
                jitter: (Math.random() - 0.5) * 160  // Random y-offset, calculated once
              });
            }
          }
        }
      }
    }

    return calculated;
  };

  const calculateAllMetrics = () => {
    if (!selectedAthlete) return;

    let calculated = calculateMetricsForAthlete(selectedAthlete);
    calculated.sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma));

    setCalculatedMetrics(calculated);
  };

  const mergeReciprocals = (metrics) => {
    const processed = [];
    const used = new Set();

    metrics.forEach((metric, idx) => {
      if (used.has(idx)) return;

      let reciprocalIdx = -1;
      for (let i = idx + 1; i < metrics.length; i++) {
        if (used.has(i)) continue;
        if (isReciprocal(metric, metrics[i])) {
          reciprocalIdx = i;
          break;
        }
      }

      if (reciprocalIdx !== -1) {
        const reciprocal = metrics[reciprocalIdx];
        const [preferred, other] = getPreferredMetric(metric, reciprocal);

        processed.push({
          ...preferred,
          hasReciprocal: true,
          reciprocalFormula: other.formula,
          reciprocalSigma: other.sigma,
          reciprocalValue: other.value
        });

        used.add(idx);
        used.add(reciprocalIdx);
      } else {
        processed.push(metric);
        used.add(idx);
      }
    });

    return processed;
  };

  const drawBellCurve = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw bell curve CLIPPED at ±3 sigma
    ctx.strokeStyle = '#78350f'; // Dark orange/brown for curve
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sigmaRange = 6; // -3 to +3
    const startX = width / 8; // Start at -3σ position
    const endX = width * 7 / 8; // End at +3σ position

    for (let x = startX; x <= endX; x++) {
      const sigma = ((x - startX) / (endX - startX)) * sigmaRange - 3; // -3 to +3
      const y = height * 0.75 - (height * 0.5 * Math.exp(-(sigma * sigma) / 2));

      if (x === startX) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw sigma markers
    ctx.strokeStyle = '#451a03'; // Darker brown for grid
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#a16207'; // Amber for labels

    for (let s = -3; s <= 3; s += 0.5) {
      const x = width / 2 + (s * width / 8);
      const tickHeight = s % 1 === 0 ? 25 : 12;

      ctx.beginPath();
      ctx.moveTo(x, height * 0.75);
      ctx.lineTo(x, height * 0.75 + tickHeight);
      ctx.stroke();

      if (s % 1 === 0) {
        const label = s > 0 ? `+${s}σ` : `${s}σ`;
        ctx.fillText(label, x - 15, height * 0.75 + 45);
      }
    }

    // Draw center line
    ctx.strokeStyle = '#ea580c'; // Bright orange for center
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 50);
    ctx.lineTo(width / 2, height * 0.75);
    ctx.stroke();
    ctx.setLineDash([]);

    const baselineY = height * 0.5;

    // Filter out reciprocals - only show one from each pair
    const displayMetrics = mergeReciprocals(calculatedMetrics);

    displayMetrics.forEach((metric) => {
      const sigma = Math.max(-4, Math.min(4, metric.sigma));
      const x = width / 2 + (sigma * width / 8);
      const y = baselineY + metric.jitter;  // Use stored jitter instead of recalculating

      // Check if this point is hovered
      const isHovered = hoveredPoint &&
                       Math.abs(hoveredPoint.x - x) < 1 &&
                       Math.abs(hoveredPoint.y - y) < 1;

      // Check if this point is selected
      const isSelected = selectedMetrics.some(sm => sm.formula === metric.formula);

      // Draw selection ring first (behind point)
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Yellow for hovered, red for standard, orange for calculated
      if (isHovered) {
        ctx.fillStyle = '#fbbf24'; // Bright yellow
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2); // Larger when hovered
        ctx.fill();
      } else {
        ctx.fillStyle = metric.isStandard ? '#ef4444' : '#fb923c';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      metric.x = x;
      metric.y = y;
    });

    // Draw legend in upper right if hovering
    if (hoveredMetricInfo) {
      const legendX = width - 250;
      const legendY = 20;
      const legendWidth = 230;
      const legendHeight = 90;

      // Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
      ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

      // Labels and values
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#a16207';
      ctx.textAlign = 'left';

      const labelX = legendX + 10;
      const valueX = legendX + 80;
      let currentY = legendY + 25;

      // Metric
      ctx.fillText('Metric:', labelX, currentY);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(hoveredMetricInfo.formula, valueX, currentY);

      // Sigma
      currentY += 25;
      ctx.fillStyle = '#a16207';
      ctx.fillText('σ:', labelX, currentY);
      ctx.fillStyle = hoveredMetricInfo.sigma > 0 ? '#f97316' : '#dc2626';
      ctx.fillText(`${hoveredMetricInfo.sigma > 0 ? '+' : ''}${hoveredMetricInfo.sigma.toFixed(2)}`, valueX, currentY);

      // Actual
      currentY += 25;
      ctx.fillStyle = '#a16207';
      ctx.fillText('Actual:', labelX, currentY);
      ctx.fillStyle = '#fbbf24';
      const units = getMetricUnits(hoveredMetricInfo.formula);
      ctx.fillText(`${hoveredMetricInfo.value.toFixed(3)} ${units}`, valueX, currentY);

      ctx.textAlign = 'start'; // Reset
    }
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Use filtered display metrics (no reciprocals)
    const displayMetrics = mergeReciprocals(calculatedMetrics);
    const clicked = displayMetrics.find(m => {
      const dist = Math.sqrt(Math.pow(x - m.x, 2) + Math.pow(y - m.y, 2));
      return dist < 10;
    });

    if (clicked) {
      // Check if already selected
      const alreadySelected = selectedMetrics.some(sm => sm.formula === clicked.formula);

      if (alreadySelected) {
        // Remove from selection and Forged Profile
        setSelectedMetrics(prev => prev.filter(sm => sm.formula !== clicked.formula));
        removeForgedAxis(clicked.formula);
      } else {
        // Add to selection and Forged Profile
        setSelectedMetrics(prev => [...prev, clicked]);
        addForgedAxis(clicked.formula, clicked.formula);
      }
    }
  };

  const handleCanvasHover = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Use filtered display metrics (no reciprocals)
    const displayMetrics = mergeReciprocals(calculatedMetrics);
    const hovered = displayMetrics.find(m => {
      const dist = Math.sqrt(Math.pow(x - m.x, 2) + Math.pow(y - m.y, 2));
      return dist < 10;
    });

    // Update hover state and legend info
    if (hovered) {
      if (!hoveredPoint || hoveredPoint.x !== hovered.x || hoveredPoint.y !== hovered.y) {
        setHoveredPoint({ x: hovered.x, y: hovered.y });
      }
      setHoveredMetricInfo({
        formula: hovered.formula,
        sigma: hovered.sigma,
        value: hovered.value
      });
    } else {
      if (hoveredPoint) {
        setHoveredPoint(null);
      }
      if (hoveredMetricInfo) {
        setHoveredMetricInfo(null);
      }
    }

    canvas.style.cursor = hovered ? 'pointer' : 'default';
  };

  const filteredAthletes = searchQuery
    ? dataService.searchAthletes(searchQuery)
    : athletes;

  const selectedAthleteObjects = athletes.filter(a => selectedAthletes.includes(a.id));
  const unselectedAthletes = filteredAthletes.filter(a => !selectedAthletes.includes(a.id));

  const extremeMetrics = mergeReciprocals(
    calculatedMetrics.filter(m => Math.abs(m.sigma) >= 1.5)
  );

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{
        width: '350px',
        background: '#1e293b',
        borderRight: '1px solid #78350f',
        padding: '1rem',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fb923c' }}>Athletes</h3>

        <input
          type="text"
          placeholder="Search athletes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            background: '#0f172a',
            border: '1px solid #78350f',
            borderRadius: '0.375rem',
            color: '#fbbf24',
            fontSize: '0.9rem'
          }}
        />

        {/* Selected Athletes Section */}
        {selectedAthleteObjects.length > 0 && (
          <div style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: '#422006',
            borderRadius: '0.5rem',
            border: '2px solid #ea580c'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem'
            }}>
              <h4 style={{ fontSize: '0.95rem', color: '#fb923c', fontWeight: '600' }}>
                ✓ Selected ({selectedAthleteObjects.length})
              </h4>
              <button
                onClick={clearSelectedAthletes}
                style={{
                  padding: '0.25rem 0.5rem',
                  background: '#7c2d12',
                  border: '1px solid #ea580c',
                  borderRadius: '0.25rem',
                  color: '#fdba74',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>

            {selectedAthleteObjects.map(athlete => {
              const bands = calculateSigmaBands(athlete);
              return (
                <div
                  key={athlete.id}
                  onClick={() => setSelectedAthlete(athlete)}
                  style={{
                    padding: '0.5rem',
                    marginBottom: '0.25rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    background: selectedAthlete?.id === athlete.id ? '#7c2d12' : '#292524',
                    border: '1px solid #78350f',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedAthlete?.id !== athlete.id) {
                      e.currentTarget.style.background = '#57534e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedAthlete?.id !== athlete.id) {
                      e.currentTarget.style.background = '#292524';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleAthleteSelection(athlete.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fbbf24' }}>
                        {athlete.firstName} {athlete.lastName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a16207', marginTop: '0.125rem' }}>
                        {athlete.position} • {athlete.state}
                      </div>
                    </div>
                  </div>

                  {/* Sigma bands */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    justifyContent: 'flex-end',
                    fontFamily: 'monospace'
                  }}>
                    <span style={{ color: '#ef4444', width: '20px', textAlign: 'right' }}>{bands.minus3 || '-'}</span>
                    <span style={{ color: '#ef4444', width: '20px', textAlign: 'right' }}>{bands.minus2 || '-'}</span>
                    <span style={{ color: '#ef4444', width: '20px', textAlign: 'right' }}>{bands.minus1 || '-'}</span>
                    <span style={{ color: '#94a3b8', width: '20px', textAlign: 'center' }}>{bands.zero || '-'}</span>
                    <span style={{ color: '#10b981', width: '20px', textAlign: 'left' }}>{bands.plus1 || '-'}</span>
                    <span style={{ color: '#10b981', width: '20px', textAlign: 'left' }}>{bands.plus2 || '-'}</span>
                    <span style={{ color: '#10b981', width: '20px', textAlign: 'left' }}>{bands.plus3 || '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* All Athletes List */}
        <div style={{ fontSize: '0.85rem', color: '#a16207', marginBottom: '0.5rem' }}>
          {unselectedAthletes.length} athletes
        </div>

        {unselectedAthletes.slice(0, 50).map(athlete => {
          const bands = calculateSigmaBands(athlete);

          return (
            <div
              key={athlete.id}
              onClick={() => setSelectedAthlete(athlete)}
              style={{
                padding: '0.75rem',
                marginBottom: '0.25rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                background: selectedAthlete?.id === athlete.id ? '#7c2d12' : 'transparent',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (selectedAthlete?.id !== athlete.id) {
                  e.currentTarget.style.background = '#422006';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedAthlete?.id !== athlete.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={selectedAthletes.includes(athlete.id)}
                  onChange={() => toggleAthleteSelection(athlete.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#fbbf24' }}>
                    {athlete.firstName} {athlete.lastName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#a16207', marginTop: '0.25rem' }}>
                    {athlete.position} • {athlete.state} • {athlete.gradYear}
                  </div>
                </div>
              </div>

              {/* Sigma bands */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                justifyContent: 'flex-end',
                fontFamily: 'monospace'
              }}>
                <span style={{ color: '#ef4444', width: '20px', textAlign: 'right' }}>{bands.minus3 || '-'}</span>
                <span style={{ color: '#ef4444', width: '20px', textAlign: 'right' }}>{bands.minus2 || '-'}</span>
                <span style={{ color: '#ef4444', width: '20px', textAlign: 'right' }}>{bands.minus1 || '-'}</span>
                <span style={{ color: '#94a3b8', width: '20px', textAlign: 'center' }}>{bands.zero || '-'}</span>
                <span style={{ color: '#10b981', width: '20px', textAlign: 'left' }}>{bands.plus1 || '-'}</span>
                <span style={{ color: '#10b981', width: '20px', textAlign: 'left' }}>{bands.plus2 || '-'}</span>
                <span style={{ color: '#10b981', width: '20px', textAlign: 'left' }}>{bands.plus3 || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {selectedAthlete ? (
          <>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#fb923c' }}>
                  💎 Freak Finder: {selectedAthlete.firstName} {selectedAthlete.lastName}
                </h2>
                <div style={{ color: '#a16207', fontSize: '1rem' }}>
                  Analyzing {calculatedMetrics.length} metrics • {extremeMetrics.length} exceptional found
                </div>
              </div>
              <button
                onClick={() => exportAthleteToPDF(selectedAthlete, calculatedMetrics, dataService.getStatistics())}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#ea580c',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fef3c7',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                📄 Export Report
              </button>
            </div>

            <div style={{
              background: '#1e293b',
              padding: '2rem',
              borderRadius: '0.5rem',
              marginBottom: '2rem',
              borderLeft: '4px solid #ea580c'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#fb923c' }}>
                Statistical Distribution
              </h3>
              <canvas
                ref={canvasRef}
                width={1000}
                height={350}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasHover}
                style={{ width: '100%', borderRadius: '0.375rem' }}
              />
              <div style={{
                marginTop: '1rem',
                fontSize: '0.85rem',
                color: '#a16207',
                display: 'flex',
                gap: '2rem',
                justifyContent: 'center'
              }}>
                <div>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>●</span> Standard Metrics
                </div>
                <div>
                  <span style={{ color: '#fb923c', fontWeight: 'bold' }}>●</span> Calculated Ratios
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>
                💎 Exceptional Metrics (|σ| ≥ 1.5)
              </h3>

              {extremeMetrics.length === 0 ? (
                <div style={{
                  background: '#1e293b',
                  padding: '2rem',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  No exceptional metrics found (all within ±1.5σ)
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {extremeMetrics.map((metric, index) => {
                    const units = getMetricUnits(metric.formula);
                    const explanationKey = (metric.formula.toLowerCase().replace(/ /g, '').replace(/-/g, ''));
                    const explanation = METRIC_EXPLANATIONS[metric.metricKey] ||
                                       METRIC_EXPLANATIONS[explanationKey] ||
                                       'This metric provides insight into athletic performance.';

                    return (
                      <div
                        key={index}
                        style={{
                          background: '#1e293b',
                          padding: '1.25rem',
                          borderRadius: '0.5rem',
                          borderLeft: `4px solid ${metric.sigma > 0 ? '#f97316' : '#dc2626'}` // Orange/red fire theme
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                              {metric.formula}
                            </div>
                            <div style={{ fontSize: '1rem', color: '#cbd5e1' }}>
                              {typeof metric.value === 'number' ? metric.value.toFixed(3) : metric.value} {units}
                            </div>
                          </div>
                          <div>
                            <div style={{
                              fontSize: '1.5rem',
                              fontWeight: 'bold',
                              color: metric.sigma > 0 ? '#f97316' : '#dc2626'
                            }}>
                              {metric.sigma > 0 ? '+' : ''}{metric.sigma.toFixed(2)}σ
                            </div>
                            {metric.hasReciprocal && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginTop: '0.25rem',
                                justifyContent: 'flex-end'
                              }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#78716c',
                                  textAlign: 'right'
                                }}>
                                  Recip: {metric.reciprocalSigma > 0 ? '+' : ''}{metric.reciprocalSigma.toFixed(2)}σ
                                </div>
                                <button
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    background: '#422006',
                                    border: '1px solid #78350f',
                                    borderRadius: '0.25rem',
                                    color: '#fdba74',
                                    fontSize: '0.65rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onClick={() => {
                                    const recipUnits = getMetricUnits(metric.reciprocalFormula);
                                    alert(`${metric.reciprocalFormula}\nValue: ${metric.reciprocalValue?.toFixed(3)} ${recipUnits}\nSigma: ${metric.reciprocalSigma > 0 ? '+' : ''}${metric.reciprocalSigma.toFixed(2)}σ`);
                                  }}
                                >
                                  Invert
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: '#0f172a',
                          borderRadius: '0.375rem',
                          fontSize: '0.85rem',
                          color: '#cbd5e1',
                          lineHeight: '1.4'
                        }}>
                          {explanation}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            Loading athletes...
          </div>
        )}
      </div>
    </div>
  );
}

export default FreakFinder;