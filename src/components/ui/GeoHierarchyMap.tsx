'use client';

import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Globe2, ArrowUpRight, MapPin } from 'lucide-react';
import countries110m from 'world-atlas/countries-110m.json';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';

// Approximate centroid coordinates [longitude, latitude] for the countries present
// in ai_usage_data.csv. Any country not listed here still appears in the fallback
// list below the map so it stays clickable.
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Australia: [133.7751, -25.2744],
  Germany: [10.4515, 51.1657],
  'United Kingdom': [-3.436, 55.3781],
  'United Arab Emirates': [53.8478, 23.4241],
  Canada: [-106.3468, 56.1304],
  'United States': [-95.7129, 37.0902],
  Singapore: [103.8198, 1.3521],
  India: [78.9629, 20.5937],
};

export interface GeoGroup {
  value: string;
  rowCount: number;
  userCount: number;
  tokens: number;
  cost: number;
}

interface GeoHierarchyMapProps {
  groups: GeoGroup[];
  onSelect: (country: string) => void;
}

export function GeoHierarchyMap({ groups, onSelect }: GeoHierarchyMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxCost = useMemo(() => Math.max(1, ...groups.map((g) => g.cost)), [groups]);

  const plotted = groups.filter((g) => COUNTRY_COORDS[g.value]);
  const unplotted = groups.filter((g) => !COUNTRY_COORDS[g.value]);

  const radiusFor = (cost: number) => {
    const ratio = Math.sqrt(cost / maxCost);
    return 7 + ratio * 21;
  };

  const activeGroup = groups.find((g) => g.value === hovered) || null;

  return (
    <div className="space-y-4">
      <div className="relative bg-ey-black/60 border border-ey-border rounded-xl overflow-hidden">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 148 }}
          width={800}
          height={400}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <Geographies geography={countries110m as unknown as string}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="var(--ey-card)"
                  stroke="var(--ey-border)"
                  strokeWidth={0.6}
                  className="geo-country-path"
                  style={{ outline: 'none' }}
                />
              ))
            }
          </Geographies>

          {plotted.map((g) => {
            const [lon, lat] = COUNTRY_COORDS[g.value];
            const r = radiusFor(g.cost);
            const isHovered = hovered === g.value;
            return (
              <Marker
                key={g.value}
                coordinates={[lon, lat]}
                onMouseEnter={() => setHovered(g.value)}
                onMouseLeave={() => setHovered((h) => (h === g.value ? null : h))}
                onClick={() => onSelect(g.value)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  r={r + 6}
                  fill="var(--ey-yellow)"
                  className="geo-marker-ping"
                  style={{ pointerEvents: 'none' }}
                />
                <circle
                  r={r}
                  fill="var(--ey-yellow)"
                  fillOpacity={isHovered ? 0.95 : 0.75}
                  stroke="var(--ey-black)"
                  strokeWidth={1.5}
                  className="geo-marker-dot"
                  style={{ filter: isHovered ? 'brightness(1.15)' : 'none' }}
                />
                <text
                  textAnchor="middle"
                  y={4}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 9,
                    fontWeight: 700,
                    fill: 'var(--ey-black)',
                    pointerEvents: 'none',
                  }}
                >
                  {g.userCount}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>

        {/* Hover detail card */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 pointer-events-none">
          <div className="bg-ey-card/95 backdrop-blur border border-ey-border rounded-lg px-3 py-2 text-xs shadow-lg min-w-[220px]">
            {activeGroup ? (
              <>
                <p className="font-bold text-ey-light flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-ey-yellow" />
                  {activeGroup.value}
                </p>
                <p className="text-ey-muted mt-0.5">
                  {activeGroup.userCount} users &middot; {formatCompactNumber(activeGroup.tokens)} tokens
                </p>
                <p className="text-ey-yellow font-bold font-mono">{fmtCost(activeGroup.cost)}</p>
              </>
            ) : (
              <p className="text-ey-muted flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-ey-yellow" />
                Hover or click a marker to drill into that country
              </p>
            )}
          </div>
          <div className="bg-ey-card/95 backdrop-blur border border-ey-border rounded-lg px-2.5 py-1.5 text-[10px] text-ey-muted shadow-lg">
            Bubble size &amp; label = active users
          </div>
        </div>
      </div>

      {unplotted.length > 0 && (
        <div className="bg-ey-card border border-ey-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-ey-muted uppercase mb-2">
            Not shown on map ({unplotted.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unplotted.map((g) => (
              <button
                key={g.value}
                onClick={() => onSelect(g.value)}
                className="flex items-center gap-1.5 text-xs font-semibold text-ey-light bg-ey-black/60 border border-ey-border hover:border-ey-yellow/60 hover:text-ey-yellow px-2.5 py-1.5 rounded-lg transition group"
              >
                {g.value}
                <span className="text-ey-muted font-mono text-[10px]">{fmtCost(g.cost)}</span>
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
