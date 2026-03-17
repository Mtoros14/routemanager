/**
 * reports.js
 * Módulo 4: Historial y reportes de rutas
 */

const Reports = (() => {
  function init() {
    renderReports();
  }

  function renderReports() {
    const container = document.getElementById('tab-reports');
    const routes = JSON.parse(localStorage.getItem('rm_routes') || '[]');

    container.innerHTML = `
      <div class="reports-panel">
        <div class="reports-header">
          <h2 class="form-title">Historial de Rutas</h2>
          <button class="btn btn--primary btn--sm" onclick="Reports.exportCSV()">
            ↓ Exportar CSV
          </button>
        </div>
        <div class="reports-table-wrap">
          ${routes.length === 0
            ? `<div class="empty-state"><span style="font-size:2rem">📋</span><p>No hay rutas registradas.</p></div>`
            : `<table class="reports-table">
                <thead>
                  <tr>
                    <th>Ruta</th>
                    <th>Estado</th>
                    <th>Creada</th>
                    <th>Paradas</th>
                    <th>Completadas</th>
                    <th>Desvíos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${routes.map(r => {
                    const completed = r.waypoints.filter(w => w.status === 'completed').length;
                    const pct = GeoUtils.routeCompletionPercent(r.waypoints);
                    return `
                      <tr>
                        <td><strong>${r.name}</strong></td>
                        <td><span class="badge badge--${r.status}">${r.status.toUpperCase()}</span></td>
                        <td>${new Date(r.createdAt).toLocaleDateString('es-AR')}</td>
                        <td>${r.waypoints.length}</td>
                        <td>
                          <div class="table-progress">
                            <span>${completed}/${r.waypoints.length} (${pct}%)</span>
                            <div class="table-progress-bar">
                              <div style="width:${pct}%"></div>
                            </div>
                          </div>
                        </td>
                        <td>${(r.deviations || []).length}</td>
                        <td>
                          <button class="btn btn--ghost btn--xs"
                            onclick="Reports.deleteRoute('${r.id}')">🗑️ Eliminar</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>
    `;
  }

  function deleteRoute(routeId) {
    if (!confirm('¿Eliminar esta ruta del historial?')) return;
    const routes = JSON.parse(localStorage.getItem('rm_routes') || '[]');
    const filtered = routes.filter(r => r.id !== routeId);
    localStorage.setItem('rm_routes', JSON.stringify(filtered));
    renderReports();
    RealtimeTracking.refresh();
  }

  function exportCSV() {
    const routes = JSON.parse(localStorage.getItem('rm_routes') || '[]');
    if (routes.length === 0) {
      UIHelpers.showError('No hay rutas para exportar.');
      return;
    }
    const headers = ['ID', 'Nombre', 'Estado', 'Creada', 'Paradas Total', 'Paradas Completadas', 'Desvíos'];
    const rows = routes.map(r => [
      r.id,
      r.name,
      r.status,
      new Date(r.createdAt).toLocaleDateString('es-AR'),
      r.waypoints.length,
      r.waypoints.filter(w => w.status === 'completed').length,
      (r.deviations || []).length
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rutas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { init, renderReports, deleteRoute, exportCSV };
})();
