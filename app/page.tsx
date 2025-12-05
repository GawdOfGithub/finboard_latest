"use client"
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, X
} from 'lucide-react';

import { ThemeToggle } from "../components/theme-toggle";
import { DashboardHeader } from "../components/dashboard-header";
import { WidgetCard } from "../components/widget-card";
import { ConfigWidgetModal } from "../components/config-widget-modal";
import { TemplateSelector } from "../components/template-selector";

import { cn, getNestedValue, flattenObject } from "../lib/utils";

import { Widget } from "../lib/types";

import { TEMPLATES } from "../lib/templates";

import { useDashboardStore } from "../lib/store";

const Dashboard = () => {
  const { widgets, isEditMode, toggleEditMode, addWidget, updateWidget, removeWidget, reorderWidgets, setWidgets } = useDashboardStore();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editWidget, setEditWidget] = useState<Widget | null>(null);

  useEffect(() => {
    const savedWidgets = localStorage.getItem('finboard-widgets');
    if (savedWidgets) {
      try {
        const parsed = JSON.parse(savedWidgets);
        setWidgets(parsed);
      } catch (e) {
        console.error("Failed to parse saved widgets", e);
      }
    }
  }, [setWidgets]);

  useEffect(() => {
    localStorage.setItem('finboard-widgets', JSON.stringify(widgets));
  }, [widgets]);

  const handleAddWidget = () => {
    setEditWidget(null);
    setShowConfigModal(true);
  };

  const handleEditWidget = (widget: Widget) => {
    setEditWidget(widget);
    setShowConfigModal(true);
  };

  const handleDeleteWidget = (id: string) => {
    removeWidget(id);
  };

  const handleReorder = (startIndex: number, endIndex: number) => {
    reorderWidgets(startIndex, endIndex);
  };

  const handleWidgetClick = (widget: Widget) => {
    if (isEditMode) {
      handleEditWidget(widget);
    } else {
      toggleEditMode();
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <DashboardHeader
        onAddWidget={() => { setEditWidget(null); setShowConfigModal(true); }}
        onOpenTemplates={() => setShowConfigModal(true)}
      />

      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {widgets.map((widget, index) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              index={index}
              onEdit={handleEditWidget}
            />
          ))}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1 flex items-center justify-center bg-gray-800/50 border border-gray-700/50 rounded-xl cursor-pointer hover:border-blue-500/50 transition-all duration-300" onClick={handleAddWidget}>
            <Plus size={32} className="text-gray-500" />
          </div>
        </div>
      </div>
      {showConfigModal && <ConfigWidgetModal onClose={() => setShowConfigModal(false)} editWidget={editWidget} />}
    </div>
  );
};

export default Dashboard;