"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, X, Search, Check, RefreshCw,
  Activity, Table as TableIcon, TrendingUp,
  Trash2, ArrowLeft, AlertTriangle,
  Lock, Zap
} from 'lucide-react';

import { cn, flattenObject, getNestedValue } from "../lib/utils";
import { WidgetType, WidgetField, WidgetConfig, Widget } from "../lib/types";
import { useDashboardStore } from "../lib/store";

interface ConfigWidgetModalProps {
    onClose: () => void;
    editWidget?: Widget | null;
}

export const ConfigWidgetModal = ({ onClose, editWidget }: ConfigWidgetModalProps) => {
  const { addWidget, updateWidget } = useDashboardStore();
  
  const [mobileView, setMobileView] = useState<'config' | 'explorer'>('config');
  const [name, setName] = useState(editWidget?.config.label || '');
  
  const [apiUrl, setApiUrl] = useState(editWidget?.config.apiUrl || 'https://api.coingecko.com/api/v3/coins/bitcoin'); 
  const [apiKey, setApiKey] = useState(editWidget?.config.apiKey || '');
  const [apiKeyParam, setApiKeyParam] = useState(editWidget?.config.apiKeyParam || ''); 
  
  const [interval, setInterval] = useState(editWidget?.config.refreshInterval || 30);
  const [displayMode, setDisplayMode] = useState<WidgetType>(editWidget?.type || 'card');
  const [selectedFields, setSelectedFields] = useState<WidgetField[]>(editWidget?.config.fields || []);
  
  const [socketUrl, setSocketUrl] = useState(editWidget?.config.socketUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [apiRawData, setApiRawData] = useState<any>(null);
  const [availablePaths, setAvailablePaths] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');


  const handleTestApi = async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    try {
      let url = apiUrl;
      if (apiKey) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}${apiKeyParam}=${apiKey}`;
      }
      const res = await fetch(url);
      if (res.status === 401 || res.status === 403) throw new Error("Invalid API Key");
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      setApiRawData(data);
      if (Array.isArray(data) && data.length > 0) {
          setAvailablePaths(flattenObject(data[0]));
          if (!editWidget) setDisplayMode('table'); 
      } else {
          setAvailablePaths(flattenObject(data));
      }

      if(window.innerWidth < 1024) {
          setMobileView('explorer');
      }

    } catch (error: unknown) {
      setApiRawData(null);
      const errorMessage = error instanceof Error ? error.message : "Unknown Error";
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplorerClick = (path: string) => {
    const parts = path.split('.');
    let label = parts[parts.length - 1];
    label = label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' ');
    const newField: WidgetField = { id: Math.random().toString(36).substr(2, 9), label, path };
    setSelectedFields([...selectedFields, newField]);
  };

  const handleFinish = () => {
    if (!name || selectedFields.length === 0) return;
    const config: WidgetConfig = {
        label: name, apiUrl, apiKey, apiKeyParam, refreshInterval: interval, fields: selectedFields,
        rootPath: Array.isArray(apiRawData) ? undefined : undefined,
        socketUrl: socketUrl || undefined
    };
    if (editWidget) updateWidget(editWidget.id, { type: displayMode, config });
    else addWidget({ id: Math.random().toString(36).substr(2, 9), type: displayMode, config });
    onClose();
  };

  const labelStyle = "block text-xs uppercase font-bold text-gray-500 mb-1";
  const inputStyle = "w-full bg-[#1A1D26] border border-gray-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition placeholder-gray-600";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0F1219] w-full max-w-5xl rounded-xl border border-gray-800 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#151820]">
          <h2 className="text-xl font-bold text-white">{editWidget ? 'Edit Widget' : 'Add Widget'}</h2>
          <button onClick={onClose}><X className="text-gray-400 hover:text-white" /></button>
        </div>
        
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            
            <div className={cn(
                "flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-6 border-r border-gray-800",
                mobileView === 'explorer' ? 'hidden lg:block' : 'block'
            )}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={labelStyle}>Name</label><input className={inputStyle} value={name} onChange={e => setName(e.target.value)} /></div>
                    <div><label className={labelStyle}>Refresh (Sec)</label><input type="number" className={inputStyle} value={interval} onChange={e => setInterval(Number(e.target.value))} /></div>
                </div>
                <div>
                    <div className="flex border-b border-gray-700">
                        <button className={cn("pb-2 px-4 text-xs font-bold border-b-2", !socketUrl ? 'border-green-500 text-white' : 'border-transparent text-gray-500')} onClick={() => setSocketUrl('')}>REST API</button>
                        <button className={cn("pb-2 px-4 text-xs font-bold border-b-2", socketUrl ? 'border-green-500 text-white' : 'border-transparent text-gray-500')} onClick={() => setSocketUrl('wss://stream.binance.com:9443/ws/btcusdt@trade')}>WebSocket (Live)</button>
                    </div>
                    
                    {!socketUrl ? (
                       <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 space-y-4">
                           <div className="flex items-center gap-2 mb-2"><Lock size={14} className="text-green-500"/><span className="text-xs font-bold text-gray-300">REST Configuration</span></div>
                           <div><label className={labelStyle}>API URL</label><input className={inputStyle} value={apiUrl} onChange={e => setApiUrl(e.target.value)} /></div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="col-span-1"><label className={labelStyle}>Param Name</label><input className={inputStyle} value={apiKeyParam} onChange={e => setApiKeyParam(e.target.value)} /></div>
                                <div className="col-span-1 md:col-span-2"><label className={labelStyle}>API Key</label><input type="password" className={inputStyle} value={apiKey} onChange={e => setApiKey(e.target.value)} /></div>
                           </div>
                           
                           <button onClick={handleTestApi} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">{isLoading ? <RefreshCw className="animate-spin" size={14}/> : <Plus size={14}/>} Add Field</button>
                       </div>
                    ) : (
                       <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 space-y-4">
                           <div className="flex items-center gap-2 mb-2"><Zap size={14} className="text-yellow-500"/><span className="text-xs font-bold text-gray-300">WebSocket Configuration</span></div>
                           <div><label className={labelStyle}>Socket URL</label><input className={inputStyle} value={socketUrl} onChange={e => setSocketUrl(e.target.value)} /></div>
                           <p className="text-[10px] text-gray-500">Example: wss://stream.binance.com:9443/ws/btcusdt@trade. Fields map to JSON keys (e.g., 'p' for price).</p>
                       </div>
                    )}
                </div>

                <div>
                    <label className={labelStyle}>Display Mode</label>
                    <div className="grid grid-cols-3 gap-3">
                        {[{id: 'card', icon: Activity, label: 'Card'}, {id: 'table', icon: TableIcon, label: 'Table'}, {id: 'chart', icon: TrendingUp, label: 'Chart'}].map(type => (
                            <button key={type.id} onClick={() => setDisplayMode(type.id as WidgetType)} className={cn("p-3 rounded-lg border flex flex-col items-center gap-2", displayMode === type.id ? 'bg-green-600/20 border-green-500 text-green-400' : 'border-gray-700 bg-[#1A1D26] text-gray-400')}>
                                <type.icon size={20} />
                                <span className="text-xs">{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-end"><label className={labelStyle}>Fields ({selectedFields.length})</label></div>
                    {socketUrl && (
                        <div className="bg-[#151820] p-3 rounded border border-gray-700 mb-2">
                            <p className="text-[10px] text-gray-400 mb-2">Add manual fields for WebSocket JSON keys.</p>
                            <button onClick={() => setSelectedFields([...selectedFields, { id: Math.random().toString(), label: 'Price', path: 'p' }])} className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600 text-white mr-2">+ Price (p)</button>
                            <button onClick={() => setSelectedFields([...selectedFields, { id: Math.random().toString(), label: 'Quantity', path: 'q' }])} className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600 text-white">+ Qty (q)</button>
                        </div>
                    )}
                    <div className="space-y-2">
                        {selectedFields.map((field) => (
                            <div key={field.id} className="flex justify-between items-center bg-[#1A1D26] p-3 rounded border border-gray-700 group">
                                <div className="flex flex-col"><span className="text-sm font-bold text-gray-200">{field.label}</span><span className="text-xs text-gray-500 font-mono">{field.path}</span></div>
                                <button onClick={() => setSelectedFields(selectedFields.filter(f => f.id !== field.id))} className="text-gray-500 hover:text-red-400 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-2"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {!socketUrl && (
                <div className={cn(
                    "bg-[#151820] border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col transition-all",
                    "w-full lg:w-[300px]",
                    mobileView === 'explorer' ? 'flex flex-1' : 'hidden lg:flex'
                )}>
                    <div className="lg:hidden p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center shrink-0">
                         <div className="flex items-center gap-2">
                            <button onClick={() => setMobileView('config')} className="p-1"><ArrowLeft size={18} className="text-gray-400"/></button>
                            <span className="text-sm font-bold text-white">Select Fields</span>
                         </div>
                         <button onClick={() => setMobileView('config')} className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-bold shadow-lg shadow-green-900/20">
                             Done
                         </button>
                    </div>

                    <div className="p-4 border-b border-gray-800"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Available Fields</h3><input className={inputStyle} placeholder="Search keys..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {Object.entries(availablePaths).filter(([k]) => k.toLowerCase().includes(searchQuery.toLowerCase())).map(([path, value]) => (
                                <button key={path} onClick={() => handleExplorerClick(path)} className="w-full text-left p-4 lg:p-2 rounded hover:bg-gray-800 active:bg-gray-700 border-b border-gray-800/50 group transition-colors">
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs font-mono text-green-400 break-all">{path}</div>
                                        <Plus size={16} className="text-gray-500 lg:opacity-0 lg:group-hover:opacity-100"/>
                                    </div>
                                    <div className="text-[10px] text-gray-500 truncate mt-1">{String(value)}</div>
                                </button>
                            ))}
                    </div>
                </div>
            )}
        </div>
        
        <div className={cn(
            "p-5 border-t border-gray-800 bg-[#151820] flex justify-end gap-3",
            mobileView === 'explorer' ? 'hidden lg:flex' : 'flex'
        )}>
            <button onClick={onClose} className="px-6 py-2 rounded-lg text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleFinish} disabled={!name || selectedFields.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded-lg font-medium shadow-lg shadow-green-900/20 text-sm disabled:opacity-50 disabled:cursor-not-allowed">{editWidget ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
};
