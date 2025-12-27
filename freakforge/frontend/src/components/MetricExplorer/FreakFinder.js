import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  'verticaljump/weight': 'Power-to-weight ratio for vertical explosion. Higher values indicate exceptional explosive power relative to body mass.',
  'broadjump/weight': 'Horizontal power-to-weight ratio. Measures ability to generate explosive horizontal force relative to body mass.',
  'weight/dash40': 'Speed-for-size metric. Higher values mean the athlete maintains good speed despite larger body mass.',
  'broadjump/dash40': 'Combines explosive power with speed. High values indicate rare combination of acceleration and explosive strength.',
  'verticaljump/dash40': 'Explosive power combined with speed. Athletes with high values possess rare combination of vertical explosion and linear speed.',
  'broadjump/height': 'Explosive power normalized by height. Shows jumping ability relative to body length.',
  'height/weight': 'Body density indicator. Lower values suggest more compact, dense build. Higher values suggest leaner, longer frame.'
};

// Color palette for multi-athlete comparison
const ATHLETE_COLORS = [
  { fill: 'rgba(239, 68, 68, 1)', stroke: '#ffffff', name: 'Red' },
  { fill: 'rgba(59, 130, 246, 1)', stroke: '#ffffff', name: 'Blue' },
  { fill: 'rgba(16, 185, 129, 1)', stroke: '#ffffff', name: 'Green' },
  { fill: 'rgba(245, 158, 11, 1)', stroke: '#ffffff', name: 'Amber' },
  { fill: 'rgba(139, 92, 246, 1)', stroke: '#ffffff', name: 'Purple' },
];

