"use client"

import { Menu } from "lucide-react"

interface AudioSpectrumHeaderProps {
  visualType: "line" | "bar";
  onVisualTypeChange: (type: "line" | "bar") => void;
}

export default function AudioSpectrumHeader({
  visualType,
  onVisualTypeChange,
}: AudioSpectrumHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#2C2C2E] bg-[#1C1C1E] px-4 py-2">
      <div className="flex items-center gap-2">
        <Menu className="size-4 cursor-pointer text-white" />
        <h2 className="text-lg font-semibold text-white">SoundScape</h2>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onVisualTypeChange("line")}
          className={`rounded px-2 transition-colors ${visualType === "line"
            ? "bg-neutral-500 text-white"
            : "bg-neutral-700 text-gray-400 hover:bg-neutral-600"
          }`}
        >
          Line
        </button>
        <button
          onClick={() => onVisualTypeChange("bar")}
          className={`rounded px-2 transition-colors ${visualType === "bar"
            ? "bg-neutral-500 text-white"
            : "bg-neutral-700 text-gray-400 hover:bg-neutral-600"
          }`}
        >
          Bar
        </button>
      </div>
    </div>
  )
} 