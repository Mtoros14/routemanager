/**
 * app.js
 * Punto de entrada del Add-in RouteManager para Geotab
 * Patrón estándar: geotab.addin.RouteManager = function(api, state) { ... }
 */

/* global geotab */
geotab.addin.RouteManager = function (api, state) {
  'use strict';

  let _api = api;
  let _state = state;
  let _initialized = false;

  // ─── Inicialización ────────────────────────────────────────────────────────
  async function initialize(freshApi, freshState, callback) {
    _api = freshApi;
    _state = freshState;

    // Inicializar helpers con la API de Geotab
    ApiHelpers.init(_api);

    UIHelpers.setLoading(true);

    try {
      // Inicializar todos los módulos
      await RouteAssignment.init(onRouteSaved);
      await RealtimeTracking.init();
      AlertsModule.init();
      Reports.init();

      _initialized = true;
      setupTabs();
      setupModal();

      console.log('[RouteManager] Add-in inicializado correctamente.');
    } catch (err) {
      console.error('[RouteManager] Error en inicialización:', err);
      UIHelpers.showError('Error inicializando RouteManager: ' + (err.message || err));
    } finally {
      UIHelpers.setLoading(false);
      if (callback) callback();
    }
  }

  // ─── Tab navigation ────────────────────────────────────────────────────────
  function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('tab-btn--active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
        tab.classList.add('tab-btn--active');
        const target = tab.dataset.tab;
        document.getElementById('tab-' + target).classList.add('tab-panel--active');

        // Refrescar datos al cambiar de tab
        if (target === 'monitor') RealtimeTracking.refresh();
        if (target === 'reports') Reports.renderReports();
      });
    });
  }

  function setupModal() {
    const modal = document.getElementById('waypoint-modal');
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  }

  function onRouteSaved(route) {
    // Cuando se guarda una ruta, refrescar monitor
    RealtimeTracking.refresh();
    // Cambiar automáticamente al tab de monitoreo
    const monitorTab = document.querySelector('[data-tab="monitor"]');
    if (monitorTab) monitorTab.click();
  }

  // ─── Ciclo de vida Geotab ──────────────────────────────────────────────────
  function focus(freshApi, freshState) {
    _api = freshApi;
    _state = freshState;
    ApiHelpers.init(_api);
    if (_initialized) RealtimeTracking.refresh();
  }

  function blur() {
    // El Page Visibility API en polling ya maneja la pausa automática
    // pero detenemos el polling explícitamente al perder foco
    RealtimeTracking.stopPolling();
  }

  return {
    initialize,
    focus,
    blur
  };
};
