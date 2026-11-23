import React, { useEffect, useRef, useState } from 'react';
import { Printer, X, ExternalLink } from 'lucide-react';

interface PrintPreviewDetail {
  html: string;
  isThermal?: boolean;
}

export default function PrintPreviewModal() {
  const [previewData, setPreviewData] = useState<PrintPreviewDetail | null>(null);
  const [blobUrl, setBlobUrl] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const handlePreview = (e: Event) => {
      const custom = e as CustomEvent<PrintPreviewDetail>;
      if (custom.detail?.html) {
        setPreviewData(custom.detail);
      }
    };
    window.addEventListener('tamtam:print-preview', handlePreview);
    return () => window.removeEventListener('tamtam:print-preview', handlePreview);
  }, []);

  useEffect(() => {
    if (!previewData?.html) {
      setBlobUrl('');
      return;
    }

    const blob = new Blob([previewData.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    const frame = iframeRef.current;
    if (frame) {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(previewData.html);
        doc.close();
      }
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewData]);

  if (!previewData) return null;

  const handleDirectPrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    } else {
      window.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      dir="rtl"
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden w-full ${
          previewData.isThermal ? 'max-w-md' : 'max-w-4xl'
        } max-h-[92vh]`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 text-white">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
            <Printer size={18} />
            <span>پێشبینینی چاپ ({previewData.isThermal ? 'سێرماڵ 80mm' : 'A4'})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDirectPrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer"
            >
              <Printer size={15} />
              <span>چاپکردن</span>
            </button>
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition"
              >
                <ExternalLink size={14} />
                <span>پەڕەی نوێ</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setPreviewData(null)}
              className="p-1.5 bg-slate-800 hover:bg-red-600 text-white rounded-lg transition cursor-pointer"
              title="داخستن"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 p-3 overflow-auto flex justify-center">
          <iframe
            ref={iframeRef}
            title="Print Preview"
            className={`bg-white shadow-md rounded-lg border border-slate-300 ${
              previewData.isThermal ? 'w-[360px] min-h-[520px]' : 'w-full min-h-[70vh]'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
