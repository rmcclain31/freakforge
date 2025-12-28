import React, { useState, useEffect } from 'react';

// Metric type classification (matching FreakFinder)
const PERSONAL_METRICS = ['height', 'weight', 'age', 'handWidth', 'gpa', 'armLength', 'wingspan'];
const ATHLETIC_METRICS = ['dash40', 'verticalJump', 'broadJump', 'proAgility', 'lDrill', 'bench225', 'maxBench', 'squat', 'powerClean'];

function Settings() {
  // Default: time-based metrics are flipped so favorable (faster) times show as positive sigma
  const [settings, setSettings] = useState({
    greenIsGood: false,
    metricFlips: {
      // Standard Athletic
      dash40: true,
      proAgility: true,
      lDrill: true,
      verticalJump: false,
      broadJump: false,
      // Attributes
      height: false,
      weight: false,
      // All Forged ratios - default to false
    }
  });

  const [activeSection, setActiveSection] = useState('standard');

  useEffect(() => {
    const saved = localStorage.getItem('freakforgeSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('freakforgeSettings', JSON.stringify(newSettings));
  };

  const handleToggleMetric = (metricKey, shouldFlip) => {
    const newSettings = {
      ...settings,
      metricFlips: {
        ...settings.metricFlips,
        [metricKey]: shouldFlip
      }
    };
    saveSettings(newSettings);
  };

  // Standard Athletic Metrics
  const standardMetrics = [
    { key: 'dash40', name: '40-Yard Dash', unit: 'sec', lowerIsBetter: true, description: 'Linear speed and acceleration' },
    { key: 'proAgility', name: 'Pro Agility', unit: 'sec', lowerIsBetter: true, description: 'Lateral quickness' },
    { key: 'lDrill', name: 'L-Drill', unit: 'sec', lowerIsBetter: true, description: 'Change of direction' },
    { key: 'verticalJump', name: 'Vertical Jump', unit: 'in', lowerIsBetter: false, description: 'Explosive leg power' },
    { key: 'broadJump', name: 'Broad Jump', unit: 'in', lowerIsBetter: false, description: 'Horizontal power' }
  ];

  // Attribute Metrics
  const attributeMetrics = [
    { key: 'height', name: 'Height', unit: 'in', lowerIsBetter: false, description: 'Physical stature' },
    { key: 'weight', name: 'Weight', unit: 'lbs', lowerIsBetter: false, description: 'Body mass' }
  ];

  // Generate ALL Forged (calculated ratio) combinations
  const baseMetrics = [
    { key: 'dash40', name: '40-Yard Dash', unit: 'sec' },
    { key: 'verticalJump', name: 'Vertical Jump', unit: 'in' },
    { key: 'broadJump', name: 'Broad Jump', unit: 'in' },
    { key: 'proAgility', name: 'Pro Agility', unit: 'sec' },
    { key: 'lDrill', name: 'L-Drill', unit: 'sec' },
    { key: 'height', name: 'Height', unit: 'in' },
    { key: 'weight', name: 'Weight', unit: 'lbs' }
  ];

  const generateForgedMetrics = () => {
    const forged = [];
    const timeMetrics = ['dash40', 'proAgility', 'lDrill'];

    for (let i = 0; i < baseMetrics.length; i++) {
      for (let j = 0; j < baseMetrics.length; j++) {
        if (i === j) continue;

        const num = baseMetrics[i];
        const den = baseMetrics[j];
        const key = `${num.key}/${den.key}`;
        const name = `${num.name} / ${den.name}`;

        // Determine if higher ratio is better
        // Generally: performance metric / size metric = higher is better
        // time metric in denominator = higher is better (more X per second)
        let lowerIsBetter = false;
        let description = '';

        if (timeMetrics.includes(num.key) && !timeMetrics.includes(den.key)) {
          // Time / Non-time: lower time per unit = better, so lower ratio is better
          lowerIsBetter = true;
          description = 'Speed efficiency ratio';
        } else if (!timeMetrics.includes(num.key) && timeMetrics.includes(den.key)) {
          // Non-time / Time: more distance per second = higher is better
          lowerIsBetter = false;
          description = 'Power-speed ratio';
        } else if (num.key === 'weight') {
          // Weight / X: context dependent
          description = 'Size ratio';
        } else if (den.key === 'weight') {
          // X / Weight: power-to-weight, higher is better
          lowerIsBetter = false;
          description = 'Power-to-weight ratio';
        } else {
          description = 'Calculated ratio';
        }

        forged.push({
          key,
          name,
          unit: `${num.unit}/${den.unit}`,
          lowerIsBetter,
          description,
          numerator: num.name,
          denominator: den.name
        });
      }
    }

    return forged;
  };

  const forgedMetrics = generateForgedMetrics();

  // Determine which column a metric belongs in
  const isInRightColumn = (metric) => {
    const isFlipped = settings.metricFlips[metric.key] || false;
    return (metric.lowerIsBetter && isFlipped) || (!metric.lowerIsBetter && !isFlipped);
  };

  const isFlippedToRight = (metric) => {
    const isFlipped = settings.metricFlips[metric.key] || false;
    return metric.lowerIsBetter && isFlipped;
  };

  // Type-specific styling
  const getTypeStyle = (type) => {
    switch(type) {
      case 'standard':
        return { bg: '#92400e', text: '#fcd34d', cardBg: '#422006', symbol: '●', label: 'STANDARD' };
      case 'attribute':
        return { bg: '#065f46', text: '#6ee7b7', cardBg: '#064e3b', symbol: '▲', label: 'ATTRIBUTE' };
      case 'forged':
        return { bg: '#5b21b6', text: '#c4b5fd', cardBg: '#4c1d95', symbol: 'f', label: 'FORGED' };
      default:
        return { bg: '#374151', text: '#9ca3af', cardBg: '#1f2937', symbol: '?', label: 'UNKNOWN' };
    }
  };

  // MetricCard component with type styling
  const MetricCard = ({ metric, type, isRightColumn }) => {
    const isFlipped = settings.metricFlips[metric.key] || false;
    const isFlippedForRight = isFlippedToRight(metric);
    const typeStyle = getTypeStyle(type);

    const cardBorderColor = isFlippedForRight ? '#f59e0b' : typeStyle.bg;
    const cardBackground = isFlippedForRight ? '#422006' : '#1e293b';

    return (
      <div style={{
        background: cardBackground,
        padding: '1rem',
        borderRadius: '0.5rem',
        borderLeft: `4px solid ${cardBorderColor}`,
        marginBottom: '0.75rem'
      }}>
        {/* Header with type badge and symbol */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#fbbf24',
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            {/* Type symbol */}
            <span style={{
              color: typeStyle.text,
              fontStyle: type === 'forged' ? 'italic' : 'normal',
              fontFamily: type === 'forged' ? 'Georgia, serif' : 'inherit',
              fontWeight: 'bold'
            }}>
              {typeStyle.symbol}
            </span>

            {metric.name}

            {/* Type badge */}
            <span style={{
              fontSize: '0.6rem',
              padding: '0.1rem 0.35rem',
              background: typeStyle.bg,
              borderRadius: '0.25rem',
              color: typeStyle.text
            }}>
              {typeStyle.label}
            </span>

            {metric.lowerIsBetter && (
              <span style={{
                fontSize: '0.6rem',
                padding: '0.1rem 0.35rem',
                background: '#7c2d12',
                borderRadius: '0.25rem',
                color: '#fdba74'
              }}>
                TIME
              </span>
            )}

            {isFlippedForRight && (
              <span style={{
                fontSize: '0.6rem',
                padding: '0.1rem 0.35rem',
                background: '#b45309',
                borderRadius: '0.25rem',
                color: '#fef3c7'
              }}>
                FLIPPED
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#a16207' }}>
            {metric.description} • {metric.unit}
          </div>
        </div>

        {/* Radio buttons */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          padding: '0.5rem 0.75rem',
          background: '#0f172a',
          borderRadius: '0.375rem'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            color: !isFlipped ? '#fbbf24' : '#64748b',
            fontWeight: !isFlipped ? '600' : '400',
            fontSize: '0.85rem'
          }}>
            <input
              type="radio"
              name={`${metric.key}-mode`}
              checked={!isFlipped}
              onChange={() => handleToggleMetric(metric.key, false)}
              style={{ cursor: 'pointer', accentColor: '#ea580c' }}
            />
            Raw
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            color: isFlipped ? '#fbbf24' : '#64748b',
            fontWeight: isFlipped ? '600' : '400',
            fontSize: '0.85rem'
          }}>
            <input
              type="radio"
              name={`${metric.key}-mode`}
              checked={isFlipped}
              onChange={() => handleToggleMetric(metric.key, true)}
              style={{ cursor: 'pointer', accentColor: '#ea580c' }}
            />
            Flip
          </label>
        </div>
      </div>
    );
  };

  // Get metrics for current section
  const getCurrentMetrics = () => {
    switch(activeSection) {
      case 'standard': return standardMetrics;
      case 'attribute': return attributeMetrics;
      case 'forged': return forgedMetrics;
      default: return [];
    }
  };

  const currentMetrics = getCurrentMetrics();
  const rightColumnMetrics = currentMetrics.filter(m => isInRightColumn(m));
  const leftColumnMetrics = currentMetrics.filter(m => !isInRightColumn(m));

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#fb923c' }}>
        ⚙️ Metric Display Settings
      </h2>
      <p style={{ color: '#a16207', marginBottom: '1.5rem' }}>
        Configure how sigma values are displayed on the bell curve. Metrics in the right column show favorable performance as positive sigma (+σ).
      </p>

      {/* Section Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        background: '#0f172a',
        padding: '0.5rem',
        borderRadius: '0.5rem'
      }}>
        {[
          { id: 'standard', label: 'Standard', symbol: '●', count: standardMetrics.length },
          { id: 'attribute', label: 'Attributes', symbol: '▲', count: attributeMetrics.length },
          { id: 'forged', label: 'Forged', symbol: 'f', count: forgedMetrics.length }
        ].map(tab => {
          const typeStyle = getTypeStyle(tab.id);
          const isActive = activeSection === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                background: isActive ? typeStyle.bg : 'transparent',
                border: `2px solid ${isActive ? typeStyle.text : '#374151'}`,
                borderRadius: '0.375rem',
                color: isActive ? typeStyle.text : '#9ca3af',
                fontSize: '0.9rem',
                fontWeight: isActive ? '600' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              <span style={{
                fontStyle: tab.id === 'forged' ? 'italic' : 'normal',
                fontFamily: tab.id === 'forged' ? 'Georgia, serif' : 'inherit',
                fontWeight: 'bold'
              }}>
                {tab.symbol}
              </span>
              {tab.label}
              <span style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                background: isActive ? 'rgba(0,0,0,0.2)' : '#374151',
                borderRadius: '0.25rem'
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Two-column layout with center bell curve */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        marginBottom: '2rem'
      }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fb923c', textAlign: 'center' }}>
          {activeSection === 'standard' && '● Standard Athletic Metrics'}
          {activeSection === 'attribute' && '▲ Physical Attributes'}
          {activeSection === 'forged' && <><span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>f</span> Forged Ratios</>}
        </h3>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Left column */}
          <div style={{ flex: 1, minWidth: '0' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#ef4444',
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              ← Left of Center
              <div style={{ fontSize: '0.7rem', fontWeight: '400', color: '#78716c' }}>
                (Favorable as −σ)
              </div>
            </div>
            <div style={{
              minHeight: '200px',
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '0.75rem',
              background: '#0f172a',
              borderRadius: '0.375rem',
              border: '2px dashed #78350f'
            }}>
              {leftColumnMetrics.length > 0 ? (
                leftColumnMetrics.map(metric => (
                  <MetricCard key={metric.key} metric={metric} type={activeSection} isRightColumn={false} />
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  padding: '3rem 1rem'
                }}>
                  No metrics in left column
                </div>
              )}
            </div>
          </div>

          {/* Center - Bell curve visualization */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: '2.5rem',
            minWidth: '100px'
          }}>
            <div style={{
              width: '100px',
              height: '150px',
              position: 'relative'
            }}>
              {/* Vertical center line */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '0',
                bottom: '30px',
                width: '3px',
                background: '#ea580c',
                transform: 'translateX(-50%)'
              }}></div>

              {/* Left arrow */}
              <div style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.5rem',
                color: '#ef4444'
              }}>◀</div>

              {/* Right arrow */}
              <div style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.5rem',
                color: '#22c55e'
              }}>▶</div>

              {/* Bell curve shape */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '25%',
                transform: 'translateX(-50%)',
                width: '60px',
                height: '40px',
                borderRadius: '50% 50% 0 0',
                border: '3px solid #78350f',
                borderBottom: 'none'
              }}></div>

              {/* Center label */}
              <div style={{
                position: 'absolute',
                left: '50%',
                bottom: '0',
                transform: 'translateX(-50%)',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#fb923c'
              }}>0σ</div>
            </div>

            {/* Type legend */}
            <div style={{
              marginTop: '1rem',
              padding: '0.5rem',
              background: '#422006',
              borderRadius: '0.375rem',
              fontSize: '0.7rem',
              color: '#fdba74',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                <span style={{ color: '#fcd34d' }}>●</span> Standard
              </div>
              <div style={{ marginBottom: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                <span style={{ color: '#6ee7b7' }}>▲</span> Attribute
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                <span style={{ color: '#c4b5fd', fontStyle: 'italic', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}>f</span> Forged
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ flex: 1, minWidth: '0' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#22c55e',
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              Right of Center →
              <div style={{ fontSize: '0.7rem', fontWeight: '400', color: '#78716c' }}>
                (Favorable as +σ)
              </div>
            </div>
            <div style={{
              minHeight: '200px',
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '0.75rem',
              background: '#0f172a',
              borderRadius: '0.375rem',
              border: '2px dashed #78350f'
            }}>
              {rightColumnMetrics.length > 0 ? (
                rightColumnMetrics.map(metric => (
                  <MetricCard key={metric.key} metric={metric} type={activeSection} isRightColumn={true} />
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  padding: '3rem 1rem'
                }}>
                  No metrics in right column
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#422006',
          borderRadius: '0.375rem',
          fontSize: '0.85rem',
          color: '#cbd5e1',
          borderLeft: '4px solid #ea580c'
        }}>
          <strong style={{ color: '#fb923c' }}>💡 How it works:</strong>
          <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.25rem', lineHeight: '1.5' }}>
            <li><strong>Right column:</strong> Favorable performance appears as +σ (right of bell curve center)</li>
            <li><strong>Left column:</strong> Favorable performance appears as −σ (left of bell curve center)</li>
            <li><strong style={{ color: '#fbbf24' }}>Flipped</strong> metrics have their sign inverted</li>
            <li><strong style={{ color: '#c4b5fd' }}>Forged</strong> metrics are calculated ratios between two base metrics</li>
          </ul>
        </div>
      </div>

      {/* Data Management */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        marginTop: '1.5rem',
        borderLeft: '4px solid #78350f'
      }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fb923c' }}>
          Data Management
        </h3>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (window.confirm('Reset all settings to defaults?')) {
                localStorage.removeItem('freakforgeSettings');
                window.location.reload();
              }
            }}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#7c2d12',
              border: '2px solid #dc2626',
              borderRadius: '0.5rem',
              color: '#fbbf24',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🔄 Reset to Defaults
          </button>

          <button
            onClick={() => {
              const dataStr = JSON.stringify(settings, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'freakforge-settings.json';
              link.click();
            }}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#422006',
              border: '2px solid #78350f',
              borderRadius: '0.5rem',
              color: '#fbbf24',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            💾 Export Settings
          </button>
        </div>
      </div>

      {/* Spacing */}
      <div style={{ height: '2rem' }}></div>
    </div>
  );
}

export default Settings;