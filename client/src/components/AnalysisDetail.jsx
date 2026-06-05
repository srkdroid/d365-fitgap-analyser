export default function AnalysisDetail({ row }) {
  const configSteps = row.configSteps || row.configurationSteps || [];
  const isvSuggestion = row.isvSuggestion || row.isv || null;
  const workaround = row.workaround || null;
  const sources = row.sources || row.sourceReferences || [];
  const confidence = row.confidence ?? row.aiConfidence ?? null;
  const reasoning = row.reasoning || null;
  const recommendation = row.recommendation || null;

  return (
    <div className="analysis-detail">
      <div className="analysis-detail__inner">
        {/* Full Recommendation */}
        {recommendation && (
          <div className="analysis-detail__section analysis-detail__section--full">
            <h4 className="analysis-detail__heading">
              <span className="analysis-detail__heading-icon">💡</span>
              Recommendation
            </h4>
            <p className="analysis-detail__text">{recommendation}</p>
          </div>
        )}

        {/* Configuration Steps */}
        {configSteps.length > 0 && (
          <div className="analysis-detail__section">
            <h4 className="analysis-detail__heading">
              <span className="analysis-detail__heading-icon">⚙️</span>
              Configuration Steps
            </h4>
            <ol className="config-steps">
              {configSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* ISV Suggestion */}
        {isvSuggestion && (typeof isvSuggestion === 'string' ? isvSuggestion : isvSuggestion.name) && (
          <div className="analysis-detail__section">
            <h4 className="analysis-detail__heading">
              <span className="analysis-detail__heading-icon">🧩</span>
              ISV Suggestion
            </h4>
            {typeof isvSuggestion === 'string' ? (
              <p className="analysis-detail__text">{isvSuggestion}</p>
            ) : (
              <div className="isv-card">
                <div className="isv-card__name">{isvSuggestion.name}</div>
                {isvSuggestion.description && (
                  <div className="isv-card__desc">{isvSuggestion.description}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Workaround */}
        {workaround && (
          <div className="analysis-detail__section">
            <h4 className="analysis-detail__heading">
              <span className="analysis-detail__heading-icon">🔧</span>
              Workaround
            </h4>
            <p className="analysis-detail__text">{workaround}</p>
          </div>
        )}

        {/* Source References */}
        {sources.length > 0 && (
          <div className="analysis-detail__section">
            <h4 className="analysis-detail__heading">
              <span className="analysis-detail__heading-icon">📚</span>
              Source References
            </h4>
            <div className="source-links">
              {sources.map((src, i) => {
                const url = typeof src === 'string' ? src : src.url || src.link;
                const label = typeof src === 'string' ? src : src.title || src.url || src.link;
                return (
                  <a
                    key={i}
                    className="source-link"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Confidence */}
        {confidence !== null && confidence !== undefined && (
          <div className="analysis-detail__section">
            <h4 className="analysis-detail__heading">
              <span className="analysis-detail__heading-icon">🎯</span>
              AI Confidence
            </h4>
            <div className="confidence-bar">
              <div
                className="confidence-bar__fill"
                style={{ width: `${Math.min(Math.max(confidence, 0), 100)}%` }}
              />
            </div>
            <span className="confidence-label">{confidence}%</span>
          </div>
        )}

        {/* Reasoning */}
        {reasoning && (
          <div className="analysis-detail__section analysis-detail__section--full">
            <h4 className="analysis-detail__heading">
              <span className="analysis-detail__heading-icon">🧠</span>
              Reasoning
            </h4>
            <p className="analysis-detail__text analysis-detail__text--italic">{reasoning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
