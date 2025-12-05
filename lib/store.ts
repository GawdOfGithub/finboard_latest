import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Widget } from "./types";

export interface DashboardState {
  widgets: Widget[];
  isEditMode: boolean;
  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, widget: Partial<Widget>) => void;
  setWidgets: (widgets: Widget[]) => void;
  removeWidget: (id: string) => void;
  reorderWidgets: (startIndex: number, endIndex: number) => void;
  toggleEditMode: () => void;
}

export const useDashboardStore = create<DashboardState>()(
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
