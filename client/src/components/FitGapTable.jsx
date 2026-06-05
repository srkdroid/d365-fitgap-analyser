import AnalysisDetail from './AnalysisDetail';

/* ── helpers ────────────────────────────────────────────── */
function gapClass(gapType) {
  if (!gapType) return '';
  const key = gapType.toLowerCase().replace(/[\s/]+/g, '-');
  if (key.includes('standard')) return 'standard-fit';
  if (key.includes('config'))   return 'config-gap';
  if (key.includes('dev'))      return 'dev-gap';
  if (key.includes('out'))      return 'out-of-scope';
  return '';
}

function truncate(str, max = 80) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/* ── Skeleton Row ───────────────────────────────────────── */
function SkeletonRow({ id }) {
  return (
    <tr className="analyzing-row">
      <td className="td-id">{id}</td>
      <td><div className="skeleton skeleton--text" /><div className="skeleton skeleton--text-short" /></td>
      <td><div className="skeleton skeleton--text-short" /></td>
      <td className="col-subprocess"><div className="skeleton skeleton--text-short" /></td>
      <td><div className="skeleton skeleton--badge" /></td>
      <td className="col-recommendation"><div className="skeleton skeleton--text" /></td>
      <td className="col-effort"><div className="skeleton skeleton--badge" style={{ width: 32 }} /></td>
      <td><div className="skeleton skeleton--badge" style={{ width: 60 }} /></td>
      <td />
    </tr>
  );
}

/* ── Error Row ──────────────────────────────────────────── */
function ErrorRow({ row, onDelete }) {
  return (
    <tr className="error-row">
      <td className="td-id">{row.id}</td>
      <td colSpan={7}>
        <span className="error-message">
          <span>⚠️</span>
          <span>Analysis failed: {row.error || 'Unknown error'}</span>
        </span>
      </td>
      <td>
        <button className="action-btn action-btn--delete" onClick={() => onDelete(row.id)} title="Remove">
          ✕
        </button>
      </td>
    </tr>
  );
}

/* ── Data Row ───────────────────────────────────────────── */
function DataRow({ row, index, isExpanded, onToggle, onDelete, onUpdate }) {
  const gap = gapClass(row.gapType);
  const priorityClass = row.priority === 'High'
    ? 'priority-select--high'
    : row.priority === 'Low'
      ? 'priority-select--low'
      : 'priority-select--medium';

  return (
    <>
      <tr
        className={`row-enter row--${gap}`}
        style={{ animationDelay: `${Math.min(index, 9) * 0.05}s` }}
        onClick={() => onToggle(row.id)}
      >
        <td className="td-id">{row.id}</td>
        <td className="td-requirement">
          <span className="td-requirement__text" title={row.requirement}>
            {truncate(row.requirement)}
          </span>
        </td>
        <td className="td-module col-module">{row.module || '—'}</td>
        <td className="td-subprocess col-subprocess">{row.subProcess || '—'}</td>
        <td>
          {row.gapType && (
            <span className={`badge badge--${gap}`}>{row.gapType}</span>
          )}
        </td>
        <td className="td-recommendation col-recommendation">
          <span className="td-recommendation__text" title={row.recommendation}>
            {truncate(row.recommendation, 70)}
          </span>
        </td>
        <td className="col-effort">
          {row.effort && (
            <span className={`effort-badge effort-badge--${row.effort.toLowerCase()}`}>
              {row.effort}
            </span>
          )}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          <select
            className={`priority-select ${priorityClass}`}
            value={row.priority || 'Medium'}
            onChange={(e) => onUpdate(row.id, { priority: e.target.value })}
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          <div className="td-actions">
            <button
              className={`action-btn action-btn--expand ${isExpanded ? 'expanded' : ''}`}
              onClick={() => onToggle(row.id)}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              ▾
            </button>
            <button
              className="action-btn action-btn--delete"
              onClick={() => onDelete(row.id)}
              title="Remove"
            >
              ✕
            </button>
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <AnalysisDetail row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Main Table ─────────────────────────────────────────── */
export default function FitGapTable({ rows, onDeleteRow, onUpdateRow, expandedRowId, onToggleExpand }) {
  if (rows.length === 0) {
    return (
      <section className="fitgap-section">
        <div className="glass-card fitgap-card">
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No requirements analysed yet</h3>
            <p className="empty-state__text">
              Type a business requirement above or run the demo to see AI-powered fit-gap analysis in action.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="fitgap-section">
      <div className="glass-card fitgap-card">
        <div className="fitgap-header">
          <h2 className="fitgap-header__title">
            Fit-Gap Analysis
            <span className="fitgap-header__count">({rows.length} requirement{rows.length !== 1 ? 's' : ''})</span>
          </h2>
        </div>

        <div className="fitgap-table-wrap">
          <table className="fitgap-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>#</th>
                <th style={{ minWidth: 220 }}>Requirement</th>
                <th className="col-module" style={{ width: 130 }}>Module</th>
                <th className="col-subprocess" style={{ width: 160 }}>Sub-Process</th>
                <th style={{ width: 140 }}>Gap Type</th>
                <th className="col-recommendation" style={{ minWidth: 200 }}>Recommendation</th>
                <th className="col-effort" style={{ width: 70 }}>Effort</th>
                <th style={{ width: 100 }}>Priority</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.status === 'analyzing') {
                  return <SkeletonRow key={row.id} id={row.id} />;
                }
                if (row.status === 'error') {
                  return <ErrorRow key={row.id} row={row} onDelete={onDeleteRow} />;
                }
                return (
                  <DataRow
                    key={row.id}
                    row={row}
                    index={i}
                    isExpanded={expandedRowId === row.id}
                    onToggle={onToggleExpand}
                    onDelete={onDeleteRow}
                    onUpdate={onUpdateRow}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
