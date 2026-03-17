/**
 * routeAssignment.js
 * Módulo 1: Creación y asignación de rutas a vehículos
 */

const RouteAssignment = (() => {
  let _devices = [];
  let _drivers = [];
  let _zones = [];
  let _currentWaypoints = [];
  let _onRouteSaved = null;

  /**
   * Inicializa el módulo cargando datos desde Geotab
   */
  async function init(onRouteSaved) {
    _onRouteSaved = onRouteSaved;
    await loadData();
    renderForm();
  }

  async function loadData() {
    try {
      [_devices, _drivers, _zones] = await Promise.all([
        ApiHelpers.getDevices(),
        ApiHelpers.getDrivers(),
        ApiHelpers.getZones()
      ]);
    } catch (err) {
      console.error('[RouteAssignment] Error cargando datos:', err);
      UIHelpers.showError('Error al cargar datos de Geotab. Verificá la conexión.');
    }
  }

  function renderForm() {
    const container = document.getElementById('tab-assign');
    container.innerHTML = `
      <div class="assign-form">
        <div class="form-header">
          <h2 class="form-title">Nueva Ruta</h2>
          <p class="form-subtitle">Configurá y asigná una ruta a un vehículo</p>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Nombre de la ruta</label>
            <input type="text" id="route-name" class="form-input" placeholder="Ej: Reparto zona norte - Lunes">
          </div>

          <div class="form-group">
            <label class="form-label">Vehículo</label>
            <select id="route-device" class="form-select">
              <option value="">— Seleccionar vehículo —</option>
              ${_devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Conductor</label>
            <select id="route-driver" class="form-select">
              <option value="">— Seleccionar conductor —</option>
              ${_drivers.map(u => `<option value="${u.id}">${u.name || u.firstName + ' ' + u.lastName}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Fecha y hora de inicio</label>
            <input type="datetime-local" id="route-starttime" class="form-input">
          </div>

          <div class="form-group form-group--full">
            <label class="form-label">Umbral de desvío</label>
            <div class="threshold-options">
              <label class="radio-chip"><input type="radio" name="threshold" value="100"> 100 m</label>
              <label class="radio-chip"><input type="radio" name="threshold" value="200" checked> 200 m</label>
              <label class="radio-chip"><input type="radio" name="threshold" value="300"> 300 m</label>
              <label class="radio-chip"><input type="radio" name="threshold" value="500"> 500 m</label>
            </div>
          </div>
        </div>

        <div class="waypoints-section">
          <div class="waypoints-header">
            <h3 class="section-title">Paradas</h3>
            <button class="btn btn--ghost btn--sm" id="btn-add-waypoint">+ Agregar parada</button>
          </div>
          <div id="waypoints-list" class="waypoints-list">
            <div class="waypoints-empty">
              <span class="empty-icon">📍</span>
              <p>No hay paradas. Agregá al menos una parada para crear la ruta.</p>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn--secondary" id="btn-clear-form">Limpiar</button>
          <button class="btn btn--primary" id="btn-save-route">Guardar y Activar Ruta</button>
        </div>
      </div>
    `;

    document.getElementById('btn-add-waypoint').addEventListener('click', openWaypointModal);
    document.getElementById('btn-save-route').addEventListener('click', saveRoute);
    document.getElementById('btn-clear-form').addEventListener('click', clearForm);
  }

  function openWaypointModal() {
    const modal = document.getElementById('waypoint-modal');
    const zoneOptions = _zones.map(z =>
      `<option value="${z.id}" data-lat="${z.points?.[0]?.y || 0}" data-lon="${z.points?.[0]?.x || 0}">${z.name}</option>`
    ).join('');

    document.getElementById('modal-body').innerHTML = `
      <h3 class="modal-title">Agregar Parada</h3>
      <div class="form-group">
        <label class="form-label">Nombre de la parada</label>
        <input type="text" id="wp-name" class="form-input" placeholder="Ej: Cliente ABC - San Martín 456">
      </div>
      <div class="form-group">
        <label class="form-label">Zona existente (opcional)</label>
        <select id="wp-zone" class="form-select">
          <option value="">— O ingresá coordenadas manualmente —</option>
          ${zoneOptions}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Latitud</label>
          <input type="number" id="wp-lat" class="form-input" step="0.000001" placeholder="-38.951">
        </div>
        <div class="form-group">
          <label class="form-label">Longitud</label>
          <input type="number" id="wp-lon" class="form-input" step="0.000001" placeholder="-68.059">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tiempo estimado en parada</label>
          <select id="wp-dwell" class="form-select">
            <option value="5">5 minutos</option>
            <option value="10" selected>10 minutos</option>
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="60">1 hora</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ventana de tiempo (llegada)</label>
          <input type="time" id="wp-window" class="form-input">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn--secondary" onclick="document.getElementById('waypoint-modal').classList.remove('active')">Cancelar</button>
        <button class="btn btn--primary" id="btn-confirm-waypoint">Confirmar Parada</button>
      </div>
    `;

    // Autocompletar lat/lon desde zona seleccionada
    document.getElementById('wp-zone').addEventListener('change', function() {
      const opt = this.options[this.selectedIndex];
      if (opt.value) {
        document.getElementById('wp-lat').value = opt.dataset.lat;
        document.getElementById('wp-lon').value = opt.dataset.lon;
        document.getElementById('wp-name').value = document.getElementById('wp-name').value || opt.text;
      }
    });

    document.getElementById('btn-confirm-waypoint').addEventListener('click', confirmWaypoint);
    modal.classList.add('active');
  }

  function confirmWaypoint() {
    const name = document.getElementById('wp-name').value.trim();
    const lat = parseFloat(document.getElementById('wp-lat').value);
    const lon = parseFloat(document.getElementById('wp-lon').value);
    const dwell = parseInt(document.getElementById('wp-dwell').value);
    const window_ = document.getElementById('wp-window').value;

    if (!name || isNaN(lat) || isNaN(lon)) {
      UIHelpers.showError('Completá el nombre y las coordenadas de la parada.');
      return;
    }

    _currentWaypoints.push({ name, lat, lon, dwell, window: window_, status: 'pending' });
    document.getElementById('waypoint-modal').classList.remove('active');
    renderWaypointsList();
  }

  function renderWaypointsList() {
    const list = document.getElementById('waypoints-list');
    if (_currentWaypoints.length === 0) {
      list.innerHTML = `<div class="waypoints-empty"><span class="empty-icon">📍</span><p>No hay paradas todavía.</p></div>`;
      return;
    }
    list.innerHTML = _currentWaypoints.map((wp, i) => `
      <div class="waypoint-item" data-index="${i}">
        <div class="waypoint-order">${i + 1}</div>
        <div class="waypoint-info">
          <span class="waypoint-name">${wp.name}</span>
          <span class="waypoint-meta">${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)} · ${wp.dwell} min${wp.window ? ' · Ventana: ' + wp.window : ''}</span>
        </div>
        <div class="waypoint-actions">
          ${i > 0 ? `<button class="icon-btn" onclick="RouteAssignment.moveWaypoint(${i}, -1)" title="Subir">↑</button>` : ''}
          ${i < _currentWaypoints.length - 1 ? `<button class="icon-btn" onclick="RouteAssignment.moveWaypoint(${i}, 1)" title="Bajar">↓</button>` : ''}
          <button class="icon-btn icon-btn--danger" onclick="RouteAssignment.removeWaypoint(${i})" title="Eliminar">✕</button>
        </div>
      </div>
    `).join('');
  }

  function moveWaypoint(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= _currentWaypoints.length) return;
    [_currentWaypoints[index], _currentWaypoints[newIndex]] = [_currentWaypoints[newIndex], _currentWaypoints[index]];
    renderWaypointsList();
  }

  function removeWaypoint(index) {
    _currentWaypoints.splice(index, 1);
    renderWaypointsList();
  }

  async function saveRoute() {
    const name = document.getElementById('route-name').value.trim();
    const deviceId = document.getElementById('route-device').value;
    const driverId = document.getElementById('route-driver').value;
    const startTime = document.getElementById('route-starttime').value;
    const threshold = document.querySelector('input[name="threshold"]:checked')?.value || '200';

    if (!name) return UIHelpers.showError('El nombre de la ruta es obligatorio.');
    if (!deviceId) return UIHelpers.showError('Seleccioná un vehículo.');
    if (_currentWaypoints.length === 0) return UIHelpers.showError('Agregá al menos una parada.');

    const btn = document.getElementById('btn-save-route');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const routeEntity = {
        name,
        comment: JSON.stringify({
          driverId,
          startTime: startTime || new Date().toISOString(),
          threshold: parseInt(threshold),
          waypoints: _currentWaypoints,
          status: 'pending',
          createdAt: new Date().toISOString()
        }),
        routeType: 'Basic',
        stops: _currentWaypoints.map((wp, i) => ({
          sequence: i,
          zone: { id: 'UnknownZoneId' },
          activeFrom: new Date().toISOString(),
          activeTo: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
        }))
      };

      // En producción: await ApiHelpers.saveRoute(routeEntity);
      // Para demo, usamos localStorage como persistencia local
      const savedRoutes = JSON.parse(localStorage.getItem('rm_routes') || '[]');
      const newRoute = {
        id: 'route_' + Date.now(),
        name,
        deviceId,
        driverId,
        startTime: startTime || new Date().toISOString(),
        threshold: parseInt(threshold),
        waypoints: _currentWaypoints.map(wp => ({ ...wp, status: 'pending' })),
        status: 'active',
        createdAt: new Date().toISOString(),
        deviations: []
      };
      savedRoutes.push(newRoute);
      localStorage.setItem('rm_routes', JSON.stringify(savedRoutes));

      UIHelpers.showSuccess(`Ruta "${name}" guardada y activada.`);
      clearForm();
      if (_onRouteSaved) _onRouteSaved(newRoute);
    } catch (err) {
      console.error('[RouteAssignment] Error guardando ruta:', err);
      UIHelpers.showError('Error al guardar la ruta: ' + (err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar y Activar Ruta';
    }
  }

  function clearForm() {
    document.getElementById('route-name').value = '';
    document.getElementById('route-device').value = '';
    document.getElementById('route-driver').value = '';
    document.getElementById('route-starttime').value = '';
    _currentWaypoints = [];
    renderWaypointsList();
  }

  return { init, moveWaypoint, removeWaypoint };
})();