function FreakFinder() {
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [hoveredMetricInfo, setHoveredMetricInfo] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredCardMetric, setHoveredCardMetric] = useState(null);
  const canvasRef = useRef(null);
  const { selectedAthletes, toggleAthleteSelection, clearSelectedAthletes, addForgedAxis, removeForgedAxis, forgedAxes } = useAppContext();

  // Store jitter values per athlete-metric combination
  const jitterMapRef = useRef(new Map());

  useEffect(() => {
    dataService.loadData().then(data => {
      setAthletes(data.athletes);
      if (data.athletes.length > 0) {
        setSelectedAthlete(data.athletes[0]);
      }
    });
  }, []);

  // Get stable jitter for an athlete-metric combination
  const getJitter = (athleteId, metricFormula) => {
    const key = `${athleteId}-${metricFormula}`;
    if (!jitterMapRef.current.has(key)) {
      jitterMapRef.current.set(key, (Math.random() - 0.5) * 160);
    }
    return jitterMapRef.current.get(key);
  };

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
          athleteId: athlete.id,
          jitter: getJitter(athlete.id, metric.name)
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
              const formula = `${numerator.name} / ${denominator.name}`;

              calculated.push({
                formula: formula,
                value: ratio,
                sigma: sigma,
                isStandard: false,
                numeratorKey: numerator.key,
                denominatorKey: denominator.key,
                athleteId: athlete.id,
                jitter: getJitter(athlete.id, formula)
              });
            }
          }
        }
      }
    }

    return calculated;
  };

  // FEATURE #1: Only use checkbox selections for bell curve display
  // Calculate metrics for all CHECKBOX-selected athletes only
  const allAthletesMetrics = useMemo(() => {
    const athletesToShow = selectedAthletes.length > 0
      ? athletes.filter(a => selectedAthletes.includes(a.id))
      : selectedAthlete ? [selectedAthlete] : [];

    return athletesToShow.map((athlete, index) => ({
      athlete,
      colorIndex: index % ATHLETE_COLORS.length,
      metrics: calculateMetricsForAthlete(athlete)
    }));
  }, [selectedAthletes, selectedAthlete, athletes]);

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

    const sigmaRange = 6;
    const startX = width / 8;
    const endX = width * 7 / 8;

    // Draw vertical gridlines
    for (let s = -3; s <= 3; s += 0.5) {
      const x = width / 2 + (s * width / 8);
      const isFullSigma = s % 1 === 0;

      ctx.strokeStyle = isFullSigma ? 'rgba(120, 53, 15, 0.4)' : 'rgba(120, 53, 15, 0.2)';
      ctx.lineWidth = isFullSigma ? 1 : 0.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, height * 0.75);
      ctx.stroke();
    }

    // Draw bell curve
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = startX; x <= endX; x++) {
      const sigma = ((x - startX) / (endX - startX)) * sigmaRange - 3;
      const y = height * 0.75 - (height * 0.5 * Math.exp(-(sigma * sigma) / 2));

      if (x === startX) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw sigma markers
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#a16207';

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
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 50);
    ctx.lineTo(width / 2, height * 0.75);
    ctx.stroke();
    ctx.setLineDash([]);

    const baselineY = height * 0.5;

    // Draw data points for each athlete
    allAthletesMetrics.forEach(({ athlete, colorIndex, metrics }) => {
      const displayMetrics = mergeReciprocals(metrics);
      const colors = ATHLETE_COLORS[colorIndex];

      displayMetrics.forEach((metric) => {
        const sigma = Math.max(-4, Math.min(4, metric.sigma));
        const x = width / 2 + (sigma * width / 8);
        const y = baselineY + metric.jitter;

        const isHovered = (hoveredPoint &&
                         Math.abs(hoveredPoint.x - x) < 1 &&
                         Math.abs(hoveredPoint.y - y) < 1) ||
                         (hoveredCardMetric === metric.formula);

        const isSelected = selectedMetrics.some(sm => sm.formula === metric.formula);

        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (isHovered) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = colors.fill;
          ctx.strokeStyle = colors.stroke;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        metric.x = x;
        metric.y = y;
      });
    });

    // Draw hover legend
    if (hoveredMetricInfo) {
      const legendX = width - 250;
      const legendY = 20;
      const legendWidth = 230;
      const legendHeight = 90;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
      ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#a16207';
      ctx.textAlign = 'left';

      const labelX = legendX + 10;
      const valueX = legendX + 80;
      let currentY = legendY + 25;

      ctx.fillText('Metric:', labelX, currentY);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(hoveredMetricInfo.formula, valueX, currentY);

      currentY += 25;
      ctx.fillStyle = '#a16207';
      ctx.fillText('σ:', labelX, currentY);
      ctx.fillStyle = hoveredMetricInfo.sigma > 0 ? '#f97316' : '#dc2626';
      ctx.fillText(`${hoveredMetricInfo.sigma > 0 ? '+' : ''}${hoveredMetricInfo.sigma.toFixed(2)}`, valueX, currentY);

      currentY += 25;
      ctx.fillStyle = '#a16207';
      ctx.fillText('Actual:', labelX, currentY);
      ctx.fillStyle = '#fbbf24';
      const units = getMetricUnits(hoveredMetricInfo.formula);
      ctx.fillText(`${hoveredMetricInfo.value.toFixed(3)} ${units}`, valueX, currentY);

      ctx.textAlign = 'start';
    }

    // Draw athlete legend if multiple selected
    if (allAthletesMetrics.length > 1) {
      const legendX = 20;
      let legendY = 20;

      ctx.font = 'bold 11px sans-serif';
      allAthletesMetrics.forEach(({ athlete, colorIndex }) => {
        const colors = ATHLETE_COLORS[colorIndex];

        ctx.fillStyle = colors.fill;
        ctx.beginPath();
        ctx.arc(legendX + 6, legendY + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`${athlete.firstName} ${athlete.lastName}`, legendX + 18, legendY + 10);
        legendY += 20;
      });
    }
  };

  useEffect(() => {
    if (allAthletesMetrics.length > 0 && canvasRef.current) {
      drawBellCurve();
    }
  }, [allAthletesMetrics, hoveredPoint, hoveredMetricInfo, selectedMetrics, hoveredCardMetric]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const { metrics } of allAthletesMetrics) {
      const displayMetrics = mergeReciprocals(metrics);
      const clicked = displayMetrics.find(m => {
        const dist = Math.sqrt(Math.pow(x - m.x, 2) + Math.pow(y - m.y, 2));
        return dist < 10;
      });

      if (clicked) {
        toggleMetricSelection(clicked);
        return;
      }
    }
  };

  const toggleMetricSelection = (metric) => {
    const alreadySelected = selectedMetrics.some(sm => sm.formula === metric.formula);

    if (alreadySelected) {
      setSelectedMetrics(prev => prev.filter(sm => sm.formula !== metric.formula));
      removeForgedAxis(metric.formula);
    } else {
      setSelectedMetrics(prev => [...prev, metric]);
      addForgedAxis(metric.formula, metric.formula);
    }
  };

  const handleCanvasHover = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const { metrics } of allAthletesMetrics) {
      const displayMetrics = mergeReciprocals(metrics);
      const hovered = displayMetrics.find(m => {
        const dist = Math.sqrt(Math.pow(x - m.x, 2) + Math.pow(y - m.y, 2));
        return dist < 10;
      });

      if (hovered) {
        if (!hoveredPoint || hoveredPoint.x !== hovered.x || hoveredPoint.y !== hovered.y) {
          setHoveredPoint({ x: hovered.x, y: hovered.y });
        }
        setHoveredMetricInfo({
          formula: hovered.formula,
          sigma: hovered.sigma,
          value: hovered.value
        });
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    if (hoveredPoint) setHoveredPoint(null);
    if (hoveredMetricInfo) setHoveredMetricInfo(null);
    canvas.style.cursor = 'default';
  };

  const filteredAthletes = searchQuery
    ? dataService.searchAthletes(searchQuery)
    : athletes;

  const selectedAthleteObjects = athletes.filter(a => selectedAthletes.includes(a.id));
  const unselectedAthletes = filteredAthletes.filter(a => !selectedAthletes.includes(a.id));

  // Get metrics for display
  const primaryAthleteMetrics = allAthletesMetrics.length > 0 ? allAthletesMetrics[0].metrics : [];
  const sortedMetrics = [...primaryAthleteMetrics].sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma));
  const extremeMetrics = mergeReciprocals(sortedMetrics.filter(m => Math.abs(m.sigma) >= 1.5));

  // FEATURE #5: Split into positive/negative columns
  const positiveMetrics = extremeMetrics.filter(m => m.sigma > 0);
  const negativeMetrics = extremeMetrics.filter(m => m.sigma < 0);

  // FEATURE #4: Card click handler
  const handleCardClick = (metric) => {
    toggleMetricSelection(metric);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* FEATURE #7: Optimized sidebar width */}
      <div style={{
        width: '280px',
        background: '#1e293b',
        borderRight: '1px solid #78350f',
        padding: '0.75rem',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#fb923c' }}>Athletes</h3>

        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.4rem',
            marginBottom: '0.75rem',
            background: '#0f172a',
            border: '1px solid #78350f',
            borderRadius: '0.375rem',
            color: '#fbbf24',
            fontSize: '0.85rem'
          }}
        />

        {/* Selected Athletes Section */}
        {selectedAthleteObjects.length > 0 && (
          <div style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            background: '#422006',
            borderRadius: '0.5rem',
            border: '2px solid #ea580c'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <h4 style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: '600' }}>
                ✓ Selected ({selectedAthleteObjects.length})
              </h4>
              <button
                onClick={clearSelectedAthletes}
                style={{
                  padding: '0.2rem 0.4rem',
                  background: '#7c2d12',
                  border: '1px solid #ea580c',
                  borderRadius: '0.25rem',
                  color: '#fdba74',
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>

            {selectedAthleteObjects.map((athlete, index) => {
              const bands = calculateSigmaBands(athlete);
              const colorIndex = index % ATHLETE_COLORS.length;
              const colors = ATHLETE_COLORS[colorIndex];

              return (
                <div
                  key={athlete.id}
                  onClick={() => setSelectedAthlete(athlete)}
                  style={{
                    padding: '0.4rem',
                    marginBottom: '0.25rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    background: selectedAthlete?.id === athlete.id ? '#7c2d12' : '#292524',
                    border: `2px solid ${colors.fill}`,
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleAthleteSelection(athlete.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', accentColor: colors.fill }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {athlete.firstName} {athlete.lastName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#a16207' }}>
                        {athlete.position} • {athlete.state}
                      </div>
                    </div>
                  </div>

                  {/* FEATURE #7: Left-justified sigma bands */}
                  <div style={{
                    display: 'flex',
                    gap: '0.25rem',
                    marginTop: '0.35rem',
                    fontSize: '0.65rem',
                    justifyContent: 'flex-start',
                    fontFamily: 'monospace'
                  }}>
                    <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus3 || '-'}</span>
                    <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus2 || '-'}</span>
                    <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus1 || '-'}</span>
                    <span style={{ color: '#94a3b8', width: '14px' }}>{bands.zero || '-'}</span>
                    <span style={{ color: '#10b981', width: '14px' }}>{bands.plus1 || '-'}</span>
                    <span style={{ color: '#10b981', width: '14px' }}>{bands.plus2 || '-'}</span>
                    <span style={{ color: '#10b981', width: '14px' }}>{bands.plus3 || '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* All Athletes List */}
        <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.4rem' }}>
          {unselectedAthletes.length} athletes
        </div>

        {unselectedAthletes.slice(0, 50).map(athlete => {
          const bands = calculateSigmaBands(athlete);

          return (
            <div
              key={athlete.id}
              onClick={() => setSelectedAthlete(athlete)}
              style={{
                padding: '0.5rem',
                marginBottom: '0.2rem',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={selectedAthletes.includes(athlete.id)}
                  onChange={() => toggleAthleteSelection(athlete.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {athlete.firstName} {athlete.lastName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#a16207' }}>
                    {athlete.position} • {athlete.state} • {athlete.gradYear}
                  </div>
                </div>
              </div>

              {/* FEATURE #7: Left-justified sigma bands */}
              <div style={{
                display: 'flex',
                gap: '0.25rem',
                marginTop: '0.35rem',
                fontSize: '0.65rem',
                justifyContent: 'flex-start',
                fontFamily: 'monospace'
              }}>
                <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus3 || '-'}</span>
                <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus2 || '-'}</span>
                <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus1 || '-'}</span>
                <span style={{ color: '#94a3b8', width: '14px' }}>{bands.zero || '-'}</span>
                <span style={{ color: '#10b981', width: '14px' }}>{bands.plus1 || '-'}</span>
                <span style={{ color: '#10b981', width: '14px' }}>{bands.plus2 || '-'}</span>
                <span style={{ color: '#10b981', width: '14px' }}>{bands.plus3 || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        {allAthletesMetrics.length > 0 ? (
          <>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: '#fb923c' }}>
                  💎 Freak Finder
                  {allAthletesMetrics.length === 1 && `: ${allAthletesMetrics[0].athlete.firstName} ${allAthletesMetrics[0].athlete.lastName}`}
                  {allAthletesMetrics.length > 1 && ` (${allAthletesMetrics.length} Athletes)`}
                </h2>
                <div style={{ color: '#a16207', fontSize: '0.9rem' }}>
                  Analyzing {primaryAthleteMetrics.length} metrics • {extremeMetrics.length} exceptional found
                </div>
              </div>
              {allAthletesMetrics.length === 1 && (
                <button
                  onClick={() => exportAthleteToPDF(allAthletesMetrics[0].athlete, primaryAthleteMetrics, dataService.getStatistics())}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: '#ea580c',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#fef3c7',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  📄 Export Report
                </button>
              )}
            </div>

            {/* Bell Curve */}
            <div style={{
              background: '#1e293b',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem',
              borderLeft: '4px solid #ea580c'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fb923c' }}>
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
                marginTop: '0.75rem',
                fontSize: '0.8rem',
                color: '#a16207',
                display: 'flex',
                gap: '1.5rem',
                justifyContent: 'center'
              }}>
                <div>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>●</span> Standard Metrics
                </div>
                <div>
                  <span style={{ color: '#fb923c', fontWeight: 'bold' }}>●</span> Calculated Ratios
                </div>
                <div style={{ color: '#fbbf24', fontSize: '0.75rem' }}>
                  Click points or cards to add to Forged Profile
                </div>
              </div>
            </div>

            {/* FEATURE #5: Two-column layout for positive/negative metrics */}
            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
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
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {/* NEGATIVE SIGMA COLUMN (Left) */}
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                      ▼ Below Average
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {negativeMetrics.map((metric, index) => (
                        <MetricCard
                          key={index}
                          metric={metric}
                          units={getMetricUnits(metric.formula)}
                          explanation={METRIC_EXPLANATIONS[metric.metricKey] || METRIC_EXPLANATIONS[metric.formula.toLowerCase().replace(/ /g, '').replace(/-/g, '')] || 'This metric provides insight into athletic performance.'}
                          isSelected={selectedMetrics.some(sm => sm.formula === metric.formula)}
                          onClick={() => handleCardClick(metric)}
                          onMouseEnter={() => setHoveredCardMetric(metric.formula)}
                          onMouseLeave={() => setHoveredCardMetric(null)}
                          athleteCount={allAthletesMetrics.length}
                          allAthletesData={allAthletesMetrics}
                        />
                      ))}
                      {negativeMetrics.length === 0 && (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                          No negative outliers
                        </div>
                      )}
                    </div>
                  </div>

                  {/* POSITIVE SIGMA COLUMN (Right) */}
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: '#f97316', fontSize: '0.9rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                      ▲ Above Average
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {positiveMetrics.map((metric, index) => (
                        <MetricCard
                          key={index}
                          metric={metric}
                          units={getMetricUnits(metric.formula)}
                          explanation={METRIC_EXPLANATIONS[metric.metricKey] || METRIC_EXPLANATIONS[metric.formula.toLowerCase().replace(/ /g, '').replace(/-/g, '')] || 'This metric provides insight into athletic performance.'}
                          isSelected={selectedMetrics.some(sm => sm.formula === metric.formula)}
                          onClick={() => handleCardClick(metric)}
                          onMouseEnter={() => setHoveredCardMetric(metric.formula)}
                          onMouseLeave={() => setHoveredCardMetric(null)}
                          athleteCount={allAthletesMetrics.length}
                          allAthletesData={allAthletesMetrics}
                        />
                      ))}
                      {positiveMetrics.length === 0 && (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                          No positive outliers
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            Select an athlete or check boxes to compare multiple athletes
          </div>
        )}
      </div>
    </div>
  );
}

// FEATURE #4 & #5: MetricCard component with click-to-select and multi-athlete display
function MetricCard({ metric, units, explanation, isSelected, onClick, onMouseEnter, onMouseLeave, athleteCount, allAthletesData }) {
  const getMetricForAthlete = (athleteData) => {
    return athleteData.metrics.find(m => m.formula === metric.formula);
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: isSelected ? '#422006' : '#1e293b',
        padding: '1rem',
        borderRadius: '0.5rem',
        borderLeft: `4px solid ${metric.sigma > 0 ? '#f97316' : '#dc2626'}`,
        border: isSelected ? '2px solid #ea580c' : undefined,
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.4rem' }}>
            {metric.formula}
          </div>

          {athleteCount > 1 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {allAthletesData.map(({ athlete, colorIndex, metrics }) => {
                const athleteMetric = getMetricForAthlete({ metrics });
                if (!athleteMetric) return null;
                const colors = ATHLETE_COLORS[colorIndex];
                return (
                  <div key={athlete.id} style={{
                    padding: '0.25rem 0.5rem',
                    background: '#0f172a',
                    borderRadius: '0.25rem',
                    borderLeft: `3px solid ${colors.fill}`,
                    fontSize: '0.8rem'
                  }}>
                    <span style={{ color: '#a16207' }}>{athlete.firstName.charAt(0)}{athlete.lastName.charAt(0)}: </span>
                    <span style={{ color: '#fbbf24' }}>{athleteMetric.value.toFixed(2)}</span>
                    <span style={{ color: athleteMetric.sigma > 0 ? '#f97316' : '#dc2626', marginLeft: '0.25rem' }}>
                      ({athleteMetric.sigma > 0 ? '+' : ''}{athleteMetric.sigma.toFixed(1)}σ)
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
              {typeof metric.value === 'number' ? metric.value.toFixed(3) : metric.value} {units}
            </div>
          )}
        </div>
        <div>
          <div style={{
            fontSize: '1.3rem',
            fontWeight: 'bold',
            color: metric.sigma > 0 ? '#f97316' : '#dc2626'
          }}>
            {metric.sigma > 0 ? '+' : ''}{metric.sigma.toFixed(2)}σ
          </div>
          {isSelected && (
            <div style={{ fontSize: '0.7rem', color: '#10b981', textAlign: 'right', marginTop: '0.25rem' }}>
              ✓ Selected
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: '0.6rem',
        padding: '0.6rem',
        background: '#0f172a',
        borderRadius: '0.375rem',
        fontSize: '0.8rem',
        color: '#cbd5e1',
        lineHeight: '1.4'
      }}>
        {explanation}
      </div>
    </div>
  );
}

export default FreakFinder;