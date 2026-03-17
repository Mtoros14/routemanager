/**
 * realtimeTracking.js
 * Módulo 2: Monitoreo en tiempo real de rutas activas
 */

const RealtimeTracking = (() => {
  const POLL_INTERVAL_MS = 10000; // 10 segundos
  let _pollingTimer = null;
  let _activeRoute = null;
  let _devices = [];
  let _positionHistory = [];
  let _mapInstance = null;

  async function init() {
    _devices = await ApiHelpers.getDevices().catch(() => []);
    renderDashboard();
    loadActiveRoutes();
  }

  function renderDashboard() {
    const container = document.getElementById('tab-monitor');
    container.innerHTML = `
      <div class="monitor-layout">
        <div class="monitor-sidebar">
          <div class="sidebar-section">
            <h3 class="section-title">Rutas Activas</h3>
            <div id="active-routes-list" class="routes-list">
              <div class="empty-state">No hay rutas activas.</div>
            </div>
          </div>

          <div class="sidebar-section" id="route-detail-panel" style="display:none">
            <h3 class="section-title">Estado de Ruta</h3>

            <div class="status-card" id="status-deviation">
              <div class="status-indicator" id="deviation-indicator"></div>
              <div class="status-info">
                <span class="status-label" id="deviation-label">En ruta</span>
                <span class="status-value" id="deviation-distance">—</span>
              </div>
            </div>

            <div class="progress-section">
              <div class="progress-header">
                <span>Completación</span>
                <span id="completion-pct">0%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width:0%"></div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">Velocidad</span>
                <span class="stat-value" id="stat-speed">— km/h</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Paradas</span>
                <span class="stat-value" id="stat-stops">0 / 0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Desvíos</span>
                <span class="stat-value" id="stat-deviations">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Próxima parada</span>
                <span class="stat-value" id="stat-next-stop">—</span>
              </div>
            </div>

            <div class="stops-timeline" id="stops-timeline"></div>
          </div>
        </div>

        <div class="monitor-map">
          <div id="map-container" class="map-container">
            <div class="map-placeholder">
              <div class="map-placeholder-icon">🗺️</div>
              <p>Seleccioná una ruta activa para ver el mapa</p>
              <p class="map-note">En producción, el mapa se integra con MyGeotab Map API</p>
            </div>
          </div>
          <div id="map-legend" class="map-legend" style="display:none">
            <span class="legend-item"><span class="legend-dot legend-dot--blue"></span> Ruta planificada</span>
            <span class="legend-item"><span class="legend-dot legend-dot--green"></span> Recorrido real</span>
            <span class="legend-item"><span class="legend-dot legend-dot--red"></span> Desvío</span>
            <span class="legend-item"><span class="legend-dot legend-dot--orange"></span> Vehículo</span>
          </div>
        </div>
      </div>
    `;
  }

  function loadActiveRoutes() {
    const routes = JSON.parse(localStorage.getItem('rm_routes') || '[]');
    const active = routes.filter(r => r.status === 'active');
    const list = document.getElementById('active-routes-list');

    if (active.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay rutas activas.<br><small>Asigná una ruta en la pestaña "Asignar".</small></div>';
      return;
    }

    list.innerHTML = active.map(r => {
      const device = _devices.find(d => d.id === r.deviceId);
      const completed = r.waypoints.filter(w => w.status === 'completed').length;
      const pct = GeoUtils.routeCompletionPercent(r.waypoints);
      return `
        <div class="route-card ${_activeRoute?.id === r.id ? 'route-card--active' : ''}"
             onclick="RealtimeTracking.selectRoute('${r.id}')">
          <div class="route-card-header">
            <span class="route-card-name">${r.name}</span>
            <span class="route-status-badge route-status-badge--active">ACTIVA</span>
          </div>
          <div class="route-card-meta">
            <span>🚛 ${device?.name || r.deviceId}</span>
            <span>📍 ${completed}/${r.waypoints.length} paradas</span>
          </div>
          <div class="route-card-progress">
            <div class="route-card-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function selectRoute(routeId) {
    stopPolling();
    const routes = JSON.parse(localStorage.getItem('rm_routes') || '[]');
    _activeRoute = routes.find(r => r.id === routeId);
    if (!_activeRoute) return;

    _positionHistory = [];

    // Inicializar detector de desvíos
    DeviationDetector.setActiveRoute(_activeRoute);
    DeviationDetector.init(
      onDeviationStart,
      onDeviationEnd,
      onStopCompleted
    );

    document.getElementById('route-detail-panel').style.display = 'block';
    document.getElementById('map-legend').style.display = 'flex';
    updateDashboard();
    renderMapSim();
    loadActiveRoutes(); // refrescar selección visual

    startPolling();
  }

  function startPolling() {
    updateFromGeotab(); // primera ejecución inmediata
    _pollingTimer = setInterval(() => {
      if (!document.hidden) updateFromGeotab();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (_pollingTimer) {
      clearInterval(_pollingTimer);
      _pollingTimer = null;
    }
  }

  async function updateFromGeotab() {
    if (!_activeRoute) return;
    try {
      const status = await ApiHelpers.getDeviceStatus(_activeRoute.deviceId);
      if (!status) return;

      const lat = status.latitude;
      const lon = status.longitude;
      const speed = Math.round(status.speed || 0);
      const ts = new Date(status.dateTime || Date.now()).getTime();

      _positionHistory.push({ lat, lon, ts });

      // Evaluar desvíos
      DeviationDetector.evaluate(lat, lon, ts);

      updateDashboardStats(lat, lon, speed);
      updateMapSim(lat, lon);
    } catch (err) {
      console.warn('[RealtimeTracking] Error en polling:', err);
    }
  }

  function onDeviationStart(deviation) {
    UIHelpers.showAlert(`⚠️ DESVÍO DETECTADO — ${deviation.distanceMeters}m fuera de ruta`, 'warning');
    updateDeviationIndicator(true, deviation.distanceMeters);
    document.getElementById('stat-deviations').textContent =
      DeviationDetector.getAllDeviations().length;
    AlertsModule.addDeviation(deviation, _activeRoute);
  }

  function onDeviationEnd(deviation) {
    UIHelpers.showAlert('✓ Vehículo retomó la ruta', 'success');
    updateDeviationIndicator(false, 0);
  }

  function onStopCompleted(stop, route) {
    UIHelpers.showAlert(`✓ Parada completada: ${stop.name}`, 'success');
    updateDashboard();
  }

  function updateDeviationIndicator(isDeviating, meters) {
    const indicator = document.getElementById('deviation-indicator');
    const label = document.getElementById('deviation-label');
    const distEl = document.getElementById('deviation-distance');
    if (isDeviating) {
      indicator.className = 'status-indicator status-indicator--red';
      label.textContent = 'DESVIADO';
      distEl.textContent = GeoUtils.formatDistance(meters) + ' fuera de ruta';
    } else {
      indicator.className = 'status-indicator status-indicator--green';
      label.textContent = 'En ruta';
      distEl.textContent = '—';
    }
  }

  function updateDashboardStats(lat, lon, speed) {
    document.getElementById('stat-speed').textContent = speed + ' km/h';
    updateDashboard();
  }

  function updateDashboard() {
    if (!_activeRoute) return;
    const completed = _activeRoute.waypoints.filter(w => w.status === 'completed').length;
    const total = _activeRoute.waypoints.length;
    const pct = GeoUtils.routeCompletionPercent(_activeRoute.waypoints);

    document.getElementById('completion-pct').textContent = pct + '%';
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('stat-stops').textContent = `${completed} / ${total}`;
    document.getElementById('stat-deviations').textContent =
      DeviationDetector.getAllDeviations().length;

    const nextStop = _activeRoute.waypoints.find(w => w.status !== 'completed');
    document.getElementById('stat-next-stop').textContent = nextStop ? nextStop.name : '—';

    renderStopsTimeline();
  }

  function renderStopsTimeline() {
    const el = document.getElementById('stops-timeline');
    if (!_activeRoute) return;
    el.innerHTML = _activeRoute.waypoints.map((wp, i) => `
      <div class="timeline-stop timeline-stop--${wp.status}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <span class="timeline-name">${wp.name}</span>
          ${wp.arrivedAt
            ? `<span class="timeline-time">Llegó: ${new Date(wp.arrivedAt).toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'})}</span>`
            : `<span class="timeline-time">${wp.window || 'Sin ventana'}</span>`
          }
        </div>
        <div class="timeline-status">
          ${wp.status === 'completed' ? '✓' : wp.status === 'pending' ? '⏳' : '●'}
        </div>
      </div>
    `).join('');
  }

  /** Renderiza un mapa SVG simulado cuando no hay mapa real de Geotab */
  function renderMapSim() {
    const container = document.getElementById('map-container');
    if (!_activeRoute || _activeRoute.waypoints.length === 0) return;

    const wps = _activeRoute.waypoints;
    const lats = wps.map(w => w.lat);
    const lons = wps.map(w => w.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const pad = 0.01;

    container.innerHTML = `
      <div class="map-sim">
        <div class="map-sim-label">Vista de Ruta (Simulada)</div>
        <svg id="route-svg" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
          <rect width="600" height="400" fill="#1a2332"/>
          <!-- Grid lines -->
          ${Array.from({length:6},(_,i)=>`<line x1="${i*120}" y1="0" x2="${i*120}" y2="400" stroke="#253047" stroke-width="1"/>`).join('')}
          ${Array.from({length:4},(_,i)=>`<line x1="0" y1="${i*133}" x2="600" y2="${i*133}" stroke="#253047" stroke-width="1"/>`).join('')}
          <!-- Ruta planificada -->
          <polyline id="planned-route" 
            points="${wps.map(w => `${normalize(w.lon, minLon-pad, maxLon+pad, 40, 560)},${normalize(w.lat, minLat-pad, maxLat+pad, 360, 40)}`).join(' ')}"
            fill="none" stroke="#0075C9" stroke-width="3" stroke-dasharray="8,4" opacity="0.8"/>
          <!-- Recorrido real -->
          <polyline id="real-route" points="" fill="none" stroke="#00D68F" stroke-width="3"/>
          <!-- Paradas -->
          ${wps.map((w, i) => `
            <circle cx="${normalize(w.lon, minLon-pad, maxLon+pad, 40, 560)}" 
                    cy="${normalize(w.lat, minLat-pad, maxLat+pad, 360, 40)}"
                    r="8" fill="${w.status === 'completed' ? '#00D68F' : '#0075C9'}" 
                    stroke="white" stroke-width="2"
                    id="stop-dot-${i}"/>
            <text x="${normalize(w.lon, minLon-pad, maxLon+pad, 40, 560) + 12}" 
                  y="${normalize(w.lat, minLat-pad, maxLat+pad, 360, 40) + 4}"
                  fill="white" font-size="10" font-family="monospace">${i+1}. ${w.name.substring(0,15)}</text>
          `).join('')}
          <!-- Vehículo -->
          <g id="vehicle-marker" transform="translate(-20,-20)">
            <circle r="12" fill="#FF6B2B" stroke="white" stroke-width="3"/>
            <text text-anchor="middle" dy="4" fill="white" font-size="12">🚛</text>
          </g>
        </svg>
      </div>
    `;
  }

  function normalize(value, min, max, outMin, outMax) {
    if (max === min) return (outMin + outMax) / 2;
    return outMin + ((value - min) / (max - min)) * (outMax - outMin);
  }

  function updateMapSim(lat, lon) {
    if (!_activeRoute || _activeRoute.waypoints.length === 0) return;
    const wps = _activeRoute.waypoints;
    const lats = wps.map(w => w.lat);
    const lons = wps.map(w => w.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const pad = 0.01;

    const x = normalize(lon, minLon - pad, maxLon + pad, 40, 560);
    const y = normalize(lat, minLat - pad, maxLat + pad, 360, 40);

    const vm = document.getElementById('vehicle-marker');
    if (vm) vm.setAttribute('transform', `translate(${x},${y})`);

    // Actualizar polyline real
    const realRoute = document.getElementById('real-route');
    if (realRoute) {
      const pts = _positionHistory.slice(-100).map(p => {
        const px = normalize(p.lon, minLon - pad, maxLon + pad, 40, 560);
        const py = normalize(p.lat, minLat - pad, maxLat + pad, 360, 40);
        return `${px},${py}`;
      }).join(' ');
      realRoute.setAttribute('points', pts);
    }

    // Actualizar colores de paradas
    wps.forEach((w, i) => {
      const dot = document.getElementById(`stop-dot-${i}`);
      if (dot) dot.setAttribute('fill', w.status === 'completed' ? '#00D68F' : '#0075C9');
    });

    // Color de desvío
    const planned = document.getElementById('planned-route');
    if (planned) {
      planned.setAttribute('stroke', DeviationDetector.isCurrentlyDeviating() ? '#FF3D3D' : '#0075C9');
    }
  }

  // Público
  function refresh() {
    loadActiveRoutes();
  }

  return { init, selectRoute, stopPolling, refresh };
})();
