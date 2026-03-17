/**
 * apiHelpers.js
 * Wrappers para la API de Geotab con manejo de errores y promesas
 */

const ApiHelpers = (() => {
  let _api = null;

  function init(api) {
    _api = api;
  }

  /**
   * Wrapper genérico que convierte api.call a Promise
   */
  function call(method, params) {
    return new Promise((resolve, reject) => {
      _api.call(method, params,
        result => resolve(result),
        err => reject(err)
      );
    });
  }

  /** Obtiene todos los Devices (vehículos) */
  async function getDevices() {
    return call('Get', {
      typeName: 'Device',
      resultsLimit: 500
    });
  }

  /** Obtiene usuarios/conductores */
  async function getDrivers() {
    return call('Get', {
      typeName: 'User',
      resultsLimit: 500
    });
  }

  /** Obtiene zonas definidas en MyGeotab */
  async function getZones() {
    return call('Get', {
      typeName: 'Zone',
      resultsLimit: 1000
    });
  }

  /** Obtiene el estado actual de un vehículo (posición, velocidad, etc.) */
  async function getDeviceStatus(deviceId) {
    const results = await call('Get', {
      typeName: 'DeviceStatusInfo',
      search: { deviceSearch: { id: deviceId } }
    });
    return results && results.length > 0 ? results[0] : null;
  }

  /** Obtiene el estado de múltiples vehículos */
  async function getAllDeviceStatuses(deviceIds) {
    const promises = deviceIds.map(id => getDeviceStatus(id));
    return Promise.all(promises);
  }

  /** Guarda una ruta personalizada en Geotab */
  async function saveRoute(routeEntity) {
    if (routeEntity.id) {
      return call('Set', { typeName: 'Route', entity: routeEntity });
    } else {
      return call('Add', { typeName: 'Route', entity: routeEntity });
    }
  }

  /** Obtiene rutas guardadas */
  async function getRoutes() {
    return call('Get', {
      typeName: 'Route',
      resultsLimit: 500
    });
  }

  /** Elimina una ruta */
  async function deleteRoute(routeId) {
    return call('Remove', {
      typeName: 'Route',
      entity: { id: routeId }
    });
  }

  /** Obtiene historial de posiciones de un vehículo en un rango horario */
  async function getLogRecords(deviceId, fromDate, toDate) {
    return call('Get', {
      typeName: 'LogRecord',
      search: {
        deviceSearch: { id: deviceId },
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString()
      },
      resultsLimit: 5000
    });
  }

  /** Registra un ExceptionEvent de desvío */
  async function logDeviationEvent(deviceId, latitude, longitude, distanceMeters) {
    // Guardamos el evento como un CustomData si no hay ExceptionRule configurada
    console.warn('[RouteManager] Desvío detectado:', { deviceId, latitude, longitude, distanceMeters });
    // En producción se integraría con ExceptionRule de Geotab
  }

  return {
    init,
    getDevices,
    getDrivers,
    getZones,
    getDeviceStatus,
    getAllDeviceStatuses,
    saveRoute,
    getRoutes,
    deleteRoute,
    getLogRecords,
    logDeviationEvent
  };
})();
