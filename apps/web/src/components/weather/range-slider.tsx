'use client'

interface RangeSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function RangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'dagen',
  onChange,
}: RangeSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-[#8b8f9a]">{label}</span>
        <span className="text-xs font-mono font-semibold text-[#e8eaed]">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2e3240] accent-[#3b82f6]"
      />
      <div className="flex justify-between">
        <span className="text-[10px] font-mono text-[#4b5263]">{min}</span>
        <span className="text-[10px] font-mono text-[#4b5263]">{max}</span>
      </div>
    </div>
  )
}
