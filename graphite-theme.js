// Default the new design to graphite once; subsequent day/night choices remain personal.
(() => {
  'use strict';
  document.body.classList.add('graphite');
  try {
    if (localStorage.getItem('hub-graphite-theme-v1') !== '1') {
      localStorage.setItem('sh_theme', 'dark');
      localStorage.setItem('terra-appearance', 'night');
      localStorage.setItem('hub-graphite-theme-v1', '1');
    }
  } catch (_) {}
})();
