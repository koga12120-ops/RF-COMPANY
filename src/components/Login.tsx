import React, { useState } from 'react';
import { User, Lock, KeyRound, AlertTriangle, Eye, EyeOff, LogIn } from 'lucide-react';
import { loginWithCredentials, loginWithSingleCode, saveUserSession, UserSession } from '../lib/authService';

interface LoginProps {
  onSuccess: (session: UserSession) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [mode, setMode] = useState<'credentials' | 'pin'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('تکایە ناوی بەکارهێنەر (یوزەرنەیم یان ناو) بنووسە');
      return;
    }
    if (!password.trim()) {
      setError('تکایە تێپەڕەوشە (پاسوۆرد) بنووسە');
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithCredentials(username, password);
      if (result.success && result.session) {
        saveUserSession(result.session, rememberMe);
        onSuccess(result.session);
      } else {
        setError(result.error || 'زانیارییەکان هەڵەن');
      }
    } catch (err: any) {
      console.error(err);
      setError('هەڵەیەک لە چوونەژوورەوە ڕوویدا. تکایە دووبارە هەوڵبدەرەوە.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pinCode.trim()) {
      setError('تکایە کۆدی ئەمنیی ٥ ژمارەیی بنووسە');
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithSingleCode(pinCode);
      if (result.success && result.session) {
        saveUserSession(result.session, rememberMe);
        onSuccess(result.session);
      } else {
        setError(result.error || 'کۆدەکە هەڵەیە');
      }
    } catch (err: any) {
      console.error(err);
      setError('هەڵەیەک لە چوونەژوورەوە ڕوویدا');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30" dir="rtl">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl shadow-slate-200/60 w-full max-w-md border border-slate-100 transition-all">
        
        {/* Company Logo & Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-md mb-3 bg-white p-1">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            کۆمپانیای RF
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            سیستەمی بەڕێوەبردنی کۆگا و مەندووبەکان
          </p>
        </div>

        {/* Login Method Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-2xl mb-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('credentials'); setError(''); }}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              mode === 'credentials'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User size={15} />
            <span>یوزەر و تێپەڕەوشە</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('pin'); setError(''); }}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              mode === 'pin'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound size={15} />
            <span>کۆدی خێرا (PIN)</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl mb-5 text-xs font-medium border border-red-100 flex items-center gap-2">
            <AlertTriangle size={17} className="shrink-0 text-red-500" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form: Username & Password */}
        {mode === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ناوی بەکارهێنەر (Username) یان ناو
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="بۆ نموونە: admin یان ناوی مەندووب"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs font-bold text-slate-800 transition"
                  autoFocus
                />
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تێپەڕەوشە (پاسوۆرد / کۆد)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs font-bold text-slate-800 transition"
                />
                <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-xs text-slate-600 font-medium">لەبیرم بهێنە (Keep Logged In)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold text-xs shadow-lg shadow-slate-900/10 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn size={16} />
              <span>{loading ? 'چاوەڕێبە...' : 'چوونەژوورەوە بۆ سیستەم'}</span>
            </button>
          </form>
        )}

        {/* Form: Quick PIN / Access Code */}
        {mode === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                کۆدی ئەمنی پێنج ژمارەیی بنووسە
              </label>
              <input
                type="password"
                required
                disabled={loading}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="•••••"
                maxLength={5}
                dir="ltr"
                className="w-full px-4 py-3.5 text-center tracking-[0.8em] text-2xl bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono font-black text-slate-900 transition"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-xs text-slate-600 font-medium">لەبیرم بهێنە لەم ئامێرە</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold text-xs shadow-lg shadow-slate-900/10 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn size={16} />
              <span>{loading ? 'چاوەڕێبە...' : 'پشتڕاستکردنەوە و چوونەژوورەوە'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
