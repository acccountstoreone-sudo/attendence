'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, ExternalLink } from 'lucide-react';

interface LocationMapViewerProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  branchName?: string;
}

export const LocationMapViewer: React.FC<LocationMapViewerProps> = ({
  latitude,
  longitude,
  radiusMeters,
  branchName = 'Store Branch',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const createCustomIcon = useCallback(() => {
    return L.divIcon({
      className: 'custom-map-marker-view',
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          margin-left: -19px;
          margin-top: -38px;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1dbf73" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="#ffffff"/>
          </svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    });
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 16,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Marker
    L.marker([latitude, longitude], {
      icon: createCustomIcon(),
    }).addTo(map).bindPopup(`<b style="color: #ffffff;">${branchName}</b>`);

    // Circle
    L.circle([latitude, longitude], {
      radius: radiusMeters,
      color: '#1dbf73',
      weight: 2,
      fillColor: '#1dbf73',
      fillOpacity: 0.18,
      dashArray: '4, 4',
    }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, radiusMeters]);

  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, '_blank');
  };

  return (
    <div className="space-y-3">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      
      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner">
        <div
          ref={mapContainerRef}
          className="w-full h-52 sm:h-64 bg-white z-10"
        />
        <button
          onClick={openInGoogleMaps}
          title="Open in Google Maps"
          className="absolute top-2.5 right-2.5 z-20 bg-white hover:bg-[#1dbf73] text-slate-600 hover:text-[#ffffff] backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#1dbf73] shadow-lg text-xs font-bold transition-all flex items-center gap-1.5"
        >
          <span>Open Google Maps</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 bg-white px-3 py-2 rounded-lg border border-slate-200">
        <span className="flex items-center gap-1.5 font-mono text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-[#1dbf73]" />
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </span>
        <span className="text-[#1dbf73] font-semibold">
          Radius: {radiusMeters}m zone
        </span>
      </div>
    </div>
  );
};

