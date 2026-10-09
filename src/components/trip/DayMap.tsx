"use client";

import { Map as MapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ScheduledItem } from "@/lib/schedule";
import { mapStops, resolveStops, stayFor, stayPoint, type MapStop } from "@/lib/stops-client";
import type { Day, Trip } from "@/lib/types";

// OpenStreetMap's public tiles are fine for light use; set NEXT_PUBLIC_MAP_TILE_URL to a commercial
// provider (MapTiler, Stadia, Mapbox…) before heavy traffic, per OSM's tile usage policy.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const pinHtml = (label: string, color: string) =>
  `<div style="display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:${color};color:#fff;font:600 12px/1 system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgb(0 0 0/.3)">${label}</div>`;

/** Numbered stops (and your stay, marked H) joined in visiting order. */
export function LeafletMap({ stops, home, height = 300, interactive = true, onReady }: { stops: MapStop[]; home?: { lat: number; lon: number; name: string }; height?: number; interactive?: boolean; onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !ref.current) return;
      map = L.map(ref.current, { zoomControl: interactive, dragging: interactive, scrollWheelZoom: false, attributionControl: true });
      const tiles = L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, crossOrigin: true }).addTo(map);
      const points: [number, number][] = [];
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      if (home) {
        L.marker([home.lat, home.lon], { icon: L.divIcon({ html: pinHtml("H", "#0e7c7b"), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }), keyboard: false }).bindTooltip(esc(home.name)).addTo(map);
        points.push([home.lat, home.lon]);
      }
      for (const s of stops) {
        L.marker([s.lat, s.lon], { icon: L.divIcon({ html: pinHtml(String(s.n), "#ff5a36"), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }), keyboard: false }).bindTooltip(esc(s.title)).addTo(map);
        points.push([s.lat, s.lon]);
      }
      const route = [...(home ? [[home.lat, home.lon] as [number, number]] : []), ...stops.map((s) => [s.lat, s.lon] as [number, number])];
      if (route.length > 1) L.polyline(route, { color: "#0b1220", weight: 2, opacity: 0.5, dashArray: "4 6" }).addTo(map);
      if (points.length === 1) map.setView(points[0], 15);
      else if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 16 });
      tiles.once("load", () => onReady?.());
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [stops, home, interactive, onReady]);

  return <div ref={ref} style={{ height }} className="z-0 w-full overflow-hidden rounded-2xl border border-line bg-sand" role="img" aria-label={`Map of ${stops.length} stops`} />;
}

/** "Show map" for a day in the itinerary; loads coordinates and Leaflet only when opened. */
export function DayMapToggle({ trip, day, items }: { trip: Trip; day: Day; items: ScheduledItem[] }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ stops: MapStop[]; home?: { lat: number; lon: number; name: string }; missing: number }>();
  const signature = items.filter((i) => i.activity).map((i) => i.activity!.id).join(",");

  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      const resolved = await resolveStops(day, items);
      const home = await stayPoint(stayFor(trip, day));
      if (!live) return;
      const stops = mapStops(resolved);
      setData({ stops, home, missing: resolved.length - stops.length });
    })();
    return () => {
      live = false;
    };
    // Re-resolve when the day's stops change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature, day.city]);

  if (!items.some((i) => i.activity && i.activity.category !== "transit")) return null;
  return (
    <div className="no-print mb-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-sand hover:text-ink">
        <MapIcon className="h-3.5 w-3.5" /> {open ? "Hide map" : "Show map"}
      </button>
      {open && (
        <div className="mt-2">
          {!data ? (
            <div className="h-[300px] animate-pulse rounded-2xl bg-sand" />
          ) : data.stops.length + (data.home ? 1 : 0) === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">We couldn&apos;t place these stops on a map yet.</p>
          ) : (
            <>
              <LeafletMap stops={data.stops} home={data.home} />
              {data.missing > 0 && <p className="mt-1.5 text-xs text-muted">{data.missing} stop{data.missing > 1 ? "s aren't" : " isn't"} on the map because we couldn&apos;t find exact locations.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
