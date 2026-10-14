/* track.js — anonieme gebruiksmeting voor het BINC-admin dashboard (/admin/portal-monitor)
 * Meet: paginaweergaven, actieve kijktijd, winkelmandje en JavaScript-fouten.
 * Geen cookies, geen externe diensten; alleen een willekeurig sessie-ID in sessionStorage.
 * Ingelogde klanten worden herkend aan hun portaal-token (dat de server zelf controleert). */
(function () {
  'use strict';
  if (window.PortalTrack) return;
  var API = 'https://server-medewerker-kpi.onrender.com';
  var sid;
  function rand() { var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); return Array.prototype.map.call(a, function (b) { return (b % 36).toString(36); }).join(''); }
  try { sid = sessionStorage.getItem('binc_sid'); if (!sid) { sid = rand(); sessionStorage.setItem('binc_sid', sid); } } catch (e) { sid = rand(); }

  var page = (location.pathname.replace(/^\/+|\.html$/g, '') || 'home');
  var pending = 0, lastTick = Date.now(), lastActive = Date.now(), errCount = 0, seen = {};

  function token() { try { return window.PortalSession ? PortalSession.get('klantToken') : sessionStorage.getItem('klantToken'); } catch (e) { return null; } }
  function send(type, extra) {
    var body = { sid: sid, type: type, page: page, title: document.title, lang: navigator.language, width: window.innerWidth };
    for (var k in extra) body[k] = extra[k];
    var h = { 'Content-Type': 'application/json' }, t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    try { fetch(API + '/api/track', { method: 'POST', headers: h, body: JSON.stringify(body), keepalive: true }).catch(function () {}); } catch (e) {}
  }
  function flush() { if (pending > 0) { send('ping', { visibleMs: pending }); pending = 0; } else send('ping', { visibleMs: 0 }); }

  ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastActive = Date.now(); }, { passive: true });
  });
  // elke seconde: tel kijktijd alleen als tab zichtbaar is én er de laatste minuut iets gebeurde
  setInterval(function () {
    var now = Date.now(), dt = now - lastTick; lastTick = now;
    if (document.visibilityState === 'visible' && now - lastActive < 60000) pending += Math.min(dt, 2000);
  }, 1000);
  setInterval(flush, 30000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  function reportError(message, where) {
    message = String(message || '').slice(0, 300);
    if (!message || seen[message] || errCount >= 5) return;
    seen[message] = 1; errCount++;
    send('error', { message: message, where: String(where || '').slice(0, 200) });
  }
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window) return; // laadfouten van plaatjes e.d. negeren
    reportError(e.message, (e.filename || '').split('/').pop() + ':' + (e.lineno || 0) + ':' + (e.colno || 0));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; reportError('Promise: ' + (r && r.message || r), r && r.stack ? String(r.stack).split('\n')[1] : '');
  });

  window.PortalTrack = {
    // SPA-weergave wisselen (bv. klantportaal bestellen ↔ bestellingen)
    setPage: function (name) { if (name === page) return; page = name; send('page', { referrer: '' }); },
    cart: function (count, total) { send('cart', { count: count, total: total }); },
    error: reportError
  };

  send('page', { referrer: document.referrer ? new URL(document.referrer).hostname : '' });
})();
