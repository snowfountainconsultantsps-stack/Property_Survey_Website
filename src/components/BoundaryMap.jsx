import { useEffect } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SatelliteTiles from './SatelliteTiles';

// Fit the map to the current FeatureCollection whenever it changes.
function FitBounds({ geojson }) {
  const map = useMap();
  const count = geojson?.features?.length || 0;
  useEffect(() => {
    if (!count) return;
    try {
      const b = L.geoJSON(geojson).getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 16 });
    } catch {
      /* ignore invalid geometry */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, map]);
  return null;
}

const STYLE = { color: '#7c3aed', weight: 2, fillColor: '#8b5cf6', fillOpacity: 0.15 };

function onEachBoundary(feature, lyr) {
  const p = feature.properties || {};
  lyr.bindPopup(
    `<div style="min-width:140px"><b>${p.name || 'Unnamed'}</b>${p.code ? ` <span style="color:#64748b">(${p.code})</span>` : ''}</div>`
  );
}

/**
 * BoundaryMap — renders a FeatureCollection of administrative boundaries
 * (State/District/City/Ward) with a single consistent style.
 *
 * @param {{type:string, features:Array}} geojson
 */
export default function BoundaryMap({ geojson, height = 460, emptyText = 'No boundaries to display.' }) {
  const count = geojson?.features?.length || 0;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
      <div style={{ height }} className="relative">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <SatelliteTiles />
          <FitBounds geojson={geojson} />
          {count > 0 && (
            <GeoJSON key={count} data={geojson} style={STYLE} onEachFeature={onEachBoundary} />
          )}
        </MapContainer>

        {count === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-500 dark:text-gray-300 bg-white/80 dark:bg-gray-800/80 px-3 py-1 rounded">{emptyText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
