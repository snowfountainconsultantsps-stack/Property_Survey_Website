import { useEffect, useState } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SatelliteTiles from './SatelliteTiles';

// Fit the map to all currently-visible features whenever they change.
function FitBounds({ layers }) {
  const map = useMap();
  const signature = layers.map((l) => `${l.id}:${l.geojson?.features?.length || 0}`).join('|');
  useEffect(() => {
    const features = layers.flatMap((l) => l.geojson?.features || []);
    if (!features.length) return;
    try {
      const b = L.geoJSON({ type: 'FeatureCollection', features }).getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 18 });
    } catch {
      /* ignore invalid geometry */
    }
    // Re-run when the set of visible features changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);
  return null;
}

// Survey progress palette, used when `colorBySurvey` is on. Kept in step with
// the surveyor app's map so both tell the same story.
const SURVEY_COLORS = {
  DONE: '#22c55e',
  IN_PROGRESS: '#f59e0b',
  PENDING: '#9ca3af',
  FLAGGED: '#ef4444',
};

const surveyColor = (p) => {
  if (p?.status === 'FLAGGED') return SURVEY_COLORS.FLAGGED;
  if (p?.survey_state === 'DONE') return SURVEY_COLORS.DONE;
  if (p?.survey_state === 'IN_PROGRESS') return SURVEY_COLORS.IN_PROGRESS;
  return SURVEY_COLORS.PENDING;
};

function styleFor(layer, colorBySurvey, selectedId) {
  const s = layer.style || {};
  return (feature) => {
    const p = feature?.properties || {};
    const base = colorBySurvey ? surveyColor(p) : s.color || '#334155';
    const isSelected = selectedId != null && String(p.id) === String(selectedId);
    return {
      color: isSelected ? '#2563eb' : base,
      weight: isSelected ? 6 : s.weight || 2,
      fillColor: colorBySurvey ? base : s.fillColor || s.color || '#334155',
      fillOpacity: s.fillOpacity ?? 0.3,
      dashArray: s.dashArray,
    };
  };
}

function pointToLayer(layer, colorBySurvey, selectedId) {
  const s = layer.style || {};
  return (feature, latlng) => {
    const p = feature?.properties || {};
    const base = colorBySurvey ? surveyColor(p) : s.color || '#334155';
    const isSelected = selectedId != null && String(p.id) === String(selectedId);
    return L.circleMarker(latlng, {
      radius: isSelected ? (s.radius || 5) + 4 : s.radius || 5,
      color: isSelected ? '#2563eb' : '#fff',
      fillColor: base,
      fillOpacity: s.fillOpacity ?? 0.9,
      weight: isSelected ? 3 : 1,
    });
  };
}

function onEachFeature(layer, { onEdit, onDelete, onSelect } = {}) {
  return (feature, lyr) => {
    const p = feature.properties || {};
    // Selecting drives a detail panel outside the map, so it takes precedence
    // over the informational popup.
    if (onSelect) {
      lyr.on('click', () => onSelect(feature));
    }
    const rows = Object.entries(p)
      .filter(([k]) => !['id', 'layer_id', 'project_id', 'ward_id', 'polygon_id', 'upload_id'].includes(k))
      .slice(0, 10)
      .map(([k, v]) => `<div><span style="color:#64748b">${k}:</span> ${v ?? '—'}</div>`)
      .join('');
    const editable = Boolean(onEdit || onDelete);
    const actions = editable
      ? `<div style="margin-top:8px;display:flex;gap:6px">
          ${onEdit ? `<button id="feat-edit-${p.id}" style="flex:1;padding:4px 8px;font-size:12px;font-weight:600;color:#fff;background:#2563eb;border:0;border-radius:4px;cursor:pointer">Edit</button>` : ''}
          ${onDelete ? `<button id="feat-delete-${p.id}" style="flex:1;padding:4px 8px;font-size:12px;font-weight:600;color:#fff;background:#dc2626;border:0;border-radius:4px;cursor:pointer">Delete</button>` : ''}
        </div>`
      : '';
    lyr.bindPopup(
      `<div style="min-width:160px"><b>${layer.name}</b>${
        p.feature_code ? ` — ${p.feature_code}` : ''
      }<div style="margin-top:4px;font-size:12px">${rows}</div>${actions}</div>`
    );

    if (editable) {
      lyr.on('popupopen', () => {
        if (onEdit) {
          document.getElementById(`feat-edit-${p.id}`)?.addEventListener('click', () => onEdit(feature));
        }
        if (onDelete) {
          document.getElementById(`feat-delete-${p.id}`)?.addEventListener('click', () => onDelete(feature));
        }
      });
    }
  };
}

