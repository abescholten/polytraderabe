import { PortfolioSummary } from '@/components/dashboard/portfolio-summary'
import { ActiveSignals } from '@/components/dashboard/active-signals'
import { RecentTrades } from '@/components/dashboard/recent-trades'
import { StrategyHealth } from '@/components/dashboard/strategy-health'

export default function DashboardPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <PortfolioSummary />
      <ActiveSignals />
      <RecentTrades />
      <StrategyHealth />
    </div>
  )
}
