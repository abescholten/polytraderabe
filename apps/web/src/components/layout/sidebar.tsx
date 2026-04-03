'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Brain,
  Zap,
  Briefcase,
  BarChart3,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/algorithms', label: 'Algorithms', icon: Brain },
  { href: '/signals', label: 'Signals', icon: Zap },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/markets', label: 'Markets', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#2e3240] bg-[#1a1d27]">
      <div className="flex h-14 items-center gap-2 border-b border-[#2e3240] px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/20">
          <BarChart3 className="size-4 text-blue-500" />
        </div>
        <span className="text-sm font-semibold text-[#e8eaed]">PolyTrader</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'text-[#8b8f9a] hover:bg-[#2e3240]/50 hover:text-[#e8eaed]'
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[#2e3240] p-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2">
          <div className="size-2 rounded-full bg-green-500" />
          <span className="text-xs text-[#8b8f9a]">System Online</span>
        </div>
      </div>
    </aside>
  )
}
