import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Console only for M0; a real error tracker (Sentry) is wired in M1.
    // eslint-disable-next-line no-console
    console.error("Dashboard crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-danger/30 bg-danger/10 p-6 text-center">
            <h1 className="text-lg font-bold text-danger">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-300">
              The dashboard hit an unexpected error. Try reloading the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-white/30"
            >
              Reload
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