/**
 * AssetLayerMap — renders a set of asset layers (each a GeoJSON FeatureCollection
 * with its own draw style) with per-layer visibility toggles.
 *
 * @param {Array} layers  [{ id, code, name, geometry_type, style, geojson, feature_count }]
 * @param {boolean} editable  When true, feature popups get Edit/Delete buttons.
 * @param {(feature: object) => void} onEditFeature  Called with the clicked GeoJSON Feature.
 * @param {(feature: object) => void} onDeleteFeature  Called with the clicked GeoJSON Feature.
 * @param {(feature: object) => void} onSelectFeature  Click handler for drilling
 *        into a feature; suppresses the popup so a detail panel can own the click.
 * @param {boolean} colorBySurvey  Colour features by survey progress instead of
 *        their layer style (green done, amber in progress, grey pending, red flagged).
 * @param {number|string} selectedFeatureId  Highlighted feature.
 */
export default function AssetLayerMap({
  layers = [],
  height = 520,
  emptyText = 'No features to display.',
  editable = false,
  onEditFeature,
  onDeleteFeature,
  onSelectFeature,
  colorBySurvey = false,
  selectedFeatureId = null,
}) {
  const [hidden, setHidden] = useState(() => new Set());

  const toggle = (id) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const withFeatures = layers.filter((l) => (l.geojson?.features?.length || 0) > 0);
  const visible = withFeatures.filter((l) => !hidden.has(l.id));
  const totalFeatures = withFeatures.reduce((s, l) => s + (l.geojson?.features?.length || 0), 0);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
      {/* Legend / toggles */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60">
        {withFeatures.length === 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</span>
        )}
        {withFeatures.map((l) => {
          const s = l.style || {};
          const swatch = s.fillColor || s.color || '#334155';
          const off = hidden.has(l.id);
          return (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              className={`flex items-center gap-2 text-sm transition ${off ? 'opacity-40' : ''}`}
              title={off ? 'Show layer' : 'Hide layer'}
            >
              {l.geometry_type === 'LINESTRING' ? (
                <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: swatch }} />
              ) : (
                <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: swatch, borderColor: s.color || swatch }} />
              )}
              <span className="text-gray-700 dark:text-gray-300">{l.name}</span>
              <span className="text-gray-400 dark:text-gray-500">({l.geojson.features.length})</span>
            </button>
          );
        })}
      </div>

      <div style={{ height }} className="relative">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <SatelliteTiles />
          <FitBounds layers={visible} />
          {visible.map((l) => (
            <GeoJSON
              // Re-key on the selection so Leaflet re-runs the style callback
              // and the highlight actually moves.
              key={`${l.id}:${l.geojson.features.length}:${colorBySurvey ? 'sv' : 'st'}:${selectedFeatureId ?? ''}`}
              data={l.geojson}
              style={styleFor(l, colorBySurvey, selectedFeatureId)}
              pointToLayer={pointToLayer(l, colorBySurvey, selectedFeatureId)}
              onEachFeature={onEachFeature(l, {
                ...(editable ? { onEdit: onEditFeature, onDelete: onDeleteFeature } : {}),
                ...(onSelectFeature ? { onSelect: onSelectFeature } : {}),
              })}
            />
          ))}
        </MapContainer>

        {totalFeatures === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-500 dark:text-gray-300 bg-white/80 dark:bg-gray-800/80 px-3 py-1 rounded">{emptyText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
