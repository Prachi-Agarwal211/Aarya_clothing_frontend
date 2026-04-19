'use client';

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet, Upload, AlertCircle, Loader2, X,
} from 'lucide-react';
import { ordersApi } from '@/lib/adminApi';

/**
 * Bulk POD upload modal — downloads the template, accepts an .xlsx with
 * order_id + tracking_number, then ships all matched confirmed orders.
 */
export default function PodUploadModal({ open, onClose, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const reset = () => {
    setUploading(false);
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await ordersApi.uploadPodExcel(file);
      setResult(res);
      onUploaded?.();
    } catch (err) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={uploading ? undefined : handleClose}
      />
      <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-xl font-semibold text-[#F2C29A] font-cinzel">
            POD Excel upload
          </h3>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#EAE0D5] disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[#EAE0D5]/50 mb-5">
          Download the template, fill in POD / tracking numbers, then upload to
          bulk-ship confirmed orders.
        </p>

        {result ? (
          <SuccessSummary result={result} onDone={handleClose} />
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => {
                window.location.href = ordersApi.downloadPodTemplate();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#B76E79]/10 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Step 1 — Download confirmed orders template
            </button>

            <div
              className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-[#B76E79]/30 rounded-xl text-[#EAE0D5]/50 hover:border-[#B76E79]/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#B76E79]" />
                  <p className="text-sm">Processing...</p>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <p className="text-sm font-medium">Step 2 — Upload filled Excel</p>
                  <p className="text-xs">Click or drag &amp; drop .xlsx file</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleClose}
              disabled={uploading}
              className="w-full py-2 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/60 hover:text-[#EAE0D5]/80 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessSummary({ result, onDone }) {
  return (
    <div className="space-y-3">
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
        <p className="text-green-400 font-semibold">{result.message || 'Upload complete'}</p>
        <p className="text-sm text-[#EAE0D5]/60 mt-1">
          {result.updated || 0} shipped · {result.skipped || 0} skipped
        </p>
      </div>
      {result.errors?.length > 0 && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl max-h-32 overflow-y-auto">
          <p className="text-xs text-yellow-400 font-semibold mb-1">
            Warnings ({result.errors.length}):
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-[#EAE0D5]/50">{e}</p>
          ))}
        </div>
      )}
      <button
        onClick={onDone}
        className="w-full py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold"
      >
        Done
      </button>
    </div>
  );
}
