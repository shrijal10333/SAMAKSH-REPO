import React from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null 
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    handleGoHome = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-6 text-center z-[999] relative">
                    <div className="max-w-md w-full bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 flex items-center justify-center mx-auto text-[#ff4d4d]">
                            <AlertTriangle size={32} />
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d4d]">
                                SAMAKSH MOVIE • System Notice
                            </span>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                                Something went wrong
                            </h2>
                            <p className="text-sm text-white/50 font-medium leading-relaxed">
                                Unable to load this page or component. The requested stream or data encountered an unexpected state.
                            </p>
                        </div>

                        {this.state.error?.message && (
                            <div className="bg-black/60 rounded-xl p-3 text-left border border-white/5 overflow-x-auto max-h-24 custom-scrollbar">
                                <p className="text-[11px] font-mono text-white/40 break-words">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-[#1db954] text-black py-3.5 px-6 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                            >
                                <RefreshCw size={14} /> Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3.5 px-6 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10"
                            >
                                <Home size={14} /> Go Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
