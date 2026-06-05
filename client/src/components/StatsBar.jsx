import { useMemo } from 'react';

const EFFORT_DAYS = { S: 2, M: 5, L: 13 };

function gapKey(gapType) {
  if (!gapType) return 'unknown';
  const k = gapType.toLowerCase();
  if (k.includes('standard')) return 'fit';
  if (k.includes('config'))   return 'config';
  if (k.includes('dev'))      return 'dev';
  if (k.includes('out'))      return 'oos';
  return 'unknown';
}

export default function StatsBar({ rows }) {
  const stats = useMemo(() => {
    const complete = rows.filter(r => r.status === 'complete');
    const total = complete.length;
    const counts = { fit: 0, config: 0, dev: 0, oos: 0 };
    let effort = 0;

    complete.forEach(r => {
      const k = gapKey(r.gapType);
      if (counts[k] !== undefined) counts[k]++;
      if (r.effort && EFFORT_DAYS[r.effort]) {
        effort += EFFORT_DAYS[r.effort];
      }
    });

    const pct = (n) => total ? Math.round((n / total) * 100) : 0;

    return { total, ...counts, effort, pct };
  }, [rows]);

  if (stats.total === 0) return null;

  /* CSS conic-gradient for donut */
  const segments = [
    { count: stats.fit,    color: 'var(--success)' },
    { count: stats.config, color: 'var(--warning)' },
    { count: stats.dev,    color: 'var(--danger)' },
    { count: stats.oos,    color: 'var(--muted)' },
  ];
  let angle = 0;
  const gradientParts = [];
  segments.forEach(({ count, color }) => {
    const slice = stats.total ? (count / stats.total) * 360 : 0;
    if (slice > 0) {
      gradientParts.push(`${color} ${angle}deg ${angle + slice}deg`);
      angle += slice;
    }
  });
  // Fill any remaining gap (shouldn't be any, but be safe)
  if (angle < 360) {
    gradientParts.push(`var(--bg-elevated) ${angle}deg 360deg`);
  }
  const donutStyle = {
    background: `conic-gradient(${gradientParts.join(', ')})`,
  };

  return (
    <section className="stats-bar" style={{ flex: 1 }}>
      <div className="glass-card">
        <div className="stats-bar__inner">
          {/* Total */}
          <div className="stat-box">
            <div className="stat-box__number stat-box__number--total">{stats.total}</div>
            <div className="stat-box__label">Analysed</div>
          </div>

          {/* Standard Fit */}
          <div className="stat-box">
            <div className="stat-box__number stat-box__number--success">{stats.fit}</div>
            <div className="stat-box__label">Standard Fit</div>
            <div className="stat-box__percent">{stats.pct(stats.fit)}%</div>
          </div>

          {/* Config Gap */}
          <div className="stat-box">
            <div className="stat-box__number stat-box__number--warning">{stats.config}</div>
            <div className="stat-box__label">Config Gap</div>
            <div className="stat-box__percent">{stats.pct(stats.config)}%</div>
          </div>

          {/* Dev Gap */}
          <div className="stat-box">
            <div className="stat-box__number stat-box__number--danger">{stats.dev}</div>
            <div className="stat-box__label">Dev Gap</div>
            <div className="stat-box__percent">{stats.pct(stats.dev)}%</div>
          </div>

          {/* Out of Scope */}
          {stats.oos > 0 && (
            <div className="stat-box">
              <div className="stat-box__number stat-box__number--muted">{stats.oos}</div>
              <div className="stat-box__label">Out of Scope</div>
            </div>
          )}

          {/* Donut Chart */}
          <div className="donut-chart" style={donutStyle}>
            <div className="donut-chart__center">
              <span className="donut-chart__label">{stats.total}</span>
            </div>
          </div>

          {/* Effort Summary */}
          <div className="effort-summary">
            <div className="effort-summary__value">{stats.effort}</div>
            <div className="effort-summary__label">Est. Person-Days</div>
          </div>
        </div>
      </div>
    </section>
  );
}
