import { TileLayer } from 'react-leaflet';

// Shared basemap for every map in the app.
//
// Satellite imagery rather than a street map: this tool is about real assets
// and parcels on the ground, so surveyors and admins need to see actual
// rooftops, pipe routes and plot edges. A labels overlay sits on top so roads
// and place names stay readable over the imagery.
//
// maxNativeZoom stops Leaflet requesting tiles past the imagery's real
// resolution — beyond that it upscales the last available tile instead of
// showing blank tiles.
export default function SatelliteTiles() {
  return (
    <>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="&copy; Esri, Maxar, Earthstar Geographics"
        maxZoom={21}
        maxNativeZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={21}
        maxNativeZoom={19}
      />
    </>
  );
}
