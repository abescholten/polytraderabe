// Overview page: sections={['temperature', 'probability-intro']}
// Detail page:   sections={['models', 'chart', 'probability-colors']}

const SECTIONS = {
  temperature: {
    title: 'Temperatuur',
    items: [
      {
        label: 'Gemiddelde (mean)',
        desc: 'Het gemiddelde van alle ensemble-leden voor die dag. Dit is de centrale verwachting.',
      },
      {
        label: 'Min – Max',
        desc: 'De laagste en hoogste waarde over alle ensemble-leden. Brede spreiding = meer onzekerheid.',
      },
      {
        label: 'Kleurcodering',
        desc: 'Geeft in één oogopslag de temperatuurklasse aan.',
        swatches: [
          { color: '#3b82f6', label: '< 10 °C — koud' },
          { color: '#22c55e', label: '10 – 24 °C — normaal' },
          { color: '#f59e0b', label: '25 – 32 °C — warm' },
          { color: '#ef4444', label: '> 32 °C — heet' },
        ],
      },
    ],
  },

  'probability-intro': {
    title: 'Kansberekening',
    items: [
      {
        label: 'P(> X °C)',
        desc: 'Het percentage ensemble-leden dat een temperatuur boven de drempelwaarde voorspelt. Voorbeeld: P(> 20 °C) = 72 % betekent dat 72 % van de modelleden aangeeft dat het warmer dan 20 °C wordt.',
      },
    ],
  },

  models: {
    title: 'Weermodellen',
    items: [
      {
        label: 'ECMWF',
        desc: '51 ensemble-leden. Het Europese model van het ECMWF (Reading). Hoogste resolutie en meest betrouwbaar op middellange termijn (4 – 10 dagen).',
      },
      {
        label: 'GFS',
        desc: '31 ensemble-leden. Het Amerikaanse model van NOAA/NCEP. Sterke werelddekking, goed op kortere termijn.',
      },
      {
        label: 'ICON',
        desc: '40 ensemble-leden. Het Duitse model van DWD. Bijzonder nauwkeurig voor Europa op 1 – 5 dagen.',
      },
    ],
  },

  chart: {
    title: 'Grafiek uitleg',
    items: [
      {
        label: 'Blauwe lijn (ECMWF Mean)',
        desc: 'Gemiddelde temperatuurverwachting van alle 51 ECMWF-leden.',
      },
      {
        label: 'Lichtblauw vlak (ECMWF Range)',
        desc: 'Bandbreedte tussen minimum en maximum van de ECMWF-leden. Smaller vlak = meer modeleovereenstemming.',
      },
      {
        label: 'Oranje stippellijn (GFS Mean)',
        desc: 'Gemiddelde temperatuurverwachting van alle 31 GFS-leden.',
      },
    ],
  },

  'probability-colors': {
    title: 'Kanskleur in de tabel',
    items: [
      {
        label: 'Kleurcodering',
        desc: 'Geeft aan hoe zeker de modellen zijn dat een drempelwaarde gehaald wordt.',
        swatches: [
          { color: '#22c55e', label: '> 70 % — grote kans' },
          { color: '#f59e0b', label: '30 – 70 % — onzeker' },
          { color: '#ef4444', label: '< 30 % — kleine kans' },
        ],
      },
      {
        label: 'Drempelwaarden',
        desc: 'P(> 15 °C), P(> 20 °C), P(> 25 °C) en P(> 30 °C) zijn relevant voor Polymarket-markten die vragen of het een bepaalde dag warmer dan X °C wordt.',
      },
    ],
  },
} as const

type SectionKey = keyof typeof SECTIONS

interface SwatchItem {
  color: string
  label: string
}

interface LegendItemDef {
  label: string
  desc: string
  swatches?: readonly SwatchItem[]
}

function LegendItem({ item }: { item: LegendItemDef }) {
  return (
    <div>
      <span className="font-mono text-xs font-medium text-[#e8eaed]">{item.label}</span>
      <p className="mt-0.5 text-xs leading-relaxed text-[#8b8f9a]">{item.desc}</p>
      {item.swatches && (
        <div className="mt-2 flex flex-wrap gap-3">
          {item.swatches.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-[#8b8f9a]">{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface WeatherLegendProps {
  sections: SectionKey[]
}

export function WeatherLegend({ sections }: WeatherLegendProps) {
  const activeSections = sections.map((key) => ({ key, ...SECTIONS[key] }))

  return (
    <div className="rounded-xl border border-[#2e3240] bg-[#1a1d27] p-4">
      <h3 className="mb-4 text-sm font-medium text-[#8b8f9a]">Legenda</h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {activeSections.map((section) => (
          <div key={section.key} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
              {section.title}
            </p>
            {section.items.map((item) => (
              <LegendItem key={item.label} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
