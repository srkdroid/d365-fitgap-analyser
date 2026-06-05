import { useState, useRef, useEffect } from 'react';

export default function RequirementInput({ onAnalyze, onRunDemo, onBulkUpload, onClear, isAnalyzing, isLoading, hasRows }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isAnalyzing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isAnalyzing]);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || isAnalyzing) return;
    onAnalyze(trimmed);
    setText('');
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <section className="req-input">
      <div className="glass-card req-input__card">
        <label className="req-input__label" htmlFor="requirement-textarea">
          Business Requirement
        </label>

        <div className="req-input__textarea-wrap">
          <textarea
            id="requirement-textarea"
            ref={textareaRef}
            className="req-input__textarea"
            placeholder={
              'Describe your business requirement…\n\n' +
              'Example: We need to auto-match bank statements to GL entries daily and flag exceptions above $5,000'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAnalyzing}
            maxLength={2000}
          />
          <span className="req-input__charcount">
            {text.length} / 2,000
          </span>
        </div>

        <div className="req-input__actions">
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={!text.trim() || isAnalyzing || isLoading}
          >
            {isAnalyzing ? (
              <>
                <span className="btn__spinner" />
                Analysing…
              </>
            ) : (
              <>
                <span className="btn__icon">⚡</span>
                Analyse Requirement
              </>
            )}
          </button>

          <button
            className="btn btn--outline"
            onClick={onRunDemo}
            disabled={isAnalyzing || isLoading}
          >
            <span className="btn__icon">🎯</span>
            Run Demo (10 Finance)
          </button>

          <button
            className="btn btn--outline btn--accent"
            onClick={onBulkUpload}
            disabled={isAnalyzing || isLoading}
          >
            <span className="btn__icon">📋</span>
            Bulk Upload
          </button>

          {hasRows && (
            <button
              className="btn btn--ghost"
              onClick={onClear}
              disabled={isAnalyzing}
            >
              <span className="btn__icon">🗑️</span>
              Clear All
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Ctrl + Enter to submit
          </span>
        </div>
      </div>
    </section>
  );
}
