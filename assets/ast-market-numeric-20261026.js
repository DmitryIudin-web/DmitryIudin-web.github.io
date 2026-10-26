/* AutoNDS market-price gate, checked 2026-10-26 (Europe/Samara).
 * The 2026-10-12 buyer averages and order starter price lack current,
 * buyer-specific evidence for the rolling 14-day window. Keep the old
 * module immutable and hide its numeric section until a qualified snapshot
 * can replace it.
 */
(function () {
  'use strict';
  var id = 'ast-market-reference-20261012';
  var styleId = 'ast-market-price-gate-20261026';
  if (document.getElementById(styleId)) return;
  var style = document.createElement('style');
  style.id = styleId;
  style.textContent = '#' + id + '{display:none!important}';
  document.head.appendChild(style);
})();
