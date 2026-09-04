import React, { useState } from 'react';
import { Download, Upload, RefreshCw, X, ShieldCheck, Database, HardDrive, Check } from 'lucide-react';
import { exportAppDataJSON, importAppDataJSON, getSyncStatus, markSynced } from '../services/storage';
import { SyncStatusState } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataImported: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, onDataImported }) => {
  const [syncState, setSyncState] = useState<SyncStatusState>(getSyncStatus());
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const updated = markSynced();
      setSyncState(updated);
      setIsSyncing(false);
    }, 800);
  };

  const handleExport = () => {
    const jsonStr = exportAppDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Q_LGBTQ_Life_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const success = importAppDataJSON(importText);
    if (success) {
      setImportStatus('Data imported successfully!');
      onDataImported();
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1200);
    } else {
      setImportStatus('Failed to import JSON file. Please check file format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setImportText(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-slate-900 border border-purple-500/30 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Local Data Backup
              </h2>
              <p className="text-xs text-slate-400">Portable plaintext JSON backup for local data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Live Sync Status */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sync State</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${
                syncState.isOnline
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${syncState.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {syncState.isOnline ? 'Online • Local data available' : 'Offline • Local data available'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-slate-400 text-[11px]">Last reviewed</div>
                  <div className="font-semibold text-slate-200">{syncState.lastSyncedAt || 'Not reviewed'}</div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-slate-400 text-[11px]">Unsynced Items</div>
                  <div className="font-semibold text-slate-200">{syncState.pendingSyncCount} items cached</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white font-medium text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Updating local status…' : 'Mark local changes reviewed'}
            </button>
          </div>

          {/* Export Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Download className="w-4 h-4 text-purple-400" /> Export Offline Backup JSON
            </h3>
            <p className="text-xs text-slate-400">
              Download supported local Q data as a plaintext JSON file. It is not encrypted by Q; store it only in a secure location you control.
            </p>
            <button
              onClick={handleExport}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs border border-slate-700/80 flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              Download Q Backup (.json)
            </button>
          </div>

          {/* Import Section */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" /> Import & Restore Data
            </h3>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700/80 transition-colors">
                Choose Backup File
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
              <span className="text-xs text-slate-400">or paste raw JSON below</span>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste backup JSON content here..."
              rows={3}
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />

            {importStatus && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                importStatus.includes('successfully')
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {importStatus.includes('successfully') ? <Check className="w-4 h-4" /> : null}
                {importStatus}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs disabled:opacity-50 transition-colors"
            >
              Restore Q Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
