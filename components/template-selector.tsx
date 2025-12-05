"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, Zap, LayoutTemplate, RefreshCw } from 'lucide-react';

import { cn } from "../lib/utils";
import { useDashboardStore } from "../lib/store";
import { TEMPLATES } from "../lib/templates";

interface TemplateSelectorProps {
    onClose: () => void;
}

export const TemplateSelector = ({ onClose }: TemplateSelectorProps) => {
  const { setWidgets } = useDashboardStore();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirmLoad = () => {
      if (confirmKey && TEMPLATES[confirmKey]) {
          setIsLoading(true);
          setWidgets(TEMPLATES[confirmKey]);
          onClose();
          setIsLoading(false);
      }
  };

  if (confirmKey) {
      return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmKey(null)}>
            <div className="bg-[#0F1219] w-full max-w-md rounded-xl border border-gray-800 p-6 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-red-900/30 flex items-center justify-center text-red-500">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Replace Dashboard?</h2>
                        <p className="text-sm text-gray-400 mt-2">Loading this template will remove all your current widgets. This action cannot be undone.</p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button onClick={() => setConfirmKey(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition">Cancel</button>
                        <button onClick={confirmLoad} disabled={isLoading} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition shadow-lg shadow-red-900/20">
                            {isLoading ? 'Loading...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
          <div className="bg-[#0F1219] w-full max-w-3xl rounded-xl border border-gray-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between mb-6">
                  <div>
                      <h2 className="text-xl font-bold text-white">Choose Template</h2>
                      <p className="text-xs text-gray-500 mt-1">Select a pre-configured dashboard layout</p>
                  </div>
                  <button onClick={onClose}><X className="text-gray-400 hover:text-white"/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => setConfirmKey('crypto-live')} className="p-4 border border-gray-700 rounded-xl hover:border-green-500 hover:bg-gray-800 text-left transition group relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-green-600 text-[10px] px-2 py-0.5 text-white font-bold rounded-bl-lg">NO KEY</div>
                      <div className="flex items-center gap-2 mb-2 text-green-400"><Zap size={20}/><span className="font-bold text-lg">Crypto Live</span></div>
                      <p className="text-xs text-gray-400">Real-time WebSocket feeds for Bitcoin and Ethereum.</p>
                  </button>

                  <button onClick={() => setConfirmKey('market-overview')} className="p-4 border border-gray-700 rounded-xl hover:border-blue-500 hover:bg-gray-800 text-left transition group relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-green-600 text-[10px] px-2 py-0.5 text-white font-bold rounded-bl-lg">NO KEY</div>
                      <div className="flex items-center gap-2 mb-2 text-blue-400"><LayoutTemplate size={20}/><span className="font-bold text-lg">Market Overview</span></div>
                      <p className="text-xs text-gray-400">Top 10 Crypto table and detailed Bitcoin cards using CoinGecko.</p>
                  </button>
              </div>
          </div>
      </div>
  );
};
