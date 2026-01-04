import React, { useState } from 'react';
import { Layout, ArrowRight, Lock, Mail, Loader2 } from 'lucide-react';
import { authAdapter } from '../services/authAdapter';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('giftedprofessor6@gmail.com');
  const [password, setPassword] = useState('123456');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { user, error, message } = await authAdapter.signUp(email, password);
        if (error) throw new Error(error);
        if (message) {
          setMessage(message);
          setIsLoading(false);
        } else if (user) {
          onLogin(user.email);
        }
      } else {
        const { user, error } = await authAdapter.signIn(email, password);
        if (error) throw new Error(error);
        if (user) {
          onLogin(user.email);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500 text-white mb-4 shadow-lg shadow-indigo-500/30">
            <Layout size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-slate-400 text-sm">Sign in to continue to SlideRemix</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-xs text-center bg-red-50 py-2 rounded-lg">
                {error}
              </div>
            )}
            
            {message && (
              <div className="text-emerald-500 text-xs text-center bg-emerald-50 py-2 rounded-lg">
                {message}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {isSignUp ? 'Signing up...' : 'Signing in...'}
                </>
              ) : (
                <>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)} 
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {isSignUp ? 'Sign In' : 'Create one'}
              </button>
            </p>
          </div>
        </div>
      </div>
      
      {!authAdapter.isSupabaseEnabled && (
        <p className="mt-4 text-xs text-orange-400 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
           ⚠️ Demo Mode: Local Database (Data stored in browser)
        </p>
      )}
      
      <p className="mt-8 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} SlideRemix AI. All rights reserved.
      </p>
    </div>
  );
};

export default LoginPage;
