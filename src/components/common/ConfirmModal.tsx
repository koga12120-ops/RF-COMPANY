import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Check, Info } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  message?: string;
  itemName?: string;
  details?: { label: string; value: React.ReactNode }[];
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning' | 'success';
  icon?: 'trash' | 'alert' | 'check' | 'info';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'دڵنیابوونەوە لە سڕینەوە',
  message = 'ئایا دڵنیایت لە سڕینەوە؟ ئەم کردارە ناگەڕێتەوە.',
  itemName,
  details,
  confirmText = 'بەڵێ، بسڕەوە',
  cancelText = 'پاشگەزبوونەوە',
  confirmVariant = 'danger',
  icon = 'trash',
  isLoading: externalLoading
}: ConfirmModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading ?? internalLoading;

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  const getVariantStyles = () => {
    switch (confirmVariant) {
      case 'primary':
        return {
          headerBg: 'bg-blue-50',
          headerText: 'text-blue-800',
          iconColor: 'text-blue-600',
          btnBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        };
      case 'warning':
        return {
          headerBg: 'bg-amber-50',
          headerText: 'text-amber-800',
          iconColor: 'text-amber-600',
          btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
        };
      case 'success':
        return {
          headerBg: 'bg-green-50',
          headerText: 'text-green-800',
          iconColor: 'text-green-600',
          btnBg: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
        };
      case 'danger':
      default:
        return {
          headerBg: 'bg-red-50',
          headerText: 'text-red-800',
          iconColor: 'text-red-600',
          btnBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        };
    }
  };

  const styles = getVariantStyles();

  const renderIcon = () => {
    switch (icon) {
      case 'alert':
        return <AlertTriangle className={styles.iconColor} size={20} />;
      case 'check':
        return <Check className={styles.iconColor} size={20} />;
      case 'info':
        return <Info className={styles.iconColor} size={20} />;
      case 'trash':
      default:
        return <Trash2 className={styles.iconColor} size={20} />;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150"
        dir="rtl"
      >
        <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${styles.headerBg}`}>
          <h3 className={`font-bold text-base flex items-center gap-2 ${styles.headerText}`}>
            {renderIcon()}
            {title}
          </h3>
          <button 
            type="button"
            onClick={onClose} 
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-slate-700 text-sm leading-relaxed">
            {message}
            {itemName && (
              <strong className="text-slate-900 mx-1">({itemName})</strong>
            )}
          </p>

          {details && details.length > 0 && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm space-y-2">
              {details.map((d, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-slate-500">{d.label}:</span>
                  <span className="font-bold text-slate-800">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 py-2.5 px-4 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${styles.btnBg}`}
            >
              {icon === 'trash' ? <Trash2 size={18} /> : <Check size={18} />}
              {loading ? 'کەمێک چاوەڕێ بکە...' : confirmText}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition disabled:opacity-50"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
