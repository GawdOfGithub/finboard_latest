"use client"
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Plus, Layout, Save, X, Search, Check, RefreshCw, 
  GripVertical, TrendingUp, Activity, Table as TableIcon,
  ChevronLeft, ChevronRight, Trash2, ArrowUp, ArrowDown, 
  ArrowUpDown, ShieldAlert, Lock, Pencil, Download, Upload, Zap, LayoutTemplate,
  ArrowLeft, AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- RESTORED: Theme Toggle Import ---
import { ThemeToggle } from "../components/theme-toggle";

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getNestedValue = (obj: any, path: string) => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
  return Object.keys(obj).reduce((acc: any, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
};

// --- TYPES ---
type WidgetType = 'card' | 'table' | 'chart';

interface WidgetField {
  id: string;
  label: string;
  path: string;
}

interface WidgetConfig {
  label: string;
  apiUrl: string;
  socketUrl?: string;
  socketSubscribe?: any;
  apiKey?: string;
  apiKeyParam?: string;
  refreshInterval: number;
  fields: WidgetField[];
  rootPath?: string;
}

interface Widget {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
}

// --- TEMPLATES ---
const TEMPLATES: Record<string, Widget[]> = {
  "crypto-live": [
    {
      id: "btc-live",
      type: "card",
      config: {
        label: "Bitcoin Live (WebSocket)",
        apiUrl: "",
        socketUrl: "wss://stream.binance.com:9443/ws/btcusdt@trade",
        refreshInterval: 0,
        fields: [{ id: "1", label: "Price", path: "p" }, { id: "2", label: "Qty", path: "q" }]
      }
    },
    {
      id: "eth-live",
      type: "chart",
      config: {
        label: "Ethereum Live Feed",
        apiUrl: "",
        socketUrl: "wss://stream.binance.com:9443/ws/ethusdt@trade",
        refreshInterval: 0,
        fields: [{ id: "1", label: "Price", path: "p" }]
      }
    }
  ],
  "market-overview": [
    {
      id: "top-coins",
      type: "table",
      config: {
        label: "Top 10 Crypto Assets",
        apiUrl: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false",
        refreshInterval: 60,
        fields: [
          { id: "1", label: "Name", path: "name" },
          { id: "2", label: "Price", path: "current_price" },
          { id: "3", label: "High 24h", path: "high_24h" }
        ]
      }
    }
  ]
};

// --- STORE ---
interface DashboardState {
  widgets: Widget[];
  isEditMode: boolean;
  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, widget: Partial<Widget>) => void;
  setWidgets: (widgets: Widget[]) => void;
  removeWidget: (id: string) => void;
  reorderWidgets: (startIndex: number, endIndex: number) => void;
  toggleEditMode: () => void;
}

const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: [],
      isEditMode: false,
      addWidget: (widget) => set((state) => ({ widgets: [...state.widgets, widget] })),
      updateWidget: (id, updated) => set((state) => ({
        widgets: state.widgets.map((w) => w.id === id ? { ...w, ...updated } : w)
      })),
      setWidgets: (widgets) => set(() => ({ widgets })),
      removeWidget: (id) => set((state) => ({ 
        widgets: state.widgets.filter((w) => w.id !== id) 
      })),
      reorderWidgets: (startIndex, endIndex) => set((state) => {
        const newWidgets = [...state.widgets];
        const [removed] = newWidgets.splice(startIndex, 1);
        newWidgets.splice(endIndex, 0, removed);
        return { widgets: newWidgets };
      }),
      toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),
    }),
    { name: 'finboard-storage-v19-download-check' }
  )
);

