import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Role } from '../types';

interface PinEntryProps {
  onSuccess: (role: Role) => void;
  onLogout: () => void;
}

export default function PinEntry({ onSuccess, onLogout }: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Convert Eastern Arabic/Persian/Kurdish numerals to standard Latin numerals
    const convertNumerals = (str: string) => {
      const eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      let result = str;
      for (let i = 0; i < 10; i++) {
        result = result.replace(new RegExp(eastern[i], 'g'), i.toString());
        result = result.replace(new RegExp(persian[i], 'g'), i.toString());
      }
      return result;
    };

    const normalizedPin = convertNumerals(pin).trim();

    // -(27890) بۆ بەڕێوەبەر
    // -(35278) بۆ کارمەندانی بەشی کۆگا
    // -(43629) بۆ مەندووب
    try {
      if (normalizedPin === '27890') {
        await onSuccess('admin');
      } else if (normalizedPin === '35278') {
        await onSuccess('warehouse');
      } else if (normalizedPin === '43629') {
        await onSuccess('sales_rep');
      } else if (normalizedPin === '47953') {
        await onSuccess('cashvan');
      } else {
        setError('کۆدی نهێنی هەڵەیە');
        setPin('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
          کۆدی ئەمنی داخڵ بکە
        </h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              required
              disabled={loading}
              className="w-full px-4 py-3 text-center tracking-[1em] text-2xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition font-mono disabled:opacity-50 disabled:bg-slate-50"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              dir="ltr"
              placeholder="•••••"
              maxLength={5}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 transition font-medium disabled:opacity-50"
          >
            {loading ? 'چاوەڕێبە...' : 'پشتڕاستکردنەوە'}
          </button>
        </form>

        <button 
          onClick={onLogout}
          className="mt-6 w-full text-sm text-gray-500 hover:text-gray-700 underline"
        >
          چوونەدەرەوە
        </button>
      </div>
    </div>
  );
}
