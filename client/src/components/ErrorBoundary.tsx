import { Component, type ReactNode } from 'react';
import Logo from './Logo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <Logo size={48} />
            <h1 className="font-black text-navy-900 text-3xl">מחליפון</h1>
          </div>

          {/* Error illustration */}
          <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Message */}
          <h2 className="text-xl font-bold text-navy-900 mb-2">משהו השתבש</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            אירעה שגיאה בלתי צפויה. אנא נסי שוב מאוחר יותר.
          </p>

          {/* Retry button */}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-8 py-3 bg-mint-500 text-white font-semibold rounded-xl shadow-sm hover:bg-mint-600 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            נסי שוב
          </button>
        </div>
      </div>
    );
  }
}
