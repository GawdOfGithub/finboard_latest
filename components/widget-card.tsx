"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Search, Check, RefreshCw, 
  GripVertical, TrendingUp, Activity, Table as TableIcon,
  ChevronLeft, ChevronRight, Trash2, ArrowUp, ArrowDown, 
  ArrowUpDown, ShieldAlert, Lock, Pencil, ArrowLeft, AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer 
} from 'recharts';

import { cn, getNestedValue } from "../lib/utils";
import { WidgetType, WidgetField, WidgetConfig, Widget } from "../lib/types";
import { useDashboardStore } from "../lib/store";

interface WidgetCardProps {
  widget: Widget;
  index: number;
  onEdit: (w: Widget) => void;
}

export const WidgetCard = ({ widget, onEdit }: WidgetCardProps) => {
  const { isEditMode, removeWidget } = useDashboardStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [isLive, setIsLive] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [page, setPage] = useState(0);
  const ROWS_PER_PAGE = 5;

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

  useEffect(() => {
    if (cooldown > 0) {
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const processedData = useMemo(() => {
    if (!data) return [];
    let listData: any[] = [];
    if (Array.isArray(data)) listData = data;
    else if (widget.config.rootPath) listData = getNestedValue(data, widget.config.rootPath) || [];
    else listData = [data];

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

  const renderChart = () => {
    let chartData = [];
    if (Array.isArray(data)) {
        chartData = data.map((item, i) => ({
            name: i,
            value: getNestedValue(item, widget.config.fields[0]?.path)
        }));
    } else {
        const val = Number(getNestedValue(data, widget.config.fields[0]?.path));
        chartData = Array.from({ length: 15 }).map((_, i) => ({
            name: i,
            value: val ? val * (0.99 + Math.random() * 0.02) : 0
        }));
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
