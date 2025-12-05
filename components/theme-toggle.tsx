"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button onClick={toggleTheme} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition">
      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
