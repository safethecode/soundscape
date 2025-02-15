"use client"

interface AudioSpectrumHeaderProps {
  visualType: "line" | "bar";
  onVisualTypeChange: (type: "line" | "bar") => void;
}

export default function AudioSpectrumHeader({
  visualType,
  onVisualTypeChange,
}: AudioSpectrumHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#2C2C2E] bg-[#1C1C1E] p-4">
      <h2 className="text-lg font-semibold text-white">Soundscape</h2>
      <div className="flex gap-2">
        <button
          onClick={() => onVisualTypeChange("line")}
          className={`rounded-md px-4 py-2 transition-colors ${visualType === "line"
            ? "bg-blue-500 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Line
        </button>
        <button
          onClick={() => onVisualTypeChange("bar")}
          className={`rounded-md px-4 py-2 transition-colors ${visualType === "bar"
            ? "bg-blue-500 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Bar
        </button>
      </div>
    </div>
  )
} 