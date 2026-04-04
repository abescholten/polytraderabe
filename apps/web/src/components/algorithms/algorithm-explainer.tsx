import { Layers, RefreshCw, TrendingUp, Target, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type React from 'react'

interface AlgorithmInfo {
  id: string
  name: string
  tagline: string
  description: string
  steps: [string, string, string]
  bestFor: string
  risk: 'laag' | 'gemiddeld' | 'hoog'
  Icon: React.ElementType
  accentColor: string
}

const algorithms: AlgorithmInfo[] = [
  {
    id: 'ensemble-disagreement',
    name: 'Ensemble Meningsverschil',
    tagline: 'Koop wanneer modellen het sterker eens zijn dan de markt denkt',
    description:
      'Drie weersmodellen (ECMWF, GFS en ICON) draaien elk tientallen simulaties. Als 45 van de 51 ECMWF-runs zeggen "Amsterdam wordt warmer dan 18°C" maar de markt zegt slechts 55% kans — dan kopen we dat contract. De modellen zien meer dan de markt beprijst.',
    steps: [
      '~120 weersimulaties worden opgevraagd bij 3 modellen',
      'We tellen hoeveel simulaties de drempeltemperatuur overschrijden',
      'Als de kans meer dan 8% afwijkt van de marktprijs, plaatsen we een order',
    ],
    bestFor: '1–3 dagen voor afloop',
    risk: 'gemiddeld',
    Icon: Layers,
    accentColor: 'text-blue-400',
  },
  {
    id: 'bayesian-updating',
    name: 'Bayesiaans Bijwerken',
    tagline: 'Handel op nieuwe modelruns vóórdat de markt reageert',
    description:
      'Weersmodellen komen elke 6 uur met een nieuwe berekening. Als de nieuwste GFS-run de regenkans verhoogt van 40% naar 70% — maar de marktprijs staat nog op 42% — dan kopen we onmiddellijk. We worden betaald voor het sneller reageren dan de markt.',
    steps: [
      'We checken elke nieuwe modelrun zodra die beschikbaar komt',
      'We meten hoeveel de nieuwste run afwijkt van de vorige runs',
      'Als de marktprijs nog niet is meebewogen, handelen we direct',
    ],
    bestFor: 'Direct na nieuwe modelruns (elke 6 uur)',
    risk: 'hoog',
    Icon: RefreshCw,
    accentColor: 'text-purple-400',
  },
  {
    id: 'momentum',
    name: 'Momentum Strategie',
    tagline: 'Rij mee op aanhoudende prijsbewegingen',
    description:
      'Als de marktprijs van "Ja" al drie uur lang steeds hoger gaat — van 40% naar 55% naar 68% — dan beweegt er duidelijk informatie door de markt. We rijden mee op die golf zolang de trend aanhoudt en stappen uit zodra de beweging afvlakt.',
    steps: [
      'We monitoren hoe snel en consistent de marktprijs beweegt',
      'We bevestigen de trend met opeenvolgende modelruns',
      'We kopen in de richting van de trend, tot vlak voor afloop',
    ],
    bestFor: '12–72 uur voor afloop',
    risk: 'hoog',
    Icon: TrendingUp,
    accentColor: 'text-green-400',
  },
  {
    id: 'calibration-correction',
    name: 'Kalibratiecorrectie',
    tagline: 'Corrigeer de vaste fouten die modellen maken',
    description:
      'GFS voorspelt in de zomer voor Amsterdam stelselmatig 1,5°C te warm. Als we die afwijking kennen, berekenen we de werkelijke kans nauwkeuriger dan de markt. Hiervoor vergelijken we duizenden historische voorspellingen met echte meetwaarden per stad en seizoen.',
    steps: [
      'We vergelijken historische voorspellingen met werkelijke temperaturen',
      'We bouwen een correctietabel: stad × seizoen × modelfout',
      'De gecorrigeerde kans vergelijken we met de marktprijs',
    ],
    bestFor: 'Altijd, onafhankelijk van tijdstip',
    risk: 'laag',
    Icon: Target,
    accentColor: 'text-orange-400',
  },
  {
    id: 'kelly-criterion',
    name: 'Kelly Inzetformule',
    tagline: 'Zet precies het juiste bedrag in op elke trade',
    description:
      'De Kelly-formule berekent hoeveel procent van je bankroll je op één trade moet zetten. Grote voorsprong = groter inzet. Kleine voorsprong = klein inzet. We gebruiken 25% van de volledige Kelly om risico te beperken, met een hard maximum van 5% bankroll per trade.',
    steps: [
      'Kelly = (kans × winstcoëff − verliescoëff) ÷ winstcoëff',
      'We nemen 25% van de berekende Kelly-waarde (kwart-Kelly)',
      'Inzet is nooit meer dan 5% van de totale bankroll per trade',
    ],
    bestFor: 'Gebruikt bij elke andere strategie',
    risk: 'laag',
    Icon: Calculator,
    accentColor: 'text-yellow-400',
  },
]

const riskBadgeClass: Record<AlgorithmInfo['risk'], string> = {
  laag: 'border-green-500/30 bg-green-500/10 text-green-400',
  gemiddeld: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  hoog: 'border-red-500/30 bg-red-500/10 text-red-400',
}

export function AlgorithmExplainer() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#e8eaed]">Hoe handelen we?</h2>
        <p className="mt-1 text-sm text-[#8b8f9a]">
          Vijf methodes die ons systeem gebruikt om weermarkten te analyseren en te handelen
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {algorithms.map((algo) => {
          const { Icon } = algo
          return (
            <Card key={algo.id} className="border-[#2e3240] bg-[#1a1d27]">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('size-5 shrink-0', algo.accentColor)} />
                    <CardTitle className="text-base text-[#e8eaed]">{algo.name}</CardTitle>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded border px-2 py-0.5 text-xs font-medium',
                      riskBadgeClass[algo.risk]
                    )}
                  >
                    {algo.risk}
                  </span>
                </div>
                <p className="mt-1 text-xs italic text-[#8b8f9a]">{algo.tagline}</p>
              </CardHeader>

              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-[#c9cbd0]">{algo.description}</p>

                <ol className="flex flex-col gap-1.5 rounded-lg bg-[#0f1117] px-4 py-3">
                  {algo.steps.map((step, index) => (
                    <li key={index} className="flex gap-2 text-xs text-[#8b8f9a]">
                      <span className="shrink-0 font-mono font-semibold text-[#c9cbd0]">
                        {index + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <p className="text-xs text-[#8b8f9a]">
                  <span className="font-medium text-[#c9cbd0]">Best ingezet: </span>
                  {algo.bestFor}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
