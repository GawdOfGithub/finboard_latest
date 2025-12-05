"use client";

import React, { useRef } from 'react';
import { 
  Plus, Layout, Save, Upload, Download, LayoutTemplate,
} from 'lucide-react';
import { ThemeToggle } from "./theme-toggle";
import { useDashboardStore } from "../lib/store";
import { Widget } from "../lib/types";

interface DashboardHeaderProps {
    onAddWidget: () => void;
    onOpenTemplates: () => void;
}

export function DashboardHeader({ onAddWidget, onOpenTemplates }: DashboardHeaderProps) {
    const { widgets, isEditMode, toggleEditMode, setWidgets } = useDashboardStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    return (
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 tracking-tight">FinBoard</h1>
                <p className="text-sm text-gray-500 mt-2">Real-time customizable financial analytics</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                    <button onClick={() => fileInputRef.current?.click()} title="Import" className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"><Upload size={18}/></button>
                    {widgets.length > 0 && (
                        <button onClick={handleExport} title="Export" className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"><Download size={18}/></button>
                    )}
                </div>
                <button onClick={onOpenTemplates} className="px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 hover:text-white text-gray-400 flex gap-2 items-center"><LayoutTemplate size={18}/> Templates</button>
                <button onClick={toggleEditMode} className={`px-4 py-2.5 rounded-lg flex gap-2 border transition ${isEditMode ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' : 'border-gray-700 bg-gray-800'}`}>{isEditMode ? <Save size={18}/> : <Layout size={18}/>} <span>{isEditMode ? 'Save Layout' : 'Edit'}</span></button>
                <button onClick={onAddWidget} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg flex gap-2 shadow-lg shadow-green-900/20"><Plus size={18}/> <span>Add Widget</span></button>
                <ThemeToggle />
            </div>
        </header>
    );
}
