/**
 * deviationDetector.js
 * Módulo 3: Detección en tiempo real de desvíos de ruta
 */

const DeviationDetector = (() => {
  const DEVIATION_MIN_SECONDS = 30; // segundos fuera de ruta antes de alertar

  let _activeRoute = null;
  let _deviationStartTime = null;
  let _isDeviating = false;
  let _onDeviationStart = null;
  let _onDeviationEnd = null;
  let _onStopCompleted = null;

  function init(onDeviationStart, onDeviationEnd, onStopCompleted) {
    _onDeviationStart = onDeviationStart;
    _onDeviationEnd = onDeviationEnd;
    _onStopCompleted = onStopCompleted;
  }

  function setActiveRoute(route) {
    _activeRoute = route;
    _deviationStartTime = null;
    _isDeviating = false;
  }

  /**
   * Evalúa la posición actual vs la ruta planificada
   * Llamar en cada ciclo de polling
   */
  function evaluate(currentLat, currentLon, timestamp) {
    if (!_activeRoute || !_activeRoute.waypoints) return;

    const threshold = _activeRoute.threshold || 200;

    // 1. Verificar completación de paradas
    _checkStopCompletion(currentLat, currentLon, timestamp);

    // 2. Verificar desvío de la ruta (polyline de waypoints pendientes)
    const pendingWaypoints = _activeRoute.waypoints.filter(w => w.status !== 'completed');
    if (pendingWaypoints.length < 2) {
      // Solo queda una parada o ninguna, no calcular desvío de ruta
      if (_isDeviating) _resolveDeviation(timestamp);
      return;
    }

    const polyline = pendingWaypoints.map(w => ({ lat: w.lat, lon: w.lon }));
    const distance = GeoUtils.pointToPolylineDistance(currentLat, currentLon, polyline);

    if (distance > threshold) {
      if (!_isDeviating) {
        _deviationStartTime = timestamp;
        _isDeviating = true;
      } else {
        const secondsOff = (timestamp - _deviationStartTime) / 1000;
        if (secondsOff >= DEVIATION_MIN_SECONDS) {
          // Activar alerta de desvío
          const deviation = {
            id: 'dev_' + Date.now(),
            lat: currentLat,
            lon: currentLon,
            distanceMeters: Math.round(distance),
            startTime: new Date(_deviationStartTime).toISOString(),
            duration: Math.round(secondsOff),
            status: 'active'
          };
          if (_onDeviationStart) _onDeviationStart(deviation);

          // Registrar en la ruta
          if (!_activeRoute.deviations) _activeRoute.deviations = [];
          const existing = _activeRoute.deviations.find(d => d.status === 'active');
          if (!existing) {
            _activeRoute.deviations.push(deviation);
            _persistRoute();
          }
        }
      }
    } else {
      if (_isDeviating) {
        _resolveDeviation(timestamp);
      }
    }
  }

  function _checkStopCompletion(currentLat, currentLon, timestamp) {
    const ARRIVAL_RADIUS = 100; // 100 metros para considerar llegada
    for (const stop of _activeRoute.waypoints) {
      if (stop.status === 'completed') continue;
      const dist = GeoUtils.haversineDistance(currentLat, currentLon, stop.lat, stop.lon);
      if (dist <= ARRIVAL_RADIUS) {
        stop.status = 'completed';
        stop.arrivedAt = new Date(timestamp).toISOString();
        stop.distanceOnArrival = Math.round(dist);
        _persistRoute();
        if (_onStopCompleted) _onStopCompleted(stop, _activeRoute);
      }
    }
  }

  function _resolveDeviation(timestamp) {
    _isDeviating = false;
    _deviationStartTime = null;
    const active = _activeRoute.deviations?.find(d => d.status === 'active');
    if (active) {
      active.status = 'resolved';
      active.resolvedAt = new Date(timestamp).toISOString();
      active.totalDurationSeconds = Math.round((timestamp - new Date(active.startTime).getTime()) / 1000);
      _persistRoute();
      if (_onDeviationEnd) _onDeviationEnd(active);
    }
  }

  function _persistRoute() {
    if (!_activeRoute) return;
    const routes = JSON.parse(localStorage.getItem('rm_routes') || '[]');
    const idx = routes.findIndex(r => r.id === _activeRoute.id);
    if (idx >= 0) routes[idx] = _activeRoute;
    localStorage.setItem('rm_routes', JSON.stringify(routes));
  }

  function getActiveDeviations() {
    return (_activeRoute?.deviations || []).filter(d => d.status === 'active');
  }

  function getAllDeviations() {
    return _activeRoute?.deviations || [];
  }

  function isCurrentlyDeviating() {
    return _isDeviating;
  }

  return {
    init,
    setActiveRoute,
    evaluate,
    getActiveDeviations,
    getAllDeviations,
    isCurrentlyDeviating
  };
})();
