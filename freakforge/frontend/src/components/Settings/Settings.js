import React, { useState, useEffect } from 'react';

function Settings() {
  const [settings, setSettings] = useState({
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
      recommendFlip: true,
      description: 'Lower time is better (speed)'
    },
    {
      key: 'proAgility',
      name: 'Pro Agility',
      unit: 'sec',
      lowerIsBetter: true,
      recommendFlip: true,
      description: 'Lower time is better (agility)'
    },
    {
      key: 'lDrill',
      name: 'L-Drill',
      unit: 'sec',
      lowerIsBetter: true,
      recommendFlip: true,
      description: 'Lower time is better (agility)'
    },
    {
      key: 'verticalJump',
      name: 'Vertical Jump',
      unit: 'in',
      lowerIsBetter: false,
      recommendFlip: false,
      description: 'Higher is better (power)'
    },
    {
      key: 'broadJump',
      name: 'Broad Jump',
      unit: 'in',
      lowerIsBetter: false,
      recommendFlip: false,
      description: 'Higher is better (power)'
    },
    {
      key: 'height',
      name: 'Height',
      unit: 'in',
      lowerIsBetter: false,
      recommendFlip: false,
      description: 'Context dependent'
    },
    {
      key: 'weight',
      name: 'Weight',
      unit: 'lbs',
      lowerIsBetter: false,
      recommendFlip: false,
      description: 'Context dependent'
    }
  ];

  const MetricCard = ({ metric }) => {
    const isFlipped = settings.metricFlips[metric.key];
    const recommendedSetting = metric.recommendFlip ? 'Flip' : 'Raw';
    const recommendationReason = metric.lowerIsBetter ? 'Lower' : 'Higher';

    return (
      <div style={{
        background: '#1e293b',
        padding: '1.25rem',
        borderRadius: '0.5rem',
        borderLeft: `4px solid ${isFlipped ? '#f97316' : '#78350f'}`,
        minWidth: '280px'
      }}>
        {/* Metric name and unit */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fbbf24', marginBottom: '0.25rem' }}>
            {metric.name}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#a16207' }}>
            {metric.description} • Unit: {metric.unit}
          </div>
        </div>

        {/* Radio buttons */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '1rem',
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

        {/* Recommendation */}
        <div style={{
          padding: '0.75rem',
          background: '#422006',
          borderRadius: '0.375rem',
          fontSize: '0.85rem',
          color: '#fdba74',
          borderLeft: '3px solid #ea580c'
        }}>
          <strong style={{ color: '#fb923c' }}>Recommend {recommendedSetting}:</strong>
          <br />
          {recommendationReason} metric value is better
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
        Configure how sigma values are displayed. Metrics shown right of center indicate favorable performance as positive sigma.
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

        <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
          {/* Left column - would be for left-oriented metrics (currently empty) */}
          <div style={{ flex: 1, minWidth: '0' }}>
            <div style={{
              fontSize: '0.95rem',
              fontWeight: '600',
              color: '#a16207',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Left of Center
              <div style={{ fontSize: '0.75rem', fontWeight: '400', marginTop: '0.25rem', color: '#78716c' }}>
                (Favorable as negative σ)
              </div>
            </div>
            <div style={{
              display: 'grid',
              gap: '1rem',
              minHeight: '100px',
              padding: '1rem',
              background: '#0f172a',
              borderRadius: '0.375rem',
              border: '2px dashed #78350f'
            }}>
              <div style={{
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.85rem',
                padding: '2rem'
              }}>
                No metrics configured
              </div>
            </div>
          </div>

          {/* Center - Bell curve symbol */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            <div style={{
              width: '80px',
              height: '120px',
              position: 'relative'
            }}>
              {/* Vertical center line */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '0',
                bottom: '0',
                width: '3px',
                background: '#ea580c',
                transform: 'translateX(-50%)'
              }}></div>

              {/* Bell curve symbol (simple triangle) */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '30%',
                transform: 'translateX(-50%)',
                fontSize: '4rem',
                color: '#78350f',
                lineHeight: '1',
                userSelect: 'none'
              }}>
                ⟨⟩
              </div>

              {/* Center label */}
              <div style={{
                position: 'absolute',
                left: '50%',
                bottom: '0',
                transform: 'translateX(-50%)',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#fb923c',
                whiteSpace: 'nowrap'
              }}>
                0σ
              </div>
            </div>
          </div>

          {/* Right column - all favorable metrics */}
          <div style={{ flex: 1, minWidth: '0' }}>
            <div style={{
              fontSize: '0.95rem',
              fontWeight: '600',
              color: '#a16207',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Right of Center
              <div style={{ fontSize: '0.75rem', fontWeight: '400', marginTop: '0.25rem', color: '#78716c' }}>
                (Favorable as positive σ)
              </div>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {metrics.map(metric => (
                <MetricCard key={metric.key} metric={metric} />
              ))}
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
          <strong style={{ color: '#fb923c' }}>💡 How it works:</strong> By default, all metrics are positioned right of center, meaning better performance shows as positive sigma (+σ). For time-based metrics where lower is better (40-yard dash, agility drills), select "Flip" to invert the display so faster times appear as positive sigma values.
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
              if (confirm('Reset all settings to defaults?')) {
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