"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { INDIA_CENTER, type LatLng } from "@/lib/geo";

// A CSS pin in the brand colors: no marker image files to resolve under the GitHub Pages base path.
const pinIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--role);border:3px solid var(--surface);box-shadow:var(--shadow-2)"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function Recenter({ point, zoom }: { point: LatLng | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lng], Math.max(map.getZoom(), zoom), { animate: true });
  }, [point, zoom, map]);
  return null;
}

function ClickToSet({ onPick }: { onPick?: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LeafletMap({
  point,
  onPick,
  height = 260,
  label,
}: {
  point: LatLng | null;
  onPick?: (p: LatLng) => void;
  height?: number;
  label: string;
}) {
  const center = point ?? INDIA_CENTER;
  const handlers = useMemo(
    () => ({
      dragend(e: L.LeafletEvent) {
        const m = e.target as L.Marker;
        const ll = m.getLatLng();
        onPick?.({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onPick],
  );
  return (
    <div role="region" aria-label={label} className="overflow-hidden rounded-md border border-border" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={point ? 15 : 4} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {point ? <Marker position={[point.lat, point.lng]} icon={pinIcon} draggable={Boolean(onPick)} eventHandlers={handlers} /> : null}
        <Recenter point={point} zoom={15} />
        {onPick ? <ClickToSet onPick={onPick} /> : null}
      </MapContainer>
    </div>
  );
}
