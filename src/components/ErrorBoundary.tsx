import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A render-time crash used to blank the whole app with nothing but a white
 * screen and no way to export data. This keeps the owner in control: they can
 * copy the error, export/back-up from the last good state, or reload.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // No telemetry by design: surface it locally instead.
    console.error('Hedetangen Studio render error', error, info.componentStack);
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
        <div className="max-w-md w-full space-y-4 p-6 rounded-[24px] glass-surface border border-[var(--border)]">
          <h1 className="text-lg font-semibold">Something broke while rendering the studio</h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Your chats and library are still stored in this browser. Reload to keep working — if
            this keeps happening, open Settings → Backup &amp; Data and export a JSON backup before
            clearing anything.
          </p>
          <pre className="text-xs font-mono-tabular whitespace-pre-wrap break-words p-3 rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] max-h-40 overflow-auto">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[42px] px-4 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] text-[#181817]"
            >
              Reload studio
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="min-h-[42px] px-4 py-2 text-sm font-medium rounded-full border border-[var(--border)]"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
