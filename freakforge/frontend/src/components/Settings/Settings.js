import React, { useState, useEffect } from 'react';

function Settings() {
  // Default: time-based metrics are flipped so favorable (faster) times show as positive sigma
  const [settings, setSettings] = useState({
    greenIsGood: false,
    metricFlips: {
      dash40: true,       // Time metric - flip by default
      proAgility: true,   // Time metric - flip by default
      lDrill: true,       // Time metric - flip by default
      verticalJump: false,
      broadJump: false,
      height: false,
      weight: false
    }
  });

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

  // Metric definitions with direction info
  const metrics = [
    {
      key: 'dash40',
      name: '40-Yard Dash',
      unit: 'sec',
      lowerIsBetter: true,
      description: 'Lower time is better (speed)'
    },
    {
      key: 'proAgility',
      name: 'Pro Agility',
      unit: 'sec',
      lowerIsBetter: true,
      description: 'Lower time is better (agility)'
    },
    {
      key: 'lDrill',
      name: 'L-Drill',
      unit: 'sec',
      lowerIsBetter: true,
      description: 'Lower time is better (agility)'
    },
    {
      key: 'verticalJump',
      name: 'Vertical Jump',
      unit: 'in',
      lowerIsBetter: false,
      description: 'Higher is better (power)'
    },
    {
      key: 'broadJump',
      name: 'Broad Jump',
      unit: 'in',
      lowerIsBetter: false,
      description: 'Higher is better (power)'
    },
    {
      key: 'height',
      name: 'Height',
      unit: 'in',
      lowerIsBetter: false,
      description: 'Context dependent'
    },
    {
      key: 'weight',
      name: 'Weight',
      unit: 'lbs',
      lowerIsBetter: false,
      description: 'Context dependent'
    }
  ];

  // Determine which column a metric belongs in based on flip state and natural direction
  // Right column = favorable shows as positive sigma (right of center)
  // Left column = favorable shows as negative sigma (left of center)
  const isInRightColumn = (metric) => {
    const isFlipped = settings.metricFlips[metric.key];
    // Right column if: (lower is better AND flipped) OR (higher is better AND not flipped)
    return (metric.lowerIsBetter && isFlipped) || (!metric.lowerIsBetter && !isFlipped);
  };

  // Check if metric is flipped to be in right column (special highlighting)
  const isFlippedToRight = (metric) => {
    const isFlipped = settings.metricFlips[metric.key];
    return metric.lowerIsBetter && isFlipped;
  };

  const rightColumnMetrics = metrics.filter(m => isInRightColumn(m));
  const leftColumnMetrics = metrics.filter(m => !isInRightColumn(m));

  const MetricCard = ({ metric, isRightColumn }) => {
    const isFlipped = settings.metricFlips[metric.key];
    const isFlippedForRight = isFlippedToRight(metric);

    // Colors: flipped time metrics get special amber/orange highlight
    // Regular metrics get standard brown/orange theme
    const cardBorderColor = isFlippedForRight ? '#f59e0b' : '#78350f';
    const cardBackground = isFlippedForRight ? '#422006' : '#1e293b';

    return (
      <div style={{
        background: cardBackground,
        padding: '1.25rem',
        borderRadius: '0.5rem',
        borderLeft: `4px solid ${cardBorderColor}`,
        marginBottom: '1rem'
      }}>
        {/* Metric name and unit */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            fontSize: '1.1rem',
            fontWeight: '600',
            color: isFlippedForRight ? '#fbbf24' : '#fbbf24',
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {metric.name}
            {metric.lowerIsBetter && (
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.4rem',
                background: '#7c2d12',
                borderRadius: '0.25rem',
                color: '#fdba74'
              }}>
                TIME
              </span>
            )}
            {isFlippedForRight && (
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.4rem',
                background: '#b45309',
                borderRadius: '0.25rem',
                color: '#fef3c7'
              }}>
                FLIPPED
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#a16207' }}>
            {metric.description} • Unit: {metric.unit}
          </div>
        </div>

        {/* Radio buttons */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          padding: '0.75rem',
          background: '#0f172a',
          borderRadius: '0.375rem'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            color: !isFlipped ? '#fbbf24' : '#64748b',
            fontWeight: !isFlipped ? '600' : '400'
          }}>
            <input
              type="radio"
              name={`${metric.key}-mode`}
              checked={!isFlipped}
              onChange={() => handleToggleMetric(metric.key, false)}
              style={{
                cursor: 'pointer',
                accentColor: '#ea580c',
                width: '18px',
                height: '18px'
              }}
            />
            <span style={{ fontSize: '0.95rem' }}>Raw</span>
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            color: isFlipped ? '#fbbf24' : '#64748b',
            fontWeight: isFlipped ? '600' : '400'
          }}>
            <input
              type="radio"
              name={`${metric.key}-mode`}
              checked={isFlipped}
              onChange={() => handleToggleMetric(metric.key, true)}
              style={{
                cursor: 'pointer',
                accentColor: '#ea580c',
                width: '18px',
                height: '18px'
              }}
            />
            <span style={{ fontSize: '0.95rem' }}>Flip</span>
          </label>
        </div>
      </div>
    );
  };

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
      <p style={{ color: '#a16207', marginBottom: '2rem' }}>
        Configure how sigma values are displayed on the bell curve. Metrics in the right column show favorable performance as positive sigma (+σ).
      </p>

      {/* Two-column layout with center bell curve */}
      <div style={{
        background: '#1e293b',
        padding: '2rem',
        borderRadius: '0.5rem',
        marginBottom: '2rem'
      }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#fb923c', textAlign: 'center' }}>
          Metric Orientation
        </h3>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Left column - metrics showing favorable as negative σ */}
          <div style={{ flex: 1, minWidth: '0' }}>
            <div style={{
              fontSize: '0.95rem',
              fontWeight: '600',
              color: '#ef4444',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              ← Left of Center
              <div style={{ fontSize: '0.75rem', fontWeight: '400', marginTop: '0.25rem', color: '#78716c' }}>
                (Favorable as −σ)
              </div>
            </div>
            <div style={{
              minHeight: '200px',
              padding: '1rem',
              background: '#0f172a',
              borderRadius: '0.375rem',
              border: '2px dashed #78350f'
            }}>
              {leftColumnMetrics.length > 0 ? (
                leftColumnMetrics.map(metric => (
                  <MetricCard key={metric.key} metric={metric} isRightColumn={false} />
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  padding: '3rem 1rem'
                }}>
                  No metrics configured for left side
                  <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#475569' }}>
                    Select "Raw" on a time metric to move it here
                  </div>
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
            paddingTop: '3rem'
          }}>
            <div style={{
              width: '100px',
              height: '180px',
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
              }}>
                ◀
              </div>

              {/* Right arrow */}
              <div style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.5rem',
                color: '#22c55e'
              }}>
                ▶
              </div>

              {/* Bell curve shape (simple) */}
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
                color: '#fb923c',
                whiteSpace: 'nowrap'
              }}>
                0σ
              </div>
            </div>

            {/* Legend */}
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#422006',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              color: '#fdba74',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  background: '#b45309',
                  borderRadius: '2px',
                  marginRight: '0.5rem',
                  verticalAlign: 'middle'
                }}></span>
                Flipped metric
              </div>
              <div>
                <span style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  background: '#78350f',
                  borderRadius: '2px',
                  marginRight: '0.5rem',
                  verticalAlign: 'middle'
                }}></span>
                Raw metric
              </div>
            </div>
          </div>

          {/* Right column - metrics showing favorable as positive σ */}
          <div style={{ flex: 1, minWidth: '0' }}>
            <div style={{
              fontSize: '0.95rem',
              fontWeight: '600',
              color: '#22c55e',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Right of Center →
              <div style={{ fontSize: '0.75rem', fontWeight: '400', marginTop: '0.25rem', color: '#78716c' }}>
                (Favorable as +σ)
              </div>
            </div>
            <div style={{
              minHeight: '200px',
              padding: '1rem',
              background: '#0f172a',
              borderRadius: '0.375rem',
              border: '2px dashed #78350f'
            }}>
              {rightColumnMetrics.length > 0 ? (
                rightColumnMetrics.map(metric => (
                  <MetricCard key={metric.key} metric={metric} isRightColumn={true} />
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  padding: '3rem 1rem'
                }}>
                  No metrics configured for right side
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#422006',
          borderRadius: '0.375rem',
          fontSize: '0.9rem',
          color: '#cbd5e1',
          borderLeft: '4px solid #ea580c'
        }}>
          <strong style={{ color: '#fb923c' }}>💡 How it works:</strong>
          <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.25rem', lineHeight: '1.6' }}>
            <li><strong>Right column:</strong> Favorable performance appears as +σ (right of bell curve center)</li>
            <li><strong>Left column:</strong> Favorable performance appears as −σ (left of bell curve center)</li>
            <li><strong style={{ color: '#fbbf24' }}>Flipped</strong> time metrics (highlighted) have their sign inverted so faster times show as +σ</li>
            <li>Toggle "Raw" on a time metric to see it graphed without inversion (moves to left column)</li>
          </ul>
        </div>
      </div>

      {/* Data Management */}
      <div style={{
        background: '#1e293b',
        padding: '2rem',
        borderRadius: '0.5rem',
        marginTop: '2rem',
        borderLeft: '4px solid #78350f'
      }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#fb923c' }}>
          Data Management
        </h3>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => {
              if (window.confirm('Reset all settings to defaults?')) {
                localStorage.removeItem('freakforgeSettings');
                window.location.reload();
              }
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#7c2d12',
              border: '2px solid #dc2626',
              borderRadius: '0.5rem',
              color: '#fbbf24',
              fontSize: '0.95rem',
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
              padding: '0.75rem 1.5rem',
              background: '#422006',
              border: '2px solid #78350f',
              borderRadius: '0.5rem',
              color: '#fbbf24',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            💾 Export Settings
          </button>
        </div>
      </div>

      {/* Extra spacing at bottom for scrolling */}
      <div style={{ height: '2rem' }}></div>
    </div>
  );
}

export default Settings;