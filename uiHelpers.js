/**
 * uiHelpers.js
 * Utilitarios de UI: toasts, modales, loaders
 */

const UIHelpers = (() => {
  let _toastTimer = null;

  function showToast(message, type = 'info') {
    let toast = document.getElementById('rm-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rm-toast';
      document.body.appendChild(toast);
    }
    toast.className = `rm-toast rm-toast--${type} rm-toast--visible`;
    toast.textContent = message;
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.remove('rm-toast--visible'), 4000);
  }

  function showError(msg) { showToast(msg, 'error'); }
  function showSuccess(msg) { showToast(msg, 'success'); }
  function showAlert(msg, type = 'warning') { showToast(msg, type); }

  function setLoading(isLoading) {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = isLoading ? 'flex' : 'none';
  }

  return { showError, showSuccess, showAlert, showToast, setLoading };
})();
