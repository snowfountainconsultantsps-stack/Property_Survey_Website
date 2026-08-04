import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import SurveyDetailsEditor from './SurveyDetailsEditor';
import SatelliteTiles from './SatelliteTiles';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/';

const PolygonMap = ({ onRefetchReady }) => {
  const [polygons, setPolygons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // India center
  const mapRef = useRef(null);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [selectedPolygonCode, setSelectedPolygonCode] = useState(null);

  const fetchPolygons = useCallback(async () => {
    console.log('fetchPolygons called');
    try {
      setLoading(true);
      setMapCenter([20.5937, 78.9629]); // Reset to default
      
      const token = localStorage.getItem('token');
      console.log('Fetching polygons with token:', token);
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(
        `${API_BASE}gis/polygons`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('Fetch response:', response); 
     
      if (!response.ok) {
        throw new Error(`Failed to fetch polygons: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.polygons) {
        console.log(`Fetched ${data.polygons.length} polygons`);
        console.log('First polygon example:', data.polygons[0]);
        setPolygons(data.polygons);
        
        // Calculate center if polygons exist - Don't try to extract from boundary, just keep default
        // The map will auto-fit bounds when GeoJSON is loaded
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching polygons:', err);
      setError(err.message);
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolygons();
  }, [fetchPolygons]);

  // Pass fetchPolygons function to parent
  useEffect(() => {
    if (onRefetchReady) {
      console.log('Passing fetchPolygons function to parent');
      onRefetchReady(fetchPolygons);
    }
  }, [onRefetchReady, fetchPolygons]);

  const getPolygonColor = (surveyDone) => {
    try {
      return surveyDone ? '#3b82f6' : '#ef4444'; // Blue if surveyed, Red if not
    } catch {
      return '#cccccc';
    }
  };

  const getPolygonStyle = (feature) => {
    try {
      if (!feature || !feature.properties || feature.properties === null) {
        return { weight: 2, opacity: 0.9, color: '#999', fillOpacity: 0.5 };
      }

      const surveyDone = feature.properties.survey_done === true || feature.properties.survey_done === 'true';
      const color = getPolygonColor(surveyDone);

      return {
        fillColor: color,
        weight: 2,
        opacity: 0.9,
        color: '#333',
        dashArray: '3',
        fillOpacity: 0.7,
      };
    } catch (err) {
      console.warn('Error styling polygon:', err);
      return { weight: 2, opacity: 0.9, color: '#999', fillOpacity: 0.5 };
    }
  };

  const onEachFeature = (feature, layer) => {
    try {
      if (!feature || !feature.properties) {
        layer.bindPopup('<div>No data available</div>');
        return;
      }
      
      const props = feature.properties || {};
      const popupContent = `
        <div class="p-3 rounded max-w-sm">
          <h3 class="font-bold text-sm mb-2">${props.polygon_code || 'N/A'}</h3>
          <p class="text-xs mb-1"><strong>Ward:</strong> ${props.ward_id || 'N/A'}</p>
          <p class="text-xs mb-1"><strong>Area:</strong> ${props.area_sqmt ? props.area_sqmt.toFixed(2) : 'N/A'} sqmt</p>
          <p class="text-xs mb-1"><strong>Status:</strong> ${props.gis_status || 'N/A'}</p>
          <p class="text-xs mb-1"><strong>Surveys:</strong> ${props.survey_count || '0'}</p>
          <p class="text-xs mb-3"><strong>Survey Done:</strong> 
            <span class="font-semibold ${props.survey_done ? 'text-blue-600' : 'text-red-600'}">
              ${props.survey_done ? 'Yes' : 'No'}
            </span>
          </p>
          <button id="view-survey-btn-${props.polygon_code}" class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition">
            View Survey Details
          </button>
        </div>
      `;
      layer.bindPopup(popupContent);
      
      // Add click listener to button after popup is created
      layer.on('popupopen', () => {
        const btn = document.getElementById(`view-survey-btn-${props.polygon_code}`);
        if (btn) {
          btn.addEventListener('click', () => {
            handleViewSurveyDetails(props.id, props.polygon_code, props.survey_count);
          });
        }
      });
    } catch (err) {
      console.warn('Error binding popup:', err);
      layer.bindPopup('<div>Error loading popup</div>');
    }
  };

  const handleViewSurveyDetails = (polygonId, polygonCode, surveyCount) => {
    console.log('🔘 View Details Clicked:', { polygonId, polygonCode, surveyCount });
    if (!surveyCount || surveyCount === '0') {
      toast.error('No surveys found for this polygon');
      return;
    }
    // Store the selected polygon info and trigger survey details view
    console.log('✅ Setting selected survey with polygonId:', polygonId);
    setSelectedPolygonCode(polygonCode);
    setSelectedSurvey({ polygonId, polygonCode });
    
    // Scroll to survey details section
    setTimeout(() => {
      document.getElementById('survey-details-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Wrapper component for safe GeoJSON rendering
  const SafeGeoJSON = ({ data, style, onEachFeature, polygonCode }) => {
    try {
      console.log(`Rendering SafeGeoJSON for ${polygonCode}`, data);
      
      if (!data || !data.geometry) {
        console.warn(`No geometry for polygon ${polygonCode}`);
        return null;
      }

      return (
        <GeoJSON
          key={`geojson-${polygonCode}`}
          data={data}
          style={style}
          onEachFeature={onEachFeature}
        />
      );
    } catch (err) {
      console.error(`SafeGeoJSON error for ${polygonCode}:`, err);
      return null;
    }
  };

  const convertPolygonToGeoJSON = (polygon) => {
    try {
      if (!polygon || !polygon.boundary) {
        return null;
      }

      let boundary;
      if (typeof polygon.boundary === 'string') {
        boundary = JSON.parse(polygon.boundary);
      } else {
        boundary = polygon.boundary;
      }

      // Simple validation - just check if we have coordinates
      if (!boundary || !boundary.coordinates || !Array.isArray(boundary.coordinates)) {
        console.warn(`No coordinates for ${polygon.polygon_code}`);
        return null;
      }

      const geoJsonFeature = {
        type: 'Feature',
        geometry: boundary,
        properties: {
          id: polygon.id || null,
          polygon_code: polygon.polygon_code || 'Unknown',
          ward_id: polygon.ward_id || null,
          area_sqmt: polygon.area_sqmt || 0,
          gis_status: polygon.gis_status || 'Unknown',
          is_active: polygon.is_active || false,
          survey_done: Boolean(polygon.survey_done),
          survey_count: polygon.survey_count || '0',
          last_survey_date: polygon.last_survey_date || null,
        },
      };

      return geoJsonFeature;
    } catch (err) {
      console.error(`Error converting polygon ${polygon?.polygon_code}:`, err);
      return null;
    }
  };

  const isValidMapCenter = (center) => {
    if (!Array.isArray(center) || center.length !== 2) return false;
    const [lat, lng] = center;
    return typeof lat === 'number' && typeof lng === 'number' && 
           isFinite(lat) && isFinite(lng) &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180;
  };

  const getValidMapCenter = () => {
    if (isValidMapCenter(mapCenter)) {
      return mapCenter;
    }
    console.warn('Invalid mapCenter detected, using default:', mapCenter);
    return [20.5937, 78.9629]; // India center
  };

  // Calculate bounds from polygon data
  const calculateBoundsFromPolygons = (polygonsList) => {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    polygonsList.forEach((polygon) => {
      try {
        const boundary = typeof polygon.boundary === 'string' 
          ? JSON.parse(polygon.boundary) 
          : polygon.boundary;

        if (boundary?.coordinates && Array.isArray(boundary.coordinates)) {
          // For MultiPolygon, iterate through all polygons
          boundary.coordinates.forEach((polygonCoords) => {
            if (Array.isArray(polygonCoords)) {
              // Each polygon is an array of rings
              polygonCoords.forEach((ring) => {
                if (Array.isArray(ring)) {
                  // Each ring is an array of [lon, lat]
                  ring.forEach((coord) => {
                    if (Array.isArray(coord) && coord.length >= 2) {
                      const [lon, lat] = coord;
                      minLat = Math.min(minLat, lat);
                      maxLat = Math.max(maxLat, lat);
                      minLon = Math.min(minLon, lon);
                      maxLon = Math.max(maxLon, lon);
                    }
                  });
                }
              });
            }
          });
        }
      } catch (err) {
        console.warn('Error parsing polygon boundary:', err);
      }
    });

    if (minLat !== Infinity && maxLat !== -Infinity && minLon !== Infinity && maxLon !== -Infinity) {
      return [[minLat, minLon], [maxLat, maxLon]];
    }
    return null;
  };

  // Component to fit bounds to all GeoJSON layers
  const FitBoundsController = ({ polygonsCount, mapInstance }) => {
    useEffect(() => {
      if (polygonsCount === 0 || !mapInstance) return;

      // Delay to ensure all GeoJSON components are rendered
      const timer = setTimeout(() => {
        try {
          // Calculate bounds from our polygon data
          const bounds = calculateBoundsFromPolygons(polygons);
          
          if (bounds) {
            console.log('Calculated bounds from polygons:', bounds);
            
            // Use the map instance ref to fit bounds
            if (mapInstance.current) {
              mapInstance.current.fitBounds(bounds, { padding: [50, 50], animate: true });
              console.log('Map fitted to polygon bounds');
            }
          }
        } catch (err) {
          console.warn('Error fitting bounds:', err);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }, [polygonsCount, mapInstance]);

    return null;
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <h2 className="text-2xl font-bold">Polygon Survey Map</h2>
        <p className="text-blue-100 mt-1">
          {loading ? 'Loading polygons...' : `${polygons.length} polygons loaded`}
        </p>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-900/60 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded border border-gray-300 dark:border-gray-600"></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Survey Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded border border-gray-300 dark:border-gray-600"></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Survey Pending</span>
        </div>
      </div>

      {/* Map Container - Fixed Height */}
      <div className="h-96 relative">
        {loading && (
          <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">Loading map...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 bg-red-50 dark:bg-red-950/40 flex items-center justify-center z-50">
            <div className="text-center bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error loading map</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={fetchPolygons}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && polygons.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 font-medium">No polygons found</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try adding some polygons first</p>
            </div>
          </div>
        )}

        {!loading && !error && polygons.length > 0 && (
          <MapContainer
            ref={mapRef}
            center={getValidMapCenter()}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            key="map-container"
          >
            <SatelliteTiles />

            <FitBoundsController polygonsCount={polygons.length} mapInstance={mapRef} />
            
            {polygons && polygons.length > 0 && (() => {
              console.log(`Starting to render ${polygons.length} polygons`);
              let successCount = 0;
              let skipCount = 0;
              
              const elements = [];
              
              for (let i = 0; i < polygons.length; i++) {
                const polygon = polygons[i];
                
                try {
                  if (!polygon || !polygon.id || !polygon.polygon_code || !polygon.boundary) {
                    console.warn(`Polygon ${i} missing required fields`);
                    skipCount++;
                    continue;
                  }

                  const geoJSON = convertPolygonToGeoJSON(polygon);
                  
                  if (!geoJSON) {
                    console.warn(`Failed to convert polygon ${polygon.polygon_code} to GeoJSON`);
                    skipCount++;
                    continue;
                  }

                  console.log(`Successfully created GeoJSON for ${polygon.polygon_code}`);
                  
                  elements.push(
                    <SafeGeoJSON
                      key={polygon.id}
                      data={geoJSON}
                      style={getPolygonStyle}
                      onEachFeature={onEachFeature}
                      polygonCode={polygon.polygon_code}
                    />
                  );
                  
                  successCount++;
                } catch (err) {
                  console.error(`Error processing polygon at index ${i}:`, err);
                  skipCount++;
                }
              }
              
              console.log(`✓ Rendered: ${successCount}, ✗ Skipped: ${skipCount}`);
              return elements;
            })()}
          </MapContainer>
        )}
      </div>

      {/* Survey Details Section - Below Map */}
      {selectedSurvey && (
        <div
          id="survey-details-section"
          className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <SurveyDetailsEditor
            polygonId={selectedSurvey.polygonId}
            polygonCode={selectedPolygonCode}
            onClose={() => {
              setSelectedSurvey(null);
              setSelectedPolygonCode(null);
            }}
          />
        </div>
      )}

      {/* Stats Footer */}
      {!loading && !error && polygons.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900/60 px-4 py-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {polygons.filter(p => p.survey_done).length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Surveyed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {polygons.filter(p => !p.survey_done).length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {polygons.length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {polygons.length > 0 ? Math.round((polygons.filter(p => p.survey_done).length / polygons.length) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Completion</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolygonMap;
