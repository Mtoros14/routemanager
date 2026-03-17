/**
 * alerts.js
 * Módulo: Panel de alertas y log de desvíos
 */

const AlertsModule = (() => {
  let _alerts = [];

  function init() {
    renderAlertsPanel();
    loadFromStorage();
  }

  function renderAlertsPanel() {
    const container = document.getElementById('tab-alerts');
    container.innerHTML = `
      <div class="alerts-panel">
        <div class="alerts-header">
          <h2 class="form-title">Centro de Alertas</h2>
          <div class="alerts-controls">
            <span class="alerts-count" id="alerts-count">0 alertas</span>
            <button class="btn btn--ghost btn--sm" onclick="AlertsModule.clearAll()">Limpiar historial</button>
          </div>
        </div>
        <div id="alerts-list" class="alerts-list">
          <div class="empty-state">
            <span style="font-size:2rem">🔔</span>
            <p>No hay alertas registradas.</p>
            <small>Las alertas de desvío aparecerán aquí en tiempo real.</small>
          </div>
        </div>
      </div>
    `;
  }

  function addDeviation(deviation, route) {
    const alert_ = {
      id: deviation.id,
      type: 'deviation',
      routeId: route?.id,
      routeName: route?.name || '—',
      deviceId: route?.deviceId,
      distanceMeters: deviation.distanceMeters,
      lat: deviation.lat,
      lon: deviation.lon,
      startTime: deviation.startTime,
      status: deviation.status,
      timestamp: new Date().toISOString()
    };
    _alerts.unshift(alert_);
    _saveToStorage();
    renderAlertsList();
  }

  function updateDeviationResolved(deviationId) {
    const alert_ = _alerts.find(a => a.id === deviationId);
    if (alert_) {
      alert_.status = 'resolved';
      alert_.resolvedAt = new Date().toISOString();
      _saveToStorage();
      renderAlertsList();
    }
  }

  function renderAlertsList() {
    const list = document.getElementById('alerts-list');
    if (!list) return;

    document.getElementById('alerts-count').textContent =
      `${_alerts.length} alerta${_alerts.length !== 1 ? 's' : ''}`;

    if (_alerts.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span style="font-size:2rem">🔔</span>
          <p>No hay alertas registradas.</p>
        </div>`;
      return;
    }

    list.innerHTML = _alerts.map(a => `
      <div class="alert-item alert-item--${a.status}">
        <div class="alert-icon">${a.status === 'active' ? '🔴' : '✅'}</div>
        <div class="alert-body">
          <div class="alert-title">
            <strong>${a.status === 'active' ? 'DESVÍO ACTIVO' : 'Desvío resuelto'}</strong>
            — ${a.routeName}
          </div>
          <div class="alert-meta">
            <span>📍 ${a.distanceMeters}m fuera de ruta</span>
            <span>🕐 ${new Date(a.startTime).toLocaleString('es-AR')}</span>
            ${a.resolvedAt ? `<span>✓ Resuelto: ${new Date(a.resolvedAt).toLocaleTimeString('es-AR')}</span>` : ''}
          </div>
          <div class="alert-coords">
            Posición: ${a.lat?.toFixed(5)}, ${a.lon?.toFixed(5)}
          </div>
        </div>
        <div class="alert-actions">
          <button class="btn btn--ghost btn--xs"
            onclick="AlertsModule.removeAlert('${a.id}')">Descartar</button>
        </div>
      </div>
    `).join('');
  }

  function removeAlert(id) {
    _alerts = _alerts.filter(a => a.id !== id);
    _saveToStorage();
    renderAlertsList();
  }

  function clearAll() {
    _alerts = [];
    _saveToStorage();
    renderAlertsList();
  }

  function _saveToStorage() {
    localStorage.setItem('rm_alerts', JSON.stringify(_alerts));
  }

  function loadFromStorage() {
    _alerts = JSON.parse(localStorage.getItem('rm_alerts') || '[]');
    renderAlertsList();
  }

  return { init, addDeviation, updateDeviationResolved, removeAlert, clearAll };
})();
