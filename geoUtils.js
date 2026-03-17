/**
 * geoUtils.js
 * Utilidades geométricas para cálculos de rutas y geofencing
 */

const GeoUtils = (() => {
  const EARTH_RADIUS_M = 6371000;

  /**
   * Convierte grados a radianes
   */
  function toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Distancia Haversine entre dos puntos GPS (metros)
   */
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_M * c;
  }

  /**
   * Distancia de un punto a un segmento de línea (metros)
   * Usa proyección perpendicular para el cálculo más preciso
   */
  function pointToSegmentDistance(pLat, pLon, aLat, aLon, bLat, bLon) {
    const ax = aLon, ay = aLat;
    const bx = bLon, by = bLat;
    const px = pLon, py = pLat;

    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const ab2 = abx * abx + aby * aby;

    if (ab2 === 0) return haversineDistance(pLat, pLon, aLat, aLon);

    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));

    const closestLat = ay + t * aby;
    const closestLon = ax + t * abx;

    return haversineDistance(pLat, pLon, closestLat, closestLon);
  }

  /**
   * Distancia mínima de un punto a una polyline completa
   * @param {number} pLat - Latitud del punto
   * @param {number} pLon - Longitud del punto
   * @param {Array}  polyline - Array de {lat, lon}
   * @returns {number} Distancia en metros
   */
  function pointToPolylineDistance(pLat, pLon, polyline) {
    if (!polyline || polyline.length < 2) return Infinity;
    let minDist = Infinity;
    for (let i = 0; i < polyline.length - 1; i++) {
      const d = pointToSegmentDistance(
        pLat, pLon,
        polyline[i].lat, polyline[i].lon,
        polyline[i + 1].lat, polyline[i + 1].lon
      );
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  /**
   * Verifica si un punto está dentro del radio de una zona (geofence)
   * @param {number} pLat
   * @param {number} pLon
   * @param {number} centerLat
   * @param {number} centerLon
   * @param {number} radiusMeters
   * @returns {boolean}
   */
  function isInsideGeofence(pLat, pLon, centerLat, centerLon, radiusMeters) {
    return haversineDistance(pLat, pLon, centerLat, centerLon) <= radiusMeters;
  }

  /**
   * Calcula el porcentaje de completación de una ruta
   * basado en las paradas completadas
   */
  function routeCompletionPercent(stops) {
    if (!stops || stops.length === 0) return 0;
    const completed = stops.filter(s => s.status === 'completed').length;
    return Math.round((completed / stops.length) * 100);
  }

  /**
   * Formatea metros a string legible (m o km)
   */
  function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  /**
   * Formatea segundos a string legible
   */
  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  }

  /**
   * Calcula ETA sumando duración estimada al tiempo actual
   */
  function calculateETA(estimatedSeconds) {
    const eta = new Date(Date.now() + estimatedSeconds * 1000);
    return eta.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  return {
    haversineDistance,
    pointToSegmentDistance,
    pointToPolylineDistance,
    isInsideGeofence,
    routeCompletionPercent,
    formatDistance,
    formatDuration,
    calculateETA
  };
})();
