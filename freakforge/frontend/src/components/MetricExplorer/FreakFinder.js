import React, { useState, useEffect, useRef, useMemo } from 'react';
import dataService from '../../utils/dataService';
import { exportAthleteToPDF } from '../../utils/pdfExport';
import { useAppContext } from '../../context/AppContext';

// Color palette for multi-athlete comparison
const ATHLETE_COLORS = [
  { fill: 'rgba(239, 68, 68, 1)', stroke: '#ffffff', name: 'Red' },
  { fill: 'rgba(59, 130, 246, 1)', stroke: '#ffffff', name: 'Blue' },
  { fill: 'rgba(16, 185, 129, 1)', stroke: '#ffffff', name: 'Green' },
  { fill: 'rgba(245, 158, 11, 1)', stroke: '#ffffff', name: 'Amber' },
  { fill: 'rgba(139, 92, 246, 1)', stroke: '#ffffff', name: 'Purple' },
];

// Metric type classification
const PERSONAL_METRICS = ['height', 'weight', 'age', 'handWidth', 'gpa', 'armLength', 'wingspan'];
const ATHLETIC_METRICS = ['dash40', 'verticalJump', 'broadJump', 'proAgility', 'lDrill', 'bench225', 'maxBench', 'squat', 'powerClean'];

const MAX_FORGED_AXES = 8;

// Graph layout constants
const GRAPH_START_PERCENT = 12.5;
const GRAPH_END_PERCENT = 87.5;

