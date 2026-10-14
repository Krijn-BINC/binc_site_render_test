/* portal-session.js — gedeelde inlogsessie voor het klantportaal.
 *  - Token, klantgegevens en winkelmandje staan in localStorage, dus ook een tweede tabblad is meteen ingelogd.
 *  - Uitloggen in het ene tabblad logt alle tabbladen uit; inloggen laat een wachtend inlogtabblad doorsturen.
 *  - Na 30 minuten zonder activiteit (in welk tabblad dan ook) volgt automatisch uitloggen,
 *    5 minuten van tevoren met een melding rechtsonder.
 *  - "Inloggen als klant" door een admin blijft per tabblad (sessionStorage) en heeft geen inactiviteitstimer.
 */
(function () {
  'use strict';
  if (window.PortalSession) return;

  var IDLE_MS = 30 * 60 * 1000, WARN_MS = 5 * 60 * 1000;
  var TOKEN_KEY = 'klantToken', ACTIVE_KEY = 'klantActive', IMP_KEY = 'klantImp';
  var OWN = ['klantToken', 'klantData', 'klantCart', 'portalOrderRequest'];
  var LOGIN = 'inloggen.html', PORTAL = 'klantportaal.html';

  function ss(fn) { try { return fn(sessionStorage); } catch (e) { return null; } }
  function ls(fn) { try { return fn(localStorage); } catch (e) { return null; } }
  function imp() { return ss(function (s) { return s.getItem(IMP_KEY) === '1'; }) === true; }
  function store(fn) { return imp() ? ss(fn) : ls(fn); }

  var P = window.PortalSession = {
    get: function (k) { return store(function (s) { return s.getItem(k); }); },
    set: function (k, v) { store(function (s) { s.setItem(k, v); }); },
    remove: function (k) { store(function (s) { s.removeItem(k); }); },
    /* Admin opent het portaal als klant: alleen in dit tabblad, raakt een echte klantsessie niet. */
    startImpersonation: function () { ss(function (s) { s.clear(); s.setItem(IMP_KEY, '1'); }); },
    isImpersonated: imp,
    /* Na een geslaagde login: token + gegevens opslaan en de inactiviteitsklok starten. */
    login: function (token, klant) {
      ss(function (s) { s.removeItem(IMP_KEY); });
      ls(function (s) { s.setItem(TOKEN_KEY, token); s.setItem('klantData', JSON.stringify(klant || {})); s.setItem(ACTIVE_KEY, String(Date.now())); });
    },
    clear: function () {
      OWN.forEach(function (k) { ls(function (s) { s.removeItem(k); }); ss(function (s) { s.removeItem(k); }); });
      ls(function (s) { s.removeItem(ACTIVE_KEY); });
      ss(function (s) { s.removeItem(IMP_KEY); });
    },
    logout: function () { P.clear(); location.replace(LOGIN); },
    touch: function () { if (!imp()) ls(function (s) { s.setItem(ACTIVE_KEY, String(Date.now())); }); },

    /* Op de portaalpagina: inactiviteit bewaken en meelopen met uitloggen in een ander tabblad. */
    watchPortal: function () {
      if (imp()) return;
      var last = Number(ls(function (s) { return s.getItem(ACTIVE_KEY); })) || 0;
      if (Date.now() - last >= IDLE_MS) { P.logout(); return; }
      P.touch();
      window.addEventListener('storage', function (e) {
        if (e.key === TOKEN_KEY && !e.newValue) location.replace(LOGIN);
      });
      var lastWrite = 0;
      function activity() { var n = Date.now(); if (n - lastWrite > 5000) { lastWrite = n; P.touch(); } }
      ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (ev) { window.addEventListener(ev, activity, { passive: true, capture: true }); });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
      var box = null, txt = null;
      function lang() { return ls(function (s) { return s.getItem('binc_lang'); }) === 'en' ? 'en' : 'nl'; }
      function build() {
        box = document.createElement('div');
        box.setAttribute('role', 'alert');
        box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483000;max-width:320px;background:#16161a;color:#f2f2f2;border:1px solid #c0392b;border-radius:6px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px/1.45 system-ui,sans-serif;display:none';
        txt = document.createElement('div');
        var b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'margin-top:10px;padding:7px 14px;background:#c0392b;color:#fff;border:0;border-radius:3px;font:600 13px system-ui,sans-serif;cursor:pointer';
        b.addEventListener('click', function () { P.touch(); tick(); });
        b.dataset.btn = '1';
        box.append(txt, b);
        document.body.appendChild(box);
      }
      function tick() {
        var idle = Date.now() - (Number(ls(function (s) { return s.getItem(ACTIVE_KEY); })) || Date.now());
        if (idle >= IDLE_MS) { P.logout(); return; }
        if (idle >= IDLE_MS - WARN_MS) {
          if (!box) build();
          var left = Math.ceil((IDLE_MS - idle) / 1000), m = Math.floor(left / 60), s = left % 60;
          var nl = lang() === 'nl', mins = Math.floor(idle / 60000);
          txt.textContent = nl
            ? 'Je bent ' + mins + ' minuten inactief. Je wordt over ' + m + ':' + (s < 10 ? '0' : '') + s + ' automatisch uitgelogd.'
            : "You've been inactive for " + mins + ' minutes. You will be logged out automatically in ' + m + ':' + (s < 10 ? '0' : '') + s + '.';
          box.querySelector('[data-btn]').textContent = nl ? 'Ingelogd blijven' : 'Stay logged in';
          box.style.display = 'block';
        } else if (box) box.style.display = 'none';
      }
      setInterval(tick, 1000);
      tick();
    },

    /* Op de inlogpagina: zodra een ander tabblad inlogt, hier ook doorgaan. */
    watchLogin: function () {
      window.addEventListener('storage', function (e) {
        if (e.key === TOKEN_KEY && e.newValue) location.replace(PORTAL);
      });
    }
  };
})();
