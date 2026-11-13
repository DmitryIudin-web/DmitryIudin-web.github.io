// The Tilda parent owns the standard form, the source URL and campaign attribution.
(() => {
  const site = 'https://avtonds.ru';
  const embedded = window.parent !== window;
  const parentOrigin = location.ancestorOrigins?.[0] || site;
  const siteParent = parentOrigin === site || parentOrigin === 'https://www.avtonds.ru';
  const overview = new URL('zeekr-9x', site);
  overview.hash = 'request-9x';
  for (const [key, value] of new URLSearchParams(location.search)) {
    if (/^utm_/.test(key) || ['yclid', 'gclid'].includes(key)) overview.searchParams.set(key, value);
  }
  window.ast9xQuote = () => {
    if (embedded && siteParent) window.parent.postMessage('ast:zeekr-9x:quote', parentOrigin);
    else window.location.assign(overview.href);
  };
  document.querySelectorAll('[data-quote]').forEach(link => {
    link.href = overview.href;
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.ast9xQuote();
    });
  });
})();
