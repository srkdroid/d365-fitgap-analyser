export default function Header({ bpcStatus, isLoading }) {
  const statusClass = isLoading
    ? 'status-dot--loading'
    : bpcStatus.loaded
      ? 'status-dot--online'
      : 'status-dot--offline';

  const statusText = isLoading
    ? 'Connecting…'
    : bpcStatus.loaded
      ? `BPC Loaded: ${bpcStatus.chunks} chunks`
      : 'BPC Offline';

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__brand">
          <span className="header__logo-icon" aria-hidden="true">⚡</span>
          <div>
            <h1 className="header__title">D365 Fit-Gap Analyser</h1>
            <p className="header__subtitle">AI-Powered Requirements Analysis for Dynamics 365 F&O</p>
          </div>
        </div>

        <div className="header__status">
          <span className={`status-dot ${statusClass}`} />
          <span className="header__status-text">{statusText}</span>
        </div>
      </div>

      <div className="header__disclaimer">
        <p className="header__disclaimer-text">
          ⚠️ AI-assisted analysis — validate against your licensed D365FO environment
        </p>
      </div>
    </header>
  );
}
