'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/algorithms': 'Algorithms',
  '/signals': 'Signals',
  '/portfolio': 'Portfolio',
  '/markets': 'Markets',
  '/weather': 'Weather Forecasts',
  '/settings': 'Settings',
}

export function Header() {
  const pathname = usePathname()
  const title = pageTitles[pathname]
    || (pathname.startsWith('/weather/') ? 'Weather Forecasts' : 'PolyTrader')

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#2e3240] bg-[#1a1d27] px-6">
      <h1 className="text-lg font-semibold text-[#e8eaed]">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[#8b8f9a]">Connected</span>
        </div>
      </div>
    </header>
  )
}
