import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * App-wide error boundary. Without this, any uncaught render error blanks the whole
 * screen. Here we show a friendly recovery card instead, so a single broken view
 * never takes the entire app down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Surface in the console for debugging; a real deployment can forward to Sentry etc.
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[var(--c-bg)] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--c-text)] mb-1.5">Something went wrong</h1>
          <p className="text-[var(--c-text-3)] text-sm max-w-sm">An unexpected error occurred. Reloading usually fixes it.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-emerald transition-colors"
          >
            Reload
          </button>
          <button
            onClick={() => { window.location.href = '/feed' }}
            className="px-5 py-2.5 rounded-xl bg-[var(--c-card)] border border-[var(--c-border)] text-[var(--c-text)] text-sm font-semibold hover:bg-[var(--c-raised)] transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    )
  }
}
