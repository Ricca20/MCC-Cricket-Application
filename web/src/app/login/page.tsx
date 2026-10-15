"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import api, { errorMessage, startSession } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = isLogin
        ? await api.post('/auth/login', { email, password })
        : await api.post('/auth/register', { name, email, password });
      startSession(res.data);
      router.push('/');
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute top-1/4 left-1/4 w-[30%] h-[30%] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="glass-panel w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Join the Club'}
          </h2>
          <p className="text-slate-400">
            {isLogin ? 'Sign in to access your profile and score matches.' : 'Create an account to start tracking your career stats.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Full Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                required 
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="email" 
                className="input-field"
                style={{ paddingLeft: '3rem' }}
                placeholder="player@mcc.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type={showPassword ? "text" : "password"}
                className="input-field pr-12" 
                style={{ paddingLeft: '3rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
 autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={isLogin ? undefined : 8}
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-primary hover:text-primary-dark transition-colors text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