function FreakFinder() {
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [hoveredMetricInfo, setHoveredMetricInfo] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredCardMetric, setHoveredCardMetric] = useState(null);
  const [hoveredAthleteColor, setHoveredAthleteColor] = useState(null);
  const [maxAxesMessage, setMaxAxesMessage] = useState(false);

  const [showPersonal, setShowPersonal] = useState(false);
  const [showAthletic, setShowAthletic] = useState(true);
  const [showForged, setShowForged] = useState(true);

  const [zScoreFilterLow, setZScoreFilterLow] = useState(0);
  const [zScoreFilterHigh, setZScoreFilterHigh] = useState(0);
  const [applyFiltersToList, setApplyFiltersToList] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState(null);

  const canvasRef = useRef(null);
  const sliderContainerRef = useRef(null);
  const drawnMetricsRef = useRef([]);

  const { selectedAthletes, toggleAthleteSelection, clearSelectedAthletes, addForgedAxis, removeForgedAxis, forgedAxes } = useAppContext();
  const jitterMapRef = useRef(new Map());

  useEffect(() => {
    dataService.loadData().then(data => {
      setAthletes(data.athletes);
      if (data.athletes.length > 0) setSelectedAthlete(data.athletes[0]);
    });
  }, []);

  useEffect(() => {
    if (maxAxesMessage) {
      const timer = setTimeout(() => setMaxAxesMessage(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [maxAxesMessage]);

  const getJitter = (athleteId, metricFormula) => {
    const key = `${athleteId}-${metricFormula}`;
    if (!jitterMapRef.current.has(key)) {
      jitterMapRef.current.set(key, (Math.random() - 0.5) * 140);
    }
    return jitterMapRef.current.get(key);
  };

  const getMetricType = (metric) => {
    if (metric.isStandard) {
      if (PERSONAL_METRICS.includes(metric.metricKey)) return 'personal';
      if (ATHLETIC_METRICS.includes(metric.metricKey)) return 'athletic';
    }
    return 'forged';
  };

  const isMetricVisible = (metric) => {
    const metricType = getMetricType(metric);
    if (metricType === 'personal' && !showPersonal) return false;
    if (metricType === 'athletic' && !showAthletic) return false;
    if (metricType === 'forged' && !showForged) return false;
    if (zScoreFilterLow !== 0 || zScoreFilterHigh !== 0) {
      if (metric.sigma > zScoreFilterLow && metric.sigma < zScoreFilterHigh) return false;
    }
    return true;
  };

  const getMetricUnits = (formula) => {
    const parts = formula.split(' / ');
    if (parts.length !== 2) {
      const unitMap = { '40-Yard Dash': 'sec', 'Vertical Jump': 'in', 'Broad Jump': 'in', 'Pro Agility': 'sec', 'L-Drill': 'sec', 'Height': 'in', 'Weight': 'lbs' };
      return unitMap[formula] || '';
    }
    const numeratorUnits = { '40-Yard Dash': 'sec', 'Vertical Jump': 'in', 'Broad Jump': 'in', 'Pro Agility': 'sec', 'L-Drill': 'sec', 'Height': 'in', 'Weight': 'lbs' };
    const num = numeratorUnits[parts[0]] || '';
    const den = numeratorUnits[parts[1]] || '';
    return num && den ? `${num}/${den}` : '';
  };

  const isReciprocal = (m1, m2) => {
    const p1 = m1.formula.split(' / ');
    const p2 = m2.formula.split(' / ');
    if (p1.length !== 2 || p2.length !== 2) return false;
    return p1[0] === p2[1] && p1[1] === p2[0];
  };

  const getPreferredMetric = (m1, m2) => {
    const time = ['40-Yard Dash', 'Pro Agility', 'L-Drill'];
    const p1 = m1.formula.split(' / ');
    const p2 = m2.formula.split(' / ');
    if (time.includes(p1[1]) && !time.includes(p2[1])) return [m1, m2];
    if (time.includes(p2[1]) && !time.includes(p1[1])) return [m2, m1];
    if (p1[1] === 'Weight' && p2[1] !== 'Weight') return [m1, m2];
    if (p2[1] === 'Weight' && p1[1] !== 'Weight') return [m2, m1];
    return [m1, m2];
  };

  const calculateSigmaBands = (athlete) => {
    const metrics = calculateMetricsForAthlete(athlete);
    const bands = { minus3: 0, minus2: 0, minus1: 0, zero: 0, plus1: 0, plus2: 0, plus3: 0 };
    metrics.forEach(m => {
      const s = m.sigma;
      if (s < -3) bands.minus3++;
      else if (s < -2) bands.minus2++;
      else if (s < -1) bands.minus1++;
      else if (s < 1) bands.zero++;
      else if (s < 2) bands.plus1++;
      else if (s < 3) bands.plus2++;
      else bands.plus3++;
    });
    return bands;
  };

  const calculateMetricsForAthlete = (athlete) => {
    const metrics = [
      { key: 'dash40', name: '40-Yard Dash' },
      { key: 'verticalJump', name: 'Vertical Jump' },
      { key: 'broadJump', name: 'Broad Jump' },
      { key: 'proAgility', name: 'Pro Agility' },
      { key: 'lDrill', name: 'L-Drill' },
      { key: 'height', name: 'Height' },
      { key: 'weight', name: 'Weight' }
    ];
    const calculated = [];

    metrics.forEach(metric => {
      const value = athlete[metric.key];
      if (value) {
        calculated.push({
          formula: metric.name,
          value,
          sigma: dataService.calculateSigma(metric.key, value),
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
        const num = metrics[i], den = metrics[j];
        const nv = athlete[num.key], dv = athlete[den.key];
        if (nv && dv && dv !== 0) {
          const ratio = nv / dv;
          const allRatios = athletes.map(a => {
            const n = a[num.key], d = a[den.key];
            return (n && d && d !== 0) ? n / d : null;
          }).filter(r => r !== null);

          if (allRatios.length > 1) {
            const mean = allRatios.reduce((a, b) => a + b, 0) / allRatios.length;
            const variance = allRatios.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allRatios.length;
            const std = Math.sqrt(variance);
            if (std > 0) {
              const formula = `${num.name} / ${den.name}`;
              calculated.push({
                formula,
                value: ratio,
                sigma: (ratio - mean) / std,
                isStandard: false,
                numeratorKey: num.key,
                denominatorKey: den.key,
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
      let recipIdx = -1;
      for (let i = idx + 1; i < metrics.length; i++) {
        if (used.has(i)) continue;
        if (isReciprocal(metric, metrics[i])) { recipIdx = i; break; }
      }
      if (recipIdx !== -1) {
        const recip = metrics[recipIdx];
        const [pref, other] = getPreferredMetric(metric, recip);
        processed.push({ ...pref, hasReciprocal: true, reciprocalFormula: other.formula, reciprocalSigma: other.sigma, reciprocalValue: other.value });
        used.add(idx);
        used.add(recipIdx);
      } else {
        processed.push(metric);
        used.add(idx);
      }
    });
    return processed;
  };

  const drawForgedSymbol = (ctx, x, y, color, isHovered, isSelected) => {
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (isHovered && !isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    const drawColor = isHovered ? '#fbbf24' : color;
    ctx.fillStyle = drawColor;
    ctx.font = 'italic bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('f', x, y);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.stroke();
  };

  const drawMetricShape = (ctx, x, y, metricType, color, isHovered, isSelected) => {
    const size = 6;
    if (metricType === 'forged') { drawForgedSymbol(ctx, x, y, color, isHovered, isSelected); return; }
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      if (metricType === 'personal') {
        ctx.beginPath(); ctx.moveTo(x, y - size - 3); ctx.lineTo(x + size + 3, y + size + 2); ctx.lineTo(x - size - 3, y + size + 2); ctx.closePath(); ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(x, y, size + 3, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (isHovered && !isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      if (metricType === 'personal') {
        ctx.beginPath(); ctx.moveTo(x, y - size - 1); ctx.lineTo(x + size + 1, y + size); ctx.lineTo(x - size - 1, y + size); ctx.closePath(); ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(x, y, size + 1, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.fillStyle = isHovered ? '#fbbf24' : color;
    if (metricType === 'personal') {
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y + size - 1); ctx.lineTo(x - size, y + size - 1); ctx.closePath(); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); }
  };

  const drawBellCurve = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const startX = width * GRAPH_START_PERCENT / 100;
    const endX = width * GRAPH_END_PERCENT / 100;
    const graphWidth = endX - startX;

    for (let s = -3; s <= 3; s += 0.5) {
      const x = startX + ((s + 3) / 6) * graphWidth;
      const isFullSigma = s % 1 === 0;
      ctx.strokeStyle = isFullSigma ? 'rgba(234, 88, 12, 0.7)' : 'rgba(180, 83, 9, 0.4)';
      ctx.lineWidth = isFullSigma ? 2 : 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, height * 0.72);
      ctx.stroke();
    }

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = startX; px <= endX; px++) {
      const sigma = ((px - startX) / graphWidth) * 6 - 3;
      const y = height * 0.72 - (height * 0.42 * Math.exp(-(sigma * sigma) / 2));
      if (px === startX) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#f59e0b';
    for (let s = -3; s <= 3; s++) {
      const x = startX + ((s + 3) / 6) * graphWidth;
      const label = s > 0 ? `+${s}σ` : s === 0 ? '0σ' : `${s}σ`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x, height * 0.72 + 16);
    }

    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(startX + graphWidth / 2, 35);
    ctx.lineTo(startX + graphWidth / 2, height * 0.72);
    ctx.stroke();
    ctx.setLineDash([]);

    if (draggingHandle) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      if (draggingHandle === 'low' || draggingHandle === 'both') {
        const lowX = startX + ((zScoreFilterLow + 3) / 6) * graphWidth;
        ctx.beginPath(); ctx.moveTo(lowX, 20); ctx.lineTo(lowX, height * 0.72); ctx.stroke();
      }
      if (draggingHandle === 'high' || draggingHandle === 'both') {
        const highX = startX + ((zScoreFilterHigh + 3) / 6) * graphWidth;
        ctx.beginPath(); ctx.moveTo(highX, 20); ctx.lineTo(highX, height * 0.72); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    const baselineY = height * 0.40;
    drawnMetricsRef.current = [];

    allAthletesMetrics.forEach(({ athlete, colorIndex, metrics }) => {
      const displayMetrics = mergeReciprocals(metrics);
      const colors = ATHLETE_COLORS[colorIndex];
      displayMetrics.forEach((metric) => {
        if (!isMetricVisible(metric)) return;
        const sigma = Math.max(-3.5, Math.min(3.5, metric.sigma));
        const x = startX + ((sigma + 3) / 6) * graphWidth;
        const y = baselineY + metric.jitter;
        const isHovered = hoveredCardMetric === metric.formula || (hoveredPoint && Math.abs(hoveredPoint.x - x) < 2 && Math.abs(hoveredPoint.y - y) < 2);
        const isSelected = selectedMetrics.some(sm => sm.formula === metric.formula);
        drawMetricShape(ctx, x, y, getMetricType(metric), colors.fill, isHovered, isSelected);
        drawnMetricsRef.current.push({ x, y, formula: metric.formula, sigma: metric.sigma, value: metric.value, colorIndex, athleteId: athlete.id });
      });
    });

    if (hoveredMetricInfo) {
      const legendX = width - 220, legendY = 12, legendWidth = 205, legendHeight = 80;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = hoveredAthleteColor || '#ea580c';
      ctx.lineWidth = 2;
      ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
      ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      const labelX = legendX + 8, valueX = legendX + 60;
      let currentY = legendY + 20;
      ctx.fillStyle = '#a16207';
      ctx.fillText('Metric:', labelX, currentY);
      ctx.fillStyle = hoveredAthleteColor || '#fbbf24';
      ctx.fillText(hoveredMetricInfo.formula, valueX, currentY);
      currentY += 20;
      ctx.fillStyle = '#a16207';
      ctx.fillText('σ:', labelX, currentY);
      ctx.fillStyle = hoveredMetricInfo.sigma > 0 ? '#22c55e' : '#ef4444';
      ctx.fillText(`${hoveredMetricInfo.sigma > 0 ? '+' : ''}${hoveredMetricInfo.sigma.toFixed(2)}`, valueX, currentY);
      currentY += 20;
      ctx.fillStyle = '#a16207';
      ctx.fillText('Actual:', labelX, currentY);
      ctx.fillStyle = hoveredAthleteColor || '#fbbf24';
      ctx.fillText(`${hoveredMetricInfo.value.toFixed(3)} ${getMetricUnits(hoveredMetricInfo.formula)}`, valueX, currentY);
    }

    if (allAthletesMetrics.length > 1) {
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      allAthletesMetrics.forEach(({ athlete, colorIndex }, idx) => {
        const colors = ATHLETE_COLORS[colorIndex];
        const isHighlighted = hoveredAthleteColor === colors.fill;
        const legendY = 18 + idx * 18;
        ctx.fillStyle = colors.fill;
        ctx.beginPath();
        ctx.arc(18, legendY, isHighlighted ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        if (isHighlighted) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = isHighlighted ? colors.fill : '#fb923c';
        ctx.fillText(`${athlete.firstName} ${athlete.lastName}`, 28, legendY + 4);
      });
    }
  };

  useEffect(() => {
    if (allAthletesMetrics.length > 0 && canvasRef.current) drawBellCurve();
  }, [allAthletesMetrics, hoveredPoint, hoveredMetricInfo, selectedMetrics, hoveredCardMetric, hoveredAthleteColor, showPersonal, showAthletic, showForged, zScoreFilterLow, zScoreFilterHigh, draggingHandle]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const drawn of drawnMetricsRef.current) {
      const dist = Math.sqrt(Math.pow(x - drawn.x, 2) + Math.pow(y - drawn.y, 2));
      if (dist < 15) {
        const metric = allAthletesMetrics.flatMap(am => am.metrics).find(m => m.formula === drawn.formula);
        if (metric) { toggleMetricSelection(metric); return; }
      }
    }
  };

  const toggleMetricSelection = (metric) => {
    const alreadySelected = selectedMetrics.some(sm => sm.formula === metric.formula);
    if (alreadySelected) {
      setSelectedMetrics(prev => prev.filter(sm => sm.formula !== metric.formula));
      removeForgedAxis(metric.formula);
    } else {
      if (forgedAxes.length >= MAX_FORGED_AXES) { setMaxAxesMessage(true); return; }
      setSelectedMetrics(prev => [...prev, metric]);
      addForgedAxis(metric.formula, metric.formula);
    }
  };

  const handleCanvasHover = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let foundHover = false;
    for (const drawn of drawnMetricsRef.current) {
      const dist = Math.sqrt(Math.pow(x - drawn.x, 2) + Math.pow(y - drawn.y, 2));
      if (dist < 15) {
        setHoveredPoint({ x: drawn.x, y: drawn.y });
        setHoveredMetricInfo({ formula: drawn.formula, sigma: drawn.sigma, value: drawn.value });
        setHoveredAthleteColor(ATHLETE_COLORS[drawn.colorIndex].fill);
        canvas.style.cursor = 'pointer';
        foundHover = true;
        break;
      }
    }
    if (!foundHover) {
      if (hoveredPoint) setHoveredPoint(null);
      if (hoveredMetricInfo) setHoveredMetricInfo(null);
      if (hoveredAthleteColor) setHoveredAthleteColor(null);
      canvas.style.cursor = 'default';
    }
  };

  const snapToHalfSigma = (value) => {
    const snapPoints = [-3, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3];
    const snapThreshold = 0.04;
    for (const snap of snapPoints) {
      if (Math.abs(value - snap) < snapThreshold) return snap;
    }
    return Math.round(value * 100) / 100;
  };

  const handleSliderDrag = (handle, e) => {
    e.preventDefault();
    setDraggingHandle(handle);
    const container = sliderContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const sliderStart = rect.width * GRAPH_START_PERCENT / 100;
    const sliderEnd = rect.width * GRAPH_END_PERCENT / 100;
    const sliderWidth = sliderEnd - sliderStart;
    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - rect.left - sliderStart;
      const percent = Math.max(0, Math.min(1, x / sliderWidth));
      const rawValue = percent * 6 - 3;
      const snappedValue = snapToHalfSigma(rawValue);
      if (handle === 'low') { if (snappedValue <= zScoreFilterHigh) setZScoreFilterLow(snappedValue); }
      else { if (snappedValue >= zScoreFilterLow) setZScoreFilterHigh(snappedValue); }
    };
    const onMouseUp = () => {
      setDraggingHandle(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const filteredAthletes = searchQuery ? dataService.searchAthletes(searchQuery) : athletes;
  const selectedAthleteObjects = athletes.filter(a => selectedAthletes.includes(a.id));
  const unselectedAthletes = filteredAthletes.filter(a => !selectedAthletes.includes(a.id));

  const getAllMetricsForCards = () => {
    if (allAthletesMetrics.length === 0) return [];
    const primaryMetrics = allAthletesMetrics[0].metrics;
    const mergedMetrics = mergeReciprocals(primaryMetrics);
    const metricsWithAllAthletes = mergedMetrics.map(metric => {
      const athleteData = allAthletesMetrics.map(({ athlete, colorIndex, metrics }) => {
        const athleteMetric = metrics.find(m => m.formula === metric.formula);
        return { athlete, colorIndex, metric: athleteMetric };
      }).filter(d => d.metric);
      const visibleAthleteData = athleteData.filter(d => isMetricVisible(d.metric));
      if (visibleAthleteData.length === 0) return null;
      const maxSigma = Math.max(...visibleAthleteData.map(d => d.metric.sigma));
      return { formula: metric.formula, metricKey: metric.metricKey, isStandard: metric.isStandard, maxSigma, athleteData: visibleAthleteData.sort((a, b) => b.metric.sigma - a.metric.sigma) };
    }).filter(m => m !== null);
    return metricsWithAllAthletes.sort((a, b) => b.maxSigma - a.maxSigma);
  };

  const allMetricsForCards = getAllMetricsForCards();
  const getSigmaColor = (sigma) => sigma > 1.5 ? '#22c55e' : sigma < -1.5 ? '#ef4444' : '#fbbf24';

  const renderSidebar = () => (
    <div style={{ width: '280px', background: '#1e293b', borderRight: '1px solid #78350f', padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#fb923c' }}>Athletes</h3>
      <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.4rem', marginBottom: '0.75rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }} />

      {selectedAthleteObjects.length > 0 && (
        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#422006', borderRadius: '0.5rem', border: '2px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: '600' }}>✓ Selected ({selectedAthleteObjects.length})</h4>
            <button onClick={clearSelectedAthletes} style={{ padding: '0.2rem 0.4rem', background: '#7c2d12', border: '1px solid #ea580c', borderRadius: '0.25rem', color: '#fdba74', fontSize: '0.7rem', cursor: 'pointer' }}>Clear</button>
          </div>
          {selectedAthleteObjects.map((athlete, index) => {
            const bands = calculateSigmaBands(athlete);
            const colorIndex = index % ATHLETE_COLORS.length;
            const colors = ATHLETE_COLORS[colorIndex];
            return (
              <div key={athlete.id} style={{ padding: '0.4rem', marginBottom: '0.25rem', borderRadius: '0.375rem', background: '#292524', border: `2px solid ${colors.fill}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={true} onChange={() => toggleAthleteSelection(athlete.id)} style={{ cursor: 'pointer', accentColor: colors.fill }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{athlete.firstName} {athlete.lastName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#a16207' }}>{athlete.position} • {athlete.state}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.65rem', fontFamily: 'monospace' }}>
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

      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', color: '#a16207' }}>
        <span style={{ fontWeight: '600' }}>σ:</span>
        <span style={{ color: '#ef4444' }}>3-</span>
        <span style={{ color: '#ef4444' }}>2-</span>
        <span style={{ color: '#ef4444' }}>1-</span>
        <span style={{ color: '#94a3b8' }}>±1</span>
        <span style={{ color: '#10b981' }}>1+</span>
        <span style={{ color: '#10b981' }}>2+</span>
        <span style={{ color: '#10b981' }}>3+</span>
      </div>

      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
        <input type="checkbox" checked={applyFiltersToList} onChange={() => setApplyFiltersToList(!applyFiltersToList)} style={{ cursor: 'pointer', accentColor: '#ea580c' }} />
        <span style={{ color: '#a16207' }}>Apply filters to list</span>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.4rem' }}>{unselectedAthletes.length} athletes</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {unselectedAthletes.slice(0, 50).map(athlete => {
          const bands = calculateSigmaBands(athlete);
          return (
            <div key={athlete.id} style={{ padding: '0.5rem', marginBottom: '0.2rem', borderRadius: '0.375rem', cursor: 'pointer', background: 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#422006'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={selectedAthletes.includes(athlete.id)} onChange={() => toggleAthleteSelection(athlete.id)} onClick={(e) => e.stopPropagation()} style={{ cursor: 'pointer', accentColor: '#ea580c' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{athlete.firstName} {athlete.lastName}</div>
                  <div style={{ fontSize: '0.7rem', color: '#a16207' }}>{athlete.position} • {athlete.state} • {athlete.gradYear}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.65rem', fontFamily: 'monospace' }}>
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
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {renderSidebar()}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {allAthletesMetrics.length > 0 ? (
          <>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid #78350f' }}>
              {allAthletesMetrics.length === 1 && (
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => exportAthleteToPDF(allAthletesMetrics[0].athlete, allAthletesMetrics[0].metrics, dataService.getStatistics())} style={{ padding: '0.4rem 0.8rem', background: '#ea580c', border: 'none', borderRadius: '0.375rem', color: '#fef3c7', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>📄 Export</button>
                </div>
              )}
              {maxAxesMessage && (<div style={{ marginBottom: '0.5rem', padding: '0.4rem 0.6rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.8rem' }}>⚠️ Maximum {MAX_FORGED_AXES} axes selected</div>)}
              <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.5rem', borderLeft: '4px solid #ea580c' }}>
                <canvas ref={canvasRef} onClick={handleCanvasClick} onMouseMove={handleCanvasHover} style={{ width: '100%', height: '280px', borderRadius: '0.375rem' }} />
                <div ref={sliderContainerRef} style={{ marginTop: '0.25rem', position: 'relative', height: '20px' }}>
                  <div style={{ position: 'absolute', top: '8px', left: `${GRAPH_START_PERCENT}%`, width: `${GRAPH_END_PERCENT - GRAPH_START_PERCENT}%`, height: '4px', background: '#374151', borderRadius: '2px' }}></div>
                  <div style={{ position: 'absolute', top: '8px', left: `${GRAPH_START_PERCENT + ((zScoreFilterLow + 3) / 6) * (GRAPH_END_PERCENT - GRAPH_START_PERCENT)}%`, width: `${((zScoreFilterHigh - zScoreFilterLow) / 6) * (GRAPH_END_PERCENT - GRAPH_START_PERCENT)}%`, height: '4px', background: '#7c2d12', borderRadius: '2px' }}></div>
                  <div style={{ position: 'absolute', left: `${GRAPH_START_PERCENT + ((zScoreFilterLow + 3) / 6) * (GRAPH_END_PERCENT - GRAPH_START_PERCENT)}%`, top: '3px', width: '12px', height: '12px', background: draggingHandle === 'low' ? '#fbbf24' : '#ea580c', borderRadius: '50%', transform: 'translateX(-50%)', cursor: 'grab', border: '2px solid #fbbf24', zIndex: 3 }} onMouseDown={(e) => handleSliderDrag('low', e)} />
                  <div style={{ position: 'absolute', left: `${GRAPH_START_PERCENT + ((zScoreFilterHigh + 3) / 6) * (GRAPH_END_PERCENT - GRAPH_START_PERCENT)}%`, top: '3px', width: '12px', height: '12px', background: draggingHandle === 'high' ? '#fbbf24' : '#ea580c', borderRadius: '50%', transform: 'translateX(-50%)', cursor: 'grab', border: '2px solid #fbbf24', zIndex: 3 }} onMouseDown={(e) => handleSliderDrag('high', e)} />
                </div>
                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', opacity: showPersonal ? 1 : 0.5 }}>
                    <input type="checkbox" checked={showPersonal} onChange={() => setShowPersonal(!showPersonal)} style={{ cursor: 'pointer', accentColor: '#ea580c' }} />
                    <span style={{ color: '#fb923c' }}>▲</span><span style={{ color: '#a16207' }}>Attribute</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', opacity: showAthletic ? 1 : 0.5 }}>
                    <input type="checkbox" checked={showAthletic} onChange={() => setShowAthletic(!showAthletic)} style={{ cursor: 'pointer', accentColor: '#ea580c' }} />
                    <span style={{ color: '#fb923c' }}>●</span><span style={{ color: '#a16207' }}>Standard</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', opacity: showForged ? 1 : 0.5 }}>
                    <input type="checkbox" checked={showForged} onChange={() => setShowForged(!showForged)} style={{ cursor: 'pointer', accentColor: '#ea580c' }} />
                    <span style={{ color: '#fb923c', fontStyle: 'italic', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>f</span><span style={{ color: '#a16207' }}>Forged</span>
                  </label>
                  <span style={{ color: '#78350f' }}>|</span>
                  <span style={{ color: '#fbbf24', fontSize: '0.65rem' }}>Selected: {selectedMetrics.length}/{MAX_FORGED_AXES}</span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {allMetricsForCards.map((metricData, index) => {
                  const isSelected = selectedMetrics.some(sm => sm.formula === metricData.formula);
                  return (<MetricCard key={index} metricData={metricData} isSelected={isSelected} onClick={() => { const metric = metricData.athleteData[0]?.metric; if (metric) toggleMetricSelection(metric); }} onMouseEnter={() => setHoveredCardMetric(metricData.formula)} onMouseLeave={() => setHoveredCardMetric(null)} getSigmaColor={getSigmaColor} />);
                })}
              </div>
            </div>
          </>
        ) : (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>Select an athlete or check boxes to compare</div>)}
      </div>
    </div>
  );
}

function MetricCard({ metricData, isSelected, onClick, onMouseEnter, onMouseLeave, getSigmaColor }) {
  const { formula, athleteData, isStandard, metricKey } = metricData;
  const getTypeInfo = () => {
    if (!isStandard) return { label: 'FORGED', bg: '#7c2d12', text: '#fbbf24', symbol: 'f' };
    if (PERSONAL_METRICS.includes(metricKey)) return { label: 'ATTRIBUTE', bg: '#5b21b6', text: '#c4b5fd', symbol: '▲' };
    return { label: 'STANDARD', bg: '#374151', text: '#9ca3af', symbol: '●' };
  };
  const typeInfo = getTypeInfo();
  const sigmaToPosition = (sigma) => ((Math.max(-3, Math.min(3, sigma)) + 3) / 6) * 100;

  return (
    <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ background: isSelected ? '#422006' : '#1e293b', padding: '0.5rem 0.6rem', borderRadius: '0.375rem', borderLeft: `4px solid ${typeInfo.bg}`, border: isSelected ? '2px solid #ea580c' : undefined, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.55rem', padding: '0.1rem 0.25rem', background: typeInfo.bg, borderRadius: '0.15rem', color: typeInfo.text, fontWeight: '600', width: '55px', textAlign: 'center' }}>{typeInfo.label}</span>
        <span style={{ color: typeInfo.text, fontStyle: typeInfo.symbol === 'f' ? 'italic' : 'normal', fontFamily: typeInfo.symbol === 'f' ? 'Georgia, serif' : 'inherit', fontWeight: 'bold', fontSize: '0.8rem' }}>{typeInfo.symbol}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fbbf24', flex: 1 }}>{formula}</span>
        {isSelected && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '600' }}>✓</span>}
      </div>
      <div style={{ position: 'relative', height: '5px', background: '#0f172a', borderRadius: '2px', marginBottom: '0.25rem' }}>
        {[-3, -2, -1, 0, 1, 2, 3].map(s => (<div key={s} style={{ position: 'absolute', left: `${((s + 3) / 6) * 100}%`, top: '100%', transform: 'translateX(-50%)', fontSize: '0.45rem', color: '#64748b', marginTop: '1px' }}>{s === 0 ? '0' : `${s > 0 ? '+' : ''}${s}`}</div>))}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: '#ea580c', transform: 'translateX(-50%)' }}></div>
      </div>
      <div style={{ position: 'relative', minHeight: `${athleteData.length * 24}px`, marginTop: '0.6rem' }}>
        {athleteData.map(({ athlete, colorIndex, metric }, idx) => {
          const colors = ATHLETE_COLORS[colorIndex];
          const position = sigmaToPosition(metric.sigma);
          const sigmaColor = getSigmaColor(metric.sigma);
          return (
            <div key={athlete.id} style={{ position: 'absolute', left: `${position}%`, top: `${idx * 24}px`, transform: 'translateX(-50%)', padding: '0.15rem 0.4rem', background: '#0f172a', borderRadius: '0.15rem', borderLeft: `3px solid ${colors.fill}`, fontSize: '0.7rem', whiteSpace: 'nowrap', zIndex: athleteData.length - idx }}>
              <span style={{ color: '#fbbf24' }}>{athlete.firstName.charAt(0)}{athlete.lastName.charAt(0)}</span>
              <span style={{ color: '#fbbf24', marginLeft: '0.2rem' }}>{metric.value.toFixed(2)}</span>
              <span style={{ color: sigmaColor, marginLeft: '0.2rem', fontWeight: '600' }}>({metric.sigma > 0 ? '+' : ''}{metric.sigma.toFixed(1)}σ)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FreakFinder;