// --- COMPONENT: WIDGET RENDERER ---
const WidgetCard = ({ widget, onEdit }: { widget: Widget; index: number; onEdit: (w: Widget) => void }) => {
  const { isEditMode, removeWidget } = useDashboardStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [isLive, setIsLive] = useState(false);

  // Table Features
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [page, setPage] = useState(0);
  const ROWS_PER_PAGE = 5;

  // --- DATA FETCHING & WEBSOCKET LOGIC ---
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const connectSocket = () => {
      if (!widget.config.socketUrl) return;
      
      setLoading(true);
      ws = new WebSocket(widget.config.socketUrl);

      ws.onopen = () => {
        setIsLive(true);
        setLoading(false);
        setError(null);
        if (widget.config.socketSubscribe) {
          ws?.send(JSON.stringify(widget.config.socketSubscribe));
        }
      };

      ws.onmessage = (event) => {
        try {
          const received = JSON.parse(event.data);
          setData(received); 
        } catch (e) {
          console.error("Socket parse error", e);
        }
      };

      ws.onerror = () => {
        setError("WebSocket Error");
        setIsLive(false);
      };

      ws.onclose = () => {
        setIsLive(false);
      };
    };

    const fetchRestData = async () => {
      if (cooldown > 0) return;
      setLoading(true);
      setError(null);
      try {
        let url = widget.config.apiUrl;
        if (widget.config.apiKey && widget.config.apiKeyParam) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}${widget.config.apiKeyParam}=${widget.config.apiKey}`;
        }
        const res = await fetch(url);
        if (res.status === 429) {
            setError("Rate limit exceeded.");
            setCooldown(60); 
            return;
        }
        if (res.status === 401 || res.status === 403) throw new Error("Missing/Invalid API Key");
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to fetch");
      } finally {
        setLoading(false);
      }
    };

    // DECIDE STRATEGY: SOCKET OR REST
    if (widget.config.socketUrl) {
      connectSocket();
    } else if (widget.config.apiUrl) {
      fetchRestData();
      if (widget.config.refreshInterval > 0) {
        pollInterval = setInterval(fetchRestData, widget.config.refreshInterval * 1000);
      }
    }

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [widget.config, refreshTrigger, cooldown]);

  // Cooldown Timer
  useEffect(() => {
    if (cooldown > 0) {
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // --- PROCESSING DATA ---
  const processedData = useMemo(() => {
    if (!data) return [];
    let listData: any[] = [];
    if (Array.isArray(data)) listData = data;
    else if (widget.config.rootPath) listData = getNestedValue(data, widget.config.rootPath) || [];
    else listData = [data]; // Treat single object as row

    if (!Array.isArray(listData)) listData = [];

    let filtered = listData;
    if (searchQuery) {
      filtered = listData.filter(item => {
        return widget.config.fields.some(field => {
          const val = getNestedValue(item, field.path);
          return String(val).toLowerCase().includes(searchQuery.toLowerCase());
        });
      });
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valA = getNestedValue(a, sortConfig.key!);
        const valB = getNestedValue(b, sortConfig.key!);
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [data, searchQuery, sortConfig, widget.config]);

  const handleSort = (path: string) => {
    setSortConfig(current => ({
      key: path,
      direction: current.key === path && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // --- RENDERERS ---
  const renderChart = () => {
    let chartData = [];
    if (Array.isArray(data)) {
        chartData = data.map((item, i) => ({
            name: i,
            value: getNestedValue(item, widget.config.fields[0]?.path)
        }));
    } else {
        const val = Number(getNestedValue(data, widget.config.fields[0]?.path));
        // Mock history around the current value
        chartData = Array.from({ length: 15 }).map((_, i) => ({
            name: i,
            value: val ? val * (0.99 + Math.random() * 0.02) : 0
        }));
        // Push actual value at end
        if(val) chartData.push({ name: 15, value: val });
    }

    return (
      <div className="flex-1 w-full h-full min-h-[150px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis dataKey="name" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
            <Area type="monotone" dataKey="value" stroke="#10B981" fill={`url(#grad-${widget.id})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="absolute top-2 right-2 text-right pointer-events-none">
             <div className="text-xl font-bold text-white flex items-center justify-end gap-2">
                {isLive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                {chartData[chartData.length - 1]?.value?.toFixed(2)}
             </div>
             <div className="text-[10px] text-gray-400">{widget.config.fields[0]?.label}</div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (processedData.length === 0 && !loading) return <div className="text-gray-500 text-xs p-4 text-center">No data found.</div>;
    const totalPages = Math.ceil(processedData.length / ROWS_PER_PAGE);
    const currentData = processedData.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-gray-700/50">
             <div className="relative">
                <Search className="absolute left-2.5 top-2 text-gray-500" size={14} />
                <input 
                    className="w-full bg-[#151820] border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
                    placeholder="Search table..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                />
             </div>
        </div>
        <div className="flex-1 overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="border-b border-gray-700 text-gray-400 bg-gray-900/20">
                        {widget.config.fields.map(f => (
                            <th key={f.id} onClick={() => handleSort(f.path)} className="p-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition group select-none">
                                <div className="flex items-center gap-1">
                                    {f.label}
                                    <div className="text-gray-600 group-hover:text-gray-400">
                                        {sortConfig.key === f.path ? (sortConfig.direction === 'asc' ? <ArrowUp size={10}/> : <ArrowDown size={10}/>) : <ArrowUpDown size={10} />}
                                    </div>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                    {currentData.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                            {widget.config.fields.map(f => {
                                const val = getNestedValue(row, f.path);
                                return (
                                    <td key={f.id} className="p-3 whitespace-nowrap text-gray-300">
                                        {typeof val === 'number' ? val.toLocaleString(undefined, {maximumFractionDigits:2}) : String(val)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="flex justify-between items-center p-2 border-t border-gray-800 bg-gray-900/20 text-[10px] text-gray-500">
             <span>{processedData.length} items</span>
             <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"><ChevronLeft size={14}/></button>
                <span>{page + 1} / {totalPages || 1}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"><ChevronRight size={14}/></button>
             </div>
        </div>
      </div>
    );
  };

  const renderCard = () => (
      <div className="flex-1 p-4 flex flex-col justify-center gap-3">
        {widget.config.fields.map((field) => {
           const val = getNestedValue(data, field.path);
           return (
             <div key={field.id} className="flex justify-between items-center border-b border-gray-800/50 last:border-0 pb-2 last:pb-0">
                <span className="text-xs text-gray-400">{field.label}</span>
                <div className="text-right">
                    <span className="text-base font-semibold block text-gray-200">{typeof val === 'number' ? val.toLocaleString() : (val || '-')}</span>
                </div>
             </div>
           );
        })}
      </div>
  );

  return (
    <div className="h-full flex flex-col relative group">
       <div className={cn("bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden flex flex-col h-full transition-all duration-300", isEditMode ? 'hover:border-blue-500/50' : 'hover:border-gray-600')}>
          <div className="p-3 border-b border-gray-700/50 flex justify-between items-center bg-gray-900/30">
            <div className="flex items-center gap-2 overflow-hidden">
               {isEditMode && <GripVertical size={16} className="text-gray-500 cursor-grab active:cursor-grabbing" />}
               <h3 className="font-semibold text-xs text-gray-300 truncate flex items-center gap-2">
                 {widget.config.label}
                 {isLive && <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" title="Live Socket"></span>}
               </h3>
            </div>
            <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); setRefreshTrigger(p => p+1); }} className="p-1.5 text-gray-400 hover:text-green-400 rounded hover:bg-gray-700/50">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                {isEditMode && <button onClick={() => onEdit(widget)} className="p-1.5 text-gray-400 hover:text-blue-400 rounded hover:bg-blue-900/20"><Pencil size={14} /></button>}
                {isEditMode && <button onClick={() => removeWidget(widget.id)} className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-900/20"><X size={14} /></button>}
            </div>
          </div>
          
          {cooldown > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-orange-400 gap-2 p-4 text-center">
                <ShieldAlert size={24} />
                <span className="text-xs font-bold">API Rate Limit</span>
                <span className="text-[10px] text-gray-500">Cooling down: {cooldown}s</span>
            </div>
          ) : loading && !data ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs animate-pulse">Connecting...</div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-2 p-4 text-center">
                <span className="text-xs font-bold">Connection Failed</span>
                <span className="text-[10px] text-gray-500">{error}</span>
                {error.includes("Key") && <button onClick={() => onEdit(widget)} className="mt-2 bg-gray-700 text-white px-3 py-1 rounded text-xs hover:bg-gray-600">Add Key</button>}
            </div>
          ) : widget.type === 'chart' ? renderChart() : widget.type === 'table' ? renderTable() : renderCard()}
       </div>
    </div>
  );
};

// --- COMPONENT: CONFIG MODAL (Unified Add/Edit) ---
interface ModalProps {
    onClose: () => void;
    editWidget?: Widget | null;
}

const ConfigWidgetModal = ({ onClose, editWidget }: ModalProps) => {
  const { addWidget, updateWidget } = useDashboardStore();
  
  // STATE: Mobile View Mode ('config' vs 'explorer')
  const [mobileView, setMobileView] = useState<'config' | 'explorer'>('config');

  const [name, setName] = useState(editWidget?.config.label || '');
  
  // CoinGecko Defaults (No Key)
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

  // REMOVED AUTO-TEST on mount. User must now click "Add Field" to see fields.

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

      // UPDATED: Automatically switch to Explorer view on Mobile when API loads successfully
      // Only switch if we are currently in config mode (to avoid re-triggering weirdness)
      if(window.innerWidth < 1024) {
          setMobileView('explorer');
      }

    } catch (error: unknown) {
      setApiRawData(null);
      const errorMessage = error instanceof Error ? error.message : "Unknown Error";
      // Removed silent fail check since we are manual now
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
        
        {/* MODAL BODY */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            
            {/* --- CONFIG PANEL --- */}
            {/* LOGIC: Mobile: Show ONLY if mobileView is 'config'. Desktop: Always Show. */}
            <div className={cn(
                "flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-6 border-r border-gray-800",
                mobileView === 'explorer' ? 'hidden lg:block' : 'block'
            )}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={labelStyle}>Name</label><input className={inputStyle} value={name} onChange={e => setName(e.target.value)} /></div>
                    <div><label className={labelStyle}>Refresh (Sec)</label><input type="number" className={inputStyle} value={interval} onChange={e => setInterval(Number(e.target.value))} /></div>
                </div>
                {/* TABS */}
                <div className="space-y-4">
                    <div className="flex border-b border-gray-700">
                        <button className={`pb-2 px-4 text-xs font-bold border-b-2 ${!socketUrl ? 'border-green-500 text-white' : 'border-transparent text-gray-500'}`} onClick={() => setSocketUrl('')}>REST API</button>
                        <button className={`pb-2 px-4 text-xs font-bold border-b-2 ${socketUrl ? 'border-green-500 text-white' : 'border-transparent text-gray-500'}`} onClick={() => setSocketUrl('wss://stream.binance.com:9443/ws/btcusdt@trade')}>WebSocket (Live)</button>
                    </div>
                    
                    {!socketUrl ? (
                       <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 space-y-4">
                           <div className="flex items-center gap-2 mb-2"><Lock size={14} className="text-green-500"/><span className="text-xs font-bold text-gray-300">REST Configuration</span></div>
                           <div><label className={labelStyle}>API URL</label><input className={inputStyle} value={apiUrl} onChange={e => setApiUrl(e.target.value)} /></div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="col-span-1"><label className={labelStyle}>Param Name</label><input className={inputStyle} value={apiKeyParam} onChange={e => setApiKeyParam(e.target.value)} /></div>
                                <div className="col-span-1 md:col-span-2"><label className={labelStyle}>API Key</label><input type="password" className={inputStyle} value={apiKey} onChange={e => setApiKey(e.target.value)} /></div>
                           </div>
                           
                           {/* UPDATED: Renamed Button to "Add Field" */}
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
                            <button key={type.id} onClick={() => setDisplayMode(type.id as WidgetType)} className={`p-3 rounded-lg border flex flex-col items-center gap-2 ${displayMode === type.id ? 'bg-green-600/20 border-green-500 text-green-400' : 'border-gray-700 bg-[#1A1D26] text-gray-400'}`}>
                                <type.icon size={20} />
                                <span className="text-xs">{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-end"><label className={labelStyle}>Fields ({selectedFields.length})</label></div>
                    {/* Socket Mode Field Adder */}
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
            
            {/* --- EXPLORER PANEL --- */}
            {/* LOGIC: Mobile: Show ONLY if mobileView is 'explorer'. Desktop: Always Show (w-300). */}
            {!socketUrl && (
                <div className={cn(
                    "bg-[#151820] border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col transition-all",
                    "w-full lg:w-[300px]",
                    mobileView === 'explorer' ? 'flex flex-1' : 'hidden lg:flex'
                )}>
                    {/* MOBILE-ONLY HEADER with DONE button */}
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
        
        {/* FOOTER (Cancel / Create) */}
        {/* Logic: Hide footer on mobile if we are in explorer mode, because user needs to click 'Done' first */}
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

// --- COMPONENT: TEMPLATE SELECTOR (Updated with Custom Confirmation Modal) ---
const TemplateSelector = ({ onClose }: { onClose: () => void }) => {
  const { setWidgets } = useDashboardStore();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const confirmLoad = () => {
      if (confirmKey && TEMPLATES[confirmKey]) {
          setWidgets(TEMPLATES[confirmKey]);
          onClose();
      }
  };

  // If a template is selected for confirmation, show this UI instead of the list
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
                        <button onClick={confirmLoad} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition shadow-lg shadow-red-900/20">Confirm</button>
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
                  {/* CRYPTO LIVE */}
                  <button onClick={() => setConfirmKey('crypto-live')} className="p-4 border border-gray-700 rounded-xl hover:border-green-500 hover:bg-gray-800 text-left transition group relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-green-600 text-[10px] px-2 py-0.5 text-white font-bold rounded-bl-lg">NO KEY</div>
                      <div className="flex items-center gap-2 mb-2 text-green-400"><Zap size={20}/><span className="font-bold text-lg">Crypto Live</span></div>
                      <p className="text-xs text-gray-400">Real-time WebSocket feeds for Bitcoin and Ethereum.</p>
                  </button>

                  {/* MARKET OVERVIEW */}
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

// --- MAIN PAGE COMPONENT ---
export default function DashboardPage() {
  const { widgets, isEditMode, toggleEditMode, reorderWidgets, setWidgets } = useDashboardStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [editWidget, setEditWidget] = useState<Widget | null>(null);
  const [mounted, setMounted] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (index: number) => { if (draggedIndex !== null && draggedIndex !== index) reorderWidgets(draggedIndex, index); setDraggedIndex(null); };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(widgets, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `finboard-config.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target?.result as string);
            if (Array.isArray(imported)) { if(confirm("Replace dashboard?")) setWidgets(imported); }
        } catch (e) { alert("Invalid file"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div><h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 tracking-tight">FinBoard</h1><p className="text-sm text-gray-500 mt-2">Real-time customizable financial analytics</p></div>
          <div className="flex flex-wrap gap-3">
             <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                <button onClick={() => fileInputRef.current?.click()} title="Import" className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"><Upload size={18}/></button>
                {widgets.length > 0 && (
                  <button onClick={handleExport} title="Export" className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"><Download size={18}/></button>
                )}
             </div>
             <button onClick={() => setIsTemplateOpen(true)} className="px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 hover:text-white text-gray-400 flex gap-2 items-center"><LayoutTemplate size={18}/> Templates</button>
             <button onClick={toggleEditMode} className={`px-4 py-2.5 rounded-lg flex gap-2 border transition ${isEditMode ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' : 'border-gray-700 bg-gray-800'}`}>{isEditMode ? <Save size={18}/> : <Layout size={18}/>} <span>{isEditMode ? 'Save Layout' : 'Edit'}</span></button>
             <button onClick={() => { setEditWidget(null); setIsModalOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg flex gap-2 shadow-lg shadow-green-900/20"><Plus size={18}/> <span>Add Widget</span></button>
             <ThemeToggle />
          </div>
        </header>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20`}>
            {widgets.map((widget, index) => {
                const isTable = widget.type === 'table';
                const spanClass = isTable ? 'col-span-1 md:col-span-2 lg:col-span-2' : 'col-span-1';
                return (
                    <div key={widget.id} draggable={isEditMode} onDragStart={() => isEditMode && setDraggedIndex(index)} onDragOver={handleDragOver} onDrop={() => handleDrop(index)} className={cn("transition-transform h-[350px]", spanClass, isEditMode && 'cursor-move', draggedIndex === index && 'opacity-50 scale-95 border-2 border-dashed border-gray-500 rounded-xl')}>
                        <WidgetCard widget={widget} index={index} onEdit={(w) => { setEditWidget(w); setIsModalOpen(true); }} />
                    </div>
                );
            })}
            {widgets.length === 0 && (
                <div className="col-span-full h-64 border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-600"><p>No widgets added yet.</p><button onClick={() => setIsTemplateOpen(true)} className="text-green-500 hover:underline mt-2 font-bold">Load a Template</button></div>
            )}
        </div>
        {isModalOpen && <ConfigWidgetModal editWidget={editWidget} onClose={() => setIsModalOpen(false)} />}
        {isTemplateOpen && <TemplateSelector onClose={() => setIsTemplateOpen(false)} />}
      </div>
    </div>
  );
}