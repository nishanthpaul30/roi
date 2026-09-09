'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Zap, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      const success = login(username, password);
      if (!success) {
        setError('Invalid credentials. Please check username and password.');
        setIsSubmitting(false);
      }
    }, 400);
  };


  return (
    <div className="min-h-screen w-full bg-ey-black flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-ey-yellow/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-yellow-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-ey-card/80 backdrop-blur-xl border border-ey-border rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3 bg-ey-yellow rounded-2xl text-ey-black mb-4 shadow-lg shadow-yellow-500/20">
            <Zap className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-ey-light tracking-tight">Copilot Analytics</h1>
          <p className="text-xs text-ey-yellow font-semibold mt-1">Enterprise & ROI Management Platform</p>
        </div>


        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-2.5 text-red-400 text-xs font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-ey-light mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ey-muted">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (e.g. admin)"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-ey-black/60 border border-ey-border rounded-xl text-sm text-ey-light placeholder-ey-muted focus:outline-none focus:border-ey-yellow focus:ring-1 focus:ring-ey-yellow transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-ey-light mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ey-muted">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full pl-10 pr-10 py-2.5 bg-ey-black/60 border border-ey-border rounded-xl text-sm text-ey-light placeholder-ey-muted focus:outline-none focus:border-ey-yellow focus:ring-1 focus:ring-ey-yellow transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-ey-muted hover:text-ey-light"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-ey-yellow hover:bg-yellow-400 text-ey-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-yellow-500/10 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* Footer Disclaimer */}
      <p className="mt-8 text-center text-xs text-ey-muted relative z-10">
        GitHub Copilot Enterprise Metrics & ROI Platform v2026
      </p>
    </div>
  );
}
