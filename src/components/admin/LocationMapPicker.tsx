'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Navigation, Globe, CheckCircle2, AlertCircle, RefreshCw, Crosshair, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onLocationChange: (lat: number, lng: number) => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  latitude,
  longitude,
  radiusMeters,
  onLocationChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 750);

  // Default coordinate (Dhaka, Bangladesh) if not provided
  const initialLat = latitude && !isNaN(latitude) ? latitude : 23.8103;
  const initialLng = longitude && !isNaN(longitude) ? longitude : 90.4125;
  const safeRadius = radiusMeters && !isNaN(radiusMeters) && radiusMeters > 0 ? radiusMeters : 100;

  // Custom high-contrast marker icon
  const createCustomIcon = useCallback(() => {
    return L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          margin-left: -21px;
          margin-top: -42px;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));
          cursor: pointer;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1dbf73" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="#ffffff"/>
          </svg>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 42],
    });
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: latitude ? 17 : 13,
      zoomControl: true,
      attributionControl: false,
    });

    // High detail OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Create marker
    const marker = L.marker([initialLat, initialLng], {
      icon: createCustomIcon(),
      draggable: true,
    }).addTo(map);

    markerRef.current = marker;

    // Create geofence radius circle around marker
    const circle = L.circle([initialLat, initialLng], {
      radius: safeRadius,
      color: '#1dbf73',
      weight: 2,
      fillColor: '#1dbf73',
      fillOpacity: 0.18,
      dashArray: '5, 5',
    }).addTo(map);

    circleRef.current = circle;

    // Handle marker drag end
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const newLat = Number(pos.lat.toFixed(6));
      const newLng = Number(pos.lng.toFixed(6));
      if (circleRef.current) {
        circleRef.current.setLatLng([newLat, newLng]);
      }
      onLocationChange(newLat, newLng);
      setLocationStatus(`Pin moved to: ${newLat}, ${newLng}`);
    });

    // Handle map click to place pin directly
    map.on('click', (e: L.LeafletMouseEvent) => {
      const newLat = Number(e.latlng.lat.toFixed(6));
      const newLng = Number(e.latlng.lng.toFixed(6));
      marker.setLatLng([newLat, newLng]);
      if (circleRef.current) {
        circleRef.current.setLatLng([newLat, newLng]);
      }
      onLocationChange(newLat, newLng);
      setLocationStatus(`Pin placed at: ${newLat}, ${newLng}`);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external coordinates and radius changes to map
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;

    if (latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude)) {
      const currentPos = markerRef.current.getLatLng();
      // Only update if coordinates changed significantly from current marker
      if (Math.abs(currentPos.lat - latitude) > 0.000001 || Math.abs(currentPos.lng - longitude) > 0.000001) {
        markerRef.current.setLatLng([latitude, longitude]);
        circleRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current.panTo([latitude, longitude]);
      }
    }

    if (safeRadius !== circleRef.current.getRadius()) {
      circleRef.current.setRadius(safeRadius);
    }
  }, [latitude, longitude, safeRadius]);

  // Auto-search Address using OpenStreetMap Nominatim when debounced query changes
  useEffect(() => {
    const searchAddress = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      setErrorMessage(null);
      setSearchResults([]);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            debouncedSearchQuery
          )}&addressdetails=1&limit=5`,
          {
            headers: {
              'Accept-Language': 'en-US,en;q=0.9',
              'User-Agent': 'AttendanceApp/1.0',
            },
          }
        );
        if (!res.ok) throw new Error('Search request failed');
        const data: SearchResult[] = await res.json();

        if (data && data.length > 0) {
          setSearchResults(data);
          // Automatically select the first result if only 1 or exact match
          if (data.length === 1) {
            selectSearchResult(data[0]);
          }
        } else {
          setErrorMessage(`No locations found for "${debouncedSearchQuery}". Try adding city or country name.`);
        }
      } catch (err) {
        console.error('Geocoding error:', err);
        setErrorMessage('Search service unavailable right now. Please drag the pin on map directly.');
      } finally {
        setIsSearching(false);
      }
    };

    searchAddress();
  }, [debouncedSearchQuery]);

  function selectSearchResult(result: SearchResult) {
    const lat = Number(parseFloat(result.lat).toFixed(6));
    const lng = Number(parseFloat(result.lon).toFixed(6));

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
    }

    onLocationChange(lat, lng);
    setSearchResults([]);
    setSearchQuery(result.display_name);
    setLocationStatus(`Selected: ${result.display_name.split(',')[0]}`);
  };

  // Get Current Device GPS Location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          circleRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.flyTo([lat, lng], 18, { duration: 1.5 });
        }

        onLocationChange(lat, lng);
        setIsLocating(false);
        setLocationStatus(`GPS Locked: ${lat}, ${lng} (Accuracy: ±${Math.round(pos.coords.accuracy)}m)`);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage('GPS permission denied. Please allow location access in your browser settings.');
        } else {
          setErrorMessage('Could not retrieve exact GPS position. Try clicking the map.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-4 bg-[#0A1220] border border-slate-200 rounded-2xl p-5 shadow-2xl">
      {/* Fallback stylesheet import for SSR/client rendering safety */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      {/* Header & Instructions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-[#1dbf73] text-xs font-bold uppercase tracking-widest mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Geofence Map Picker</span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            Select Store Location directly on Map
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            No need to copy coordinates from Google Maps! Search area, use your GPS, or <span className="text-[#1dbf73] font-semibold">click & drag the pin</span> to set location.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="bg-[#1dbf73] hover:bg-[#b88b22] text-[#ffffff] font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(210,160,42,0.3)] shrink-0 transition-all"
        >
          {isLocating ? <Navigation className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {isLocating ? 'Detecting GPS...' : 'Use My Current Location'}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              placeholder="Search store address, area, road, or city (e.g., Mirpur 10, Gulshan 2, Uttara, Chittagong)..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="absolute right-3.5 top-3.5 text-xs text-slate-400 hover:text-slate-900"
              >
                Clear
              </button>
            )}
          </div>
          <Button
            type="button"
            disabled={isSearching || !searchQuery.trim()}
            className="bg-slate-100 hover:bg-[#1dbf73] text-slate-900 px-6 font-medium rounded-xl"
          >
            {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-200">
            <div className="px-3 py-2 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
              <span>Matching Locations ({searchResults.length})</span>
              <button
                type="button"
                onClick={() => setSearchResults([])}
                className="text-slate-400 hover:text-slate-900 text-xs"
              >
                Close
              </button>
            </div>
            {searchResults.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => selectSearchResult(item)}
                className="w-full px-4 py-3 text-left hover:bg-slate-100 transition-colors flex items-start gap-3"
              >
                <MapPin className="w-4 h-4 text-[#1dbf73] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-900 line-clamp-1">
                    {item.display_name.split(',')[0]}
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                    {item.display_name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner group">
        <div
          ref={mapContainerRef}
          className="w-full h-[380px] sm:h-[430px] bg-white z-10 cursor-crosshair"
        />

        {/* Floating instruction overlay on map */}
        <div className="absolute top-3 right-3 z-20 bg-white backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 shadow-lg pointer-events-none text-xs text-slate-300 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-[#1dbf73]" />
          <span>Click anywhere or drag pin to adjust</span>
        </div>
      </div>

      {/* Status & Coordinate Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 bg-white px-4 py-3 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#1dbf73]/10 rounded-lg text-[#1dbf73]">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Active Geofence Pin Position
            </div>
            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-3 mt-0.5">
              <span>Lat: <span className="text-[#1dbf73] font-mono">{latitude !== null && !isNaN(latitude) ? latitude.toFixed(6) : 'Not set'}</span></span>
              <span>Lng: <span className="text-[#1dbf73] font-mono">{longitude !== null && !isNaN(longitude) ? longitude.toFixed(6) : 'Not set'}</span></span>
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-300 rounded-md font-sans">
                Radius: {safeRadius}m
              </span>
            </div>
          </div>
        </div>

        {locationStatus && (
          <div className="flex items-center gap-1.5 text-xs text-[#1dbf73] bg-[#1dbf73]/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">{locationStatus}</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

