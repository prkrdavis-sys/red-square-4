/* First paint matches shouldForceLandscape. Unlock so a stuck rotate prompt cannot block boot. */
(function () {
  function unlockOrientation() {
    try {
      var orientation = screen.orientation;
      if (!orientation || typeof orientation.unlock !== 'function') {
        return;
      }
      var pending = orientation.unlock();
      if (pending && typeof pending.catch === 'function') {
        pending.catch(function () {});
      }
    } catch (error) {
      void error;
    }
  }

  function isOsLandscape(type, angle) {
    if (typeof type === 'string' && type.indexOf('landscape') === 0) {
      return true;
    }
    return angle === 90 || angle === -90 || angle === 270;
  }

  function isTouchFirst() {
    if (window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches) {
      return false;
    }
    return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
  }

  unlockOrientation();

  var view = window.visualViewport;
  var width = Math.max(1, Math.round((view && view.width) || window.innerWidth || 1));
  var height = Math.max(1, Math.round((view && view.height) || window.innerHeight || 1));
  var rootStyle = document.documentElement.style;
  rootStyle.setProperty('--vv-phys-width', width + 'px');
  rootStyle.setProperty('--vv-phys-height', height + 'px');

  var orientation = screen.orientation;
  var type = orientation && orientation.type;
  var angle = orientation && typeof orientation.angle === 'number' ? orientation.angle : window.orientation;
  var force = isTouchFirst() && !isOsLandscape(type, angle) && height > width;
  rootStyle.setProperty('--vv-width', (force ? height : width) + 'px');
  rootStyle.setProperty('--vv-height', (force ? width : height) + 'px');
  if (force && document.body) {
    document.body.classList.add('forced-landscape');
  }
})();
