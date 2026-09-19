/* Backpacker Directory — shared site behaviour.
   Everything here is progressive enhancement: if this file fails to load, each page still works as plain HTML.
   Sections: utils · icons · toast/modal · submissions · ticker · dock · share · wall · forms · events · blog · effects · page-swap · init */
(function(){
'use strict';
var CFG = window.BD_CONFIG || {};
var doc = document;
var html = doc.documentElement;

/* ------------------------------------------------------------------ utils */
function q(s, r){ return (r || doc).querySelector(s); }
function qa(s, r){ return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
function enc(s){ return encodeURIComponent(s); }
function h(tag, attrs, kids){
  var e = doc.createElement(tag);
  if(attrs){ for(var k in attrs){ if(!Object.prototype.hasOwnProperty.call(attrs,k)) continue;
    var v = attrs[k];
    if(v === null || v === undefined || v === false) continue;
    if(k === 'class') e.className = v;
    else if(k === 'text') e.textContent = v;
    else if(k === 'html') e.innerHTML = v;   /* only ever used with our own static strings */
    else if(k.slice(0,2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  } }
  (kids || []).forEach(function(c){ if(c === null || c === undefined) return; e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
  return e;
}
var store = {
  get: function(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set: function(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  sget: function(k){ try{ return JSON.parse(sessionStorage.getItem(k)); }catch(e){ return null; } },
  sset: function(k,v){ try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
function fetchJSON(url, ms){
  var ctl = ('AbortController' in window) ? new AbortController() : null;
  var timer = ctl ? setTimeout(function(){ ctl.abort(); }, ms || 7000) : null;
  return fetch(url, ctl ? {signal: ctl.signal} : {}).then(function(r){
    if(timer) clearTimeout(timer);
    if(!r.ok) throw new Error('http ' + r.status);
    return r.json();
  });
}
function cached(key, ttlMs, loader){
  var c = store.get(key);
  if(c && c.t && (Date.now() - c.t) < ttlMs && c.v) return Promise.resolve(c.v);
  return loader().then(function(v){ store.set(key, {t: Date.now(), v: v}); return v; })
    .catch(function(){ return (c && c.v) || null; });
}
function isHttpUrl(u){ return typeof u === 'string' && /^https?:\/\//i.test(u); }
function clip(s, n){ s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function pageUrl(){ return location.origin + location.pathname; }
var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
var loadedAt = Date.now();

/* ------------------------------------------------------------------ icons */
function ico(name){
  var body = (window.BD_UI || {})[name];
  if(!body) return '';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
}
function brandSvg(id, textFallback){
  var b = (window.BD_BRANDS || {})[id];
  if(b) return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + b.p + '"/></svg>';
  if(textFallback) return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><text x="12" y="' + (textFallback.length > 1 ? 15.5 : 17) + '" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="' + (textFallback.length > 1 ? 10.5 : 15) + '" fill="currentColor">' + textFallback + '</text></svg>';
  return '';
}
function iconSpan(name, anim){ return h('span', {class: 'bd-ico', 'data-anim': anim || 'wiggle', 'aria-hidden': 'true', html: ico(name)}); }

/* ------------------------------------------------------------------ toast + modal */
var toastEl, toastTimer;
function toast(msg){
  if(!toastEl){ toastEl = h('div', {id: 'bd-toast', 'data-bd-keep': '', role: 'status', 'aria-live': 'polite'}); doc.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2600);
}
var modalEl, modalReturn;
function openModal(node, onClose){
  closeModal();
  modalReturn = doc.activeElement;
  var x = h('button', {class: 'bd-modal-x', type: 'button', 'aria-label': 'Close', html: ico('x')});
  var card = h('div', {class: 'bd-modal-card', role: 'dialog', 'aria-modal': 'true'}, [x, node]);
  modalEl = h('div', {class: 'bd-modal open', 'data-bd-keep': ''}, [card]);
  modalEl._onClose = onClose;
  x.addEventListener('click', closeModal);
  modalEl.addEventListener('click', function(e){ if(e.target === modalEl) closeModal(); });
  doc.body.appendChild(modalEl);
  x.focus();
}
function closeModal(){
  if(!modalEl) return;
  var cb = modalEl._onClose; modalEl.remove(); modalEl = null;
  if(cb) try{ cb(); }catch(e){}
  if(modalReturn && modalReturn.focus) try{ modalReturn.focus(); }catch(e){}
}
doc.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeModal(); closeSharePanels(); } });

function copyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).then(function(){ return true; }, function(){ return legacyCopy(text); });
  }
  return Promise.resolve(legacyCopy(text));
}
function legacyCopy(text){
  try{ var t = h('textarea', {style: 'position:fixed;opacity:0;top:0;left:0'}); t.value = text; doc.body.appendChild(t); t.select(); var ok = doc.execCommand('copy'); t.remove(); return ok; }catch(e){ return false; }
}

/* ------------------------------------------------------------------ submissions (moderated) */
/* Anything the public sends goes to a private Google Sheet. Rows are hidden until YOU tick "Approved";
   only approved rows (and only the public columns) are ever sent back to the site. */
function submitEntry(type, data){
  if(!CFG.submitUrl) return Promise.resolve({ok: false, reason: 'off'});
  var p = new URLSearchParams();
  p.append('type', type);
  Object.keys(data).forEach(function(k){ p.append(k, data[k]); });
  p.append('page', location.pathname);
  p.append('elapsed', String(Date.now() - loadedAt));
  return fetch(CFG.submitUrl, {method: 'POST', mode: 'no-cors', body: p})
    .then(function(){ return {ok: true}; }, function(){ return {ok: false, reason: 'net'}; });
}
function listApproved(type, extra){
  if(!CFG.submitUrl) return Promise.resolve([]);
  var key = 'bd.list.' + type + (extra || '');
  return cached(key, 5 * 60 * 1000, function(){
    var u = CFG.submitUrl + (CFG.submitUrl.indexOf('?') < 0 ? '?' : '&') + 'action=list&type=' + enc(type) + (extra || '');
    return fetchJSON(u, 9000).then(function(j){ return (j && j.items) || []; });
  }).then(function(v){ return v || []; });
}

/* ------------------------------------------------------------------ ticker (information only) */
var TICKER_KEY = 'bd.ticker.v1';
var FAVOURED = ['TH','VN','KH','LA','ID','MY','PH','MM','IN','NP','LK','JP','KR','CN','TW','MX','PE','CO','BR','PT','ES','GR','TR','MA','EG','ZA','AU','NZ','US','GB','FR','IT','DE'];
function regionName(cc){ try{ return new Intl.DisplayNames(['en'], {type: 'region'}).of(cc) || cc; }catch(e){ return cc; } }
function fmtDay(d){ try{ return d.toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'}); }catch(e){ return d.toDateString(); } }
function ago(ms){
  var m = Math.round((Date.now() - ms) / 60000);
  if(m < 2) return 'just now'; if(m < 90) return m + ' min ago';
  var hrs = Math.round(m / 60); if(hrs < 36) return hrs + 'h ago';
  return Math.round(hrs / 24) + ' days ago';
}
function nextFullMoon(from){
  var syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  var k = Math.ceil(((from.getTime() / 86400000) - ref) / syn - 0.5);
  return new Date((ref + (k + 0.5) * syn) * 86400000);
}
function isoDay(d){ return d.toISOString().slice(0, 10); }

function feedCommunity(){
  return fetchJSON(CFG.communityNewsUrl || 'assets/data/community-news.json', 5000).then(function(j){
    var now = Date.now();
    return ((j && j.items) || []).filter(function(it){ return it && it.text && (!it.expires || new Date(it.expires).getTime() > now); })
      .map(function(it){ return {e: it.icon || '🎒', t: String(it.text), k: 'good'}; });
  }).catch(function(){ return []; });
}
function feedMoon(){
  var fm = nextFullMoon(new Date());
  return [{e: '🌕', t: 'Next full moon around ' + fmtDay(fm) + ' — full-moon party season for beach travellers', k: ''}];
}
function feedHolidays(){
  return fetchJSON('https://date.nager.at/api/v3/NextPublicHolidaysWorldwide', 7000).then(function(list){
    var seen = {}, out = [];
    list.filter(function(x){ return x.global !== false; }).sort(function(a, b){
      var fa = FAVOURED.indexOf(a.countryCode), fb = FAVOURED.indexOf(b.countryCode);
      fa = fa < 0 ? 99 : fa; fb = fb < 0 ? 99 : fb;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : fa - fb;
    }).forEach(function(x){
      var key = x.countryCode + x.name; if(seen[key] || out.length >= 7) return; seen[key] = 1;
      var day = new Date(x.date + 'T12:00:00');
      out.push({e: '🎉', t: regionName(x.countryCode) + ': ' + x.name + ' · ' + fmtDay(day) + ' (expect closures)', k: ''});
    });
    return out;
  }).catch(function(){ return []; });
}
function feedQuakes(){
  return fetchJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson', 8000).then(function(j){
    return (j.features || []).sort(function(a, b){ return b.properties.time - a.properties.time; }).slice(0, 4).map(function(f){
      var p = f.properties, mag = p.mag ? p.mag.toFixed(1) : '?';
      return {e: '🌍', t: 'M' + mag + ' earthquake · ' + clip(p.place || 'unknown area', 60) + ' · ' + ago(p.time), k: p.mag >= 6.5 ? 'warn' : ''};
    });
  }).catch(function(){ return []; });
}
var GDACS_EMOJI = {EQ: '🌍', TC: '🌀', FL: '🌊', VO: '🌋', WF: '🔥', DR: '☀️'};
var GDACS_NAME = {EQ: 'earthquake', TC: 'cyclone', FL: 'flood', VO: 'volcano', WF: 'wildfire', DR: 'drought'};
function feedGdacs(){
  var to = new Date(), from = new Date(Date.now() - 10 * 86400000);
  var u = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Orange;Red&eventlist=EQ;TC;FL;VO;WF&fromdate=' + isoDay(from) + '&todate=' + isoDay(to);
  return fetchJSON(u, 9000).then(function(j){
    var seen = {};
    return (j.features || []).map(function(f){ return f.properties || {}; })
      .filter(function(p){ return String(p.iscurrent) === 'true' && p.eventtype !== 'EQ'; })   /* quakes already covered by USGS */
      .sort(function(a, b){ return (b.alertlevel === 'Red') - (a.alertlevel === 'Red'); })
      .filter(function(p){ var k = p.name; if(seen[k]) return false; seen[k] = 1; return true; })
      .slice(0, 4).map(function(p){
        return {e: GDACS_EMOJI[p.eventtype] || '⚠️', t: (p.alertlevel || 'Orange') + ' alert · ' + clip(p.name || (GDACS_NAME[p.eventtype] + ' event'), 70), k: 'warn'};
      });
  }).catch(function(){ return []; });
}
function feedStorms(){
  return fetchJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=4&category=volcanoes,severeStorms&limit=6', 8000).then(function(j){
    return (j.events || []).slice(0, 3).map(function(ev){
      var cat = ev.categories && ev.categories[0] && ev.categories[0].id;
      return {e: cat === 'volcanoes' ? '🌋' : '🌀', t: clip(ev.title, 60) + ' · active now', k: 'warn'};
    });
  }).catch(function(){ return []; });
}
var FCDO_STATUS = {
  avoid_all_travel_to_whole_country: 'advises against ALL travel',
  avoid_all_but_essential_travel_to_whole_country: 'advises against all but essential travel',
  avoid_all_travel_to_parts: 'advises against all travel to parts of the country',
  avoid_all_but_essential_travel_to_parts: 'advises against all but essential travel to parts of the country'
};
function feedAdvisories(){
  var u = 'https://www.gov.uk/api/search.json?filter_format=travel_advice&order=-public_timestamp&count=6&fields=title&fields=link&fields=public_timestamp';
  return fetchJSON(u, 8000).then(function(j){
    var rows = (j.results || []).slice(0, 5);
    return Promise.all(rows.map(function(r){
      var name = String(r.title || '').replace(/ travel advice$/i, '');
      var when = r.public_timestamp ? new Date(r.public_timestamp) : null;
      var day = when ? fmtDay(when) : '';
      return fetchJSON('https://www.gov.uk/api/content' + r.link, 8000).then(function(c){
        var st = (c.details && c.details.alert_status) || [];
        var txt = st.length ? (FCDO_STATUS[st[0]] || 'advice updated') : 'advice updated';
        return {e: '⚠️', t: 'UK FCDO travel advice · ' + name + ': ' + txt + (day ? ' (updated ' + day + ')' : ''), k: st.length ? 'warn' : ''};
      }).catch(function(){ return {e: '⚠️', t: 'UK FCDO travel advice updated for ' + name + (day ? ' (' + day + ')' : ''), k: ''}; });
    }));
  }).catch(function(){ return []; });
}
function feedFreeEvents(){
  return listApproved('event').then(function(list){
    var today = isoDay(new Date());
    return list.filter(function(ev){ return /^free/i.test(ev.free || '') && ev.date >= today; })
      .sort(function(a, b){ return a.date < b.date ? -1 : 1; }).slice(0, 5).map(function(ev){
        var d = new Date(ev.date + 'T12:00:00');
        return {e: '🎟️', t: 'Free event · ' + clip(ev.name, 50) + ' · ' + clip(ev.city, 30) + ', ' + clip(ev.country, 24) + ' · ' + fmtDay(d), k: 'good'};
      });
  }).catch(function(){ return []; });
}

var tickerEl, trackEl, tickerItems = [];
function renderTicker(){
  if(!tickerEl || !tickerItems.length) return;
  function build(hide){
    return tickerItems.map(function(it){
      return h('span', {class: 'bd-tk-item' + (it.k ? ' ' + it.k : ''), 'aria-hidden': hide ? 'true' : null}, [h('span', {text: it.e}), h('span', {text: it.t})]);
    });
  }
  function fill(reps){
    trackEl.textContent = '';
    for(var copy = 0; copy < reps * 2; copy++) build(copy !== 0).forEach(function(n){ trackEl.appendChild(n); });
  }
  fill(1);
  var one = trackEl.scrollWidth / 2, avail = trackEl.parentNode.clientWidth || window.innerWidth;
  var reps = Math.max(1, Math.ceil(avail / Math.max(one, 1)));
  if(reps > 1) fill(reps);
  var half = trackEl.scrollWidth / 2;
  if(half > 0) tickerEl.style.setProperty('--bd-tk-dur', Math.max(45, Math.round(half / 55)) + 's');
}
function buildTicker(){
  if(q('#bd-ticker')) return;
  trackEl = h('div', {class: 'bd-track'});
  tickerEl = h('div', {id: 'bd-ticker', 'data-bd-keep': '', role: 'region', 'aria-label': 'Community news and world watch — information only'}, [
    h('div', {class: 'bd-live'}, [h('i'), 'Live']),
    h('div', {class: 'bd-track-wrap'}, [trackEl]),
    h('div', {class: 'bd-tk-info', text: 'Info only'})
  ]);
  doc.body.insertBefore(tickerEl, doc.body.firstChild);
  tickerItems = feedMoon();
  renderTicker();
  Promise.all([feedCommunity(), feedFreeEvents(), cached(TICKER_KEY, 30 * 60 * 1000, function(){
    return Promise.all([feedHolidays(), feedQuakes(), feedGdacs(), feedStorms(), feedAdvisories()]).then(function(parts){
      return [].concat(parts[0], parts[1], parts[2], parts[3], parts[4]);
    });
  })]).then(function(res){
    var community = res[0] || [], free = res[1] || [], world = res[2] || [];
    var holidays = world.filter(function(i){ return i.e === '🎉'; });
    var rest = world.filter(function(i){ return i.e !== '🎉'; });
    tickerItems = [].concat(community, free, holidays.slice(0, 5), feedMoon(), rest);
    if(!tickerItems.length) tickerItems = feedMoon();
    renderTicker();
  });
}

/* ------------------------------------------------------------------ video dock */
var dock = {el: null, player: null, ready: false, muted: true, collapsed: false, loading: false, saveTimer: null};
function dockPref(){ var v = store.get('bd.dock'); return v || {}; }
function dockSetOpenClass(){ html.classList.toggle('bd-dock-open', !!dock.el && !dock.collapsed); }
function buildDock(){
  if(q('#bd-dock')) return;
  var pref = dockPref();
  dock.collapsed = pref.collapsed !== undefined ? !!pref.collapsed : (window.innerWidth < 700);
  var title = h('span', {text: 'The journey — live'});
  var btnPrev = h('button', {type: 'button', class: 'bd-when-open', 'aria-label': 'Previous video', title: 'Previous video', html: ico('skip-back')});
  var btnNext = h('button', {type: 'button', class: 'bd-when-open', 'aria-label': 'Next video', title: 'Next video', html: ico('skip-forward')});
  var btnMute = h('button', {type: 'button', class: 'bd-when-open', 'aria-label': 'Unmute', title: 'Unmute', html: ico('volume-x')});
  var btnBig = h('button', {type: 'button', class: 'bd-when-open', 'aria-label': 'Enlarge player', title: 'Enlarge player', html: ico('maximize-2')});
  var btnMin = h('button', {type: 'button', 'aria-label': dock.collapsed ? 'Open player' : 'Minimise player', title: dock.collapsed ? 'Open player' : 'Minimise player', html: ico(dock.collapsed ? 'plus' : 'minus')});
  var holder = h('div', {id: 'bd-yt'});
  var msg = h('div', {class: 'bd-player-msg'}, [h('div', {}, [
    'The video can’t load here (some countries and networks block YouTube). ',
    h('a', {href: CFG.ytChannelUrl || 'https://www.youtube.com', target: '_blank', rel: 'noopener', text: 'Watch on YouTube'})
  ])]);
  var player = h('div', {class: 'bd-player'}, [holder, msg]);
  var sub = h('a', {class: 'bd-sub-btn big', href: CFG.ytSubscribeUrl || CFG.ytChannelUrl, target: '_blank', rel: 'noopener'}, [iconSpan('play', 'pulse'), 'Subscribe to TT on YouTube']);
  sub.classList.add('bd-has-ico');
  var foot = h('div', {class: 'bd-dock-foot'}, [sub, h('p', {class: 'bd-dock-note', text: 'Keeps playing while you browse the site.'})]);
  var card = h('div', {class: 'bd-dock-card'}, [
    h('div', {class: 'bd-dock-bar'}, [
      h('div', {class: 'bd-dock-title'}, [h('span', {class: 'bd-ico', html: ico('play')}), title]),
      h('div', {class: 'bd-dock-ctrls'}, [btnPrev, btnNext, btnMute, btnBig, btnMin])
    ]),
    h('div', {class: 'bd-dock-body'}, [player, foot])
  ]);
  dock.el = h('aside', {id: 'bd-dock', 'data-bd-keep': '', 'aria-label': 'Video player: TT travel videos'}, [card]);
  dock.el.classList.toggle('collapsed', dock.collapsed);
  doc.body.appendChild(dock.el);
  dockSetOpenClass();
  dock.title = title; dock.btnMute = btnMute; dock.playerBox = player;

  btnMin.addEventListener('click', function(){
    dock.collapsed = !dock.collapsed;
    dock.el.classList.toggle('collapsed', dock.collapsed);
    btnMin.innerHTML = ico(dock.collapsed ? 'plus' : 'minus');
    btnMin.setAttribute('aria-label', dock.collapsed ? 'Open player' : 'Minimise player'); btnMin.title = dock.collapsed ? 'Open player' : 'Minimise player';
    var p = dockPref(); p.collapsed = dock.collapsed; store.set('bd.dock', p);
    dockSetOpenClass();
    if(!dock.collapsed) startPlayer();
  });
  btnBig.addEventListener('click', function(){
    var on = dock.el.classList.toggle('expanded');
    btnBig.innerHTML = ico(on ? 'minimize-2' : 'maximize-2');
    btnBig.setAttribute('aria-label', on ? 'Shrink player' : 'Enlarge player');
  });
  btnPrev.addEventListener('click', function(){ if(dock.player && dock.ready) dock.player.previousVideo(); });
  btnNext.addEventListener('click', function(){ if(dock.player && dock.ready) dock.player.nextVideo(); });
  btnMute.addEventListener('click', function(){
    if(!dock.player || !dock.ready) return;
    if(dock.player.isMuted()){ dock.player.unMute(); dock.player.setVolume(90); dock.muted = false; } else { dock.player.mute(); dock.muted = true; }
    syncMuteBtn();
  });
  window.addEventListener('pagehide', saveDockState);
  if(!dock.collapsed) startPlayer();
}
function syncMuteBtn(){
  if(!dock.btnMute) return;
  dock.btnMute.innerHTML = ico(dock.muted ? 'volume-x' : 'volume-2');
  dock.btnMute.setAttribute('aria-label', dock.muted ? 'Unmute' : 'Mute');
  dock.btnMute.title = dock.muted ? 'Unmute' : 'Mute';
}
function saveDockState(){
  if(!dock.player || !dock.ready) return;
  try{ store.sset('bd.yt', {i: dock.player.getPlaylistIndex(), t: Math.floor(dock.player.getCurrentTime()), at: Date.now()}); }catch(e){}
}
function dockFail(){ if(dock.playerBox) dock.playerBox.classList.add('failed'); }
function startPlayer(){
  if(dock.player || dock.loading || !dock.el) return;
  dock.loading = true;
  function make(){
    try{
      var saved = store.sget('bd.yt');
      dock.player = new YT.Player('bd-yt', {
        host: 'https://www.youtube-nocookie.com',
        playerVars: {listType: 'playlist', list: CFG.ytPlaylistId, autoplay: 1, mute: 1, controls: 1, playsinline: 1, rel: 0, modestbranding: 1, loop: 1, origin: location.origin},
        events: {
          onReady: function(){
            dock.ready = true;
            if(saved && typeof saved.i === 'number' && (Date.now() - saved.at) < 6 * 3600 * 1000){
              try{ dock.player.loadPlaylist({listType: 'playlist', list: CFG.ytPlaylistId, index: saved.i, startSeconds: saved.t || 0}); }catch(e){}
            }
            try{ dock.player.mute(); }catch(e){}
            syncMuteBtn();
            dock.saveTimer = setInterval(saveDockState, 3000);
          },
          onStateChange: function(){
            try{ var d = dock.player.getVideoData(); if(d && d.title){ dock.title.textContent = clip(d.title, 42); dock.title.parentNode.title = d.title; } }catch(e){}
          },
          onError: function(){ /* skip unplayable videos quietly */ try{ dock.player.nextVideo(); }catch(e){} }
        }
      });
    }catch(e){ dockFail(); }
  }
  if(window.YT && window.YT.Player){ make(); return; }
  window.onYouTubeIframeAPIReady = make;
  var s = h('script', {src: 'https://www.youtube.com/iframe_api', async: true});
  s.onerror = dockFail;
  doc.head.appendChild(s);
  setTimeout(function(){ if(!dock.player) dockFail(); }, 9000);
}
function pauseDock(){ try{ if(dock.player && dock.ready) dock.player.pauseVideo(); }catch(e){} }

/* ------------------------------------------------------------------ share */
var openPanels = [];
function closeSharePanels(){
  openPanels.forEach(function(p){ p.panel.classList.remove('open'); p.btn.setAttribute('aria-expanded', 'false'); });
  openPanels = [];
}
doc.addEventListener('click', function(e){
  if(!openPanels.length) return;
  var inside = openPanels.some(function(p){ return p.wrap.contains(e.target); });
  if(!inside) closeSharePanels();
});
function copyAndOpen(text, msg, openUrl){
  copyText(text).then(function(){ toast(msg); if(openUrl) setTimeout(function(){ window.open(openUrl, '_blank', 'noopener'); }, 500); });
}
function qrModal(appName, url, hint){
  var box = h('div', {class: 'bd-qr'});
  var node = h('div', {}, [h('h3', {text: 'Share on ' + appName}), box, h('p', {text: hint}), h('p', {style: 'font-size:.75rem;opacity:.7', text: url})]);
  openModal(node);
  function draw(){
    try{ var qr = window.qrcode(0, 'M'); qr.addData(url); qr.make(); box.innerHTML = qr.createSvgTag({scalable: true, margin: 0}); }
    catch(e){ box.textContent = 'Could not draw the code — use Copy link instead.'; }
  }
  if(window.qrcode) draw(); else { var s = h('script', {src: 'assets/qrcode.js'}); s.onload = draw; s.onerror = function(){ box.textContent = 'Could not load the QR code.'; }; doc.head.appendChild(s); }
}
function shareTargets(url, title){
  var u = enc(url), t = enc(title), ut = enc(title + ' ' + url);
  var text = title + ' — ' + url;
  return {
    whatsapp:  {name: 'WhatsApp', c: '#25D366', do: {href: 'https://wa.me/?text=' + ut}},
    facebook:  {name: 'Facebook', c: '#0866FF', do: {href: 'https://www.facebook.com/sharer/sharer.php?u=' + u}},
    x:         {name: 'X (Twitter)', c: '#000000', do: {href: 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t}},
    telegram:  {name: 'Telegram', c: '#26A5E4', do: {href: 'https://t.me/share/url?url=' + u + '&text=' + t}},
    reddit:    {name: 'Reddit', c: '#FF4500', do: {href: 'https://www.reddit.com/submit?url=' + u + '&title=' + t}},
    linkedin:  {name: 'LinkedIn', c: '#0A66C2', txt: 'in', do: {href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + u}},
    email:     {name: 'Email', c: '#5b4a2b', stroke: 'mail', do: {href: 'mailto:?subject=' + t + '&body=' + u, same: true}},
    copy:      {name: 'Copy link', c: '#2e7d5b', stroke: 'link', do: {copy: url, msg: 'Link copied ✓'}},
    messenger: {name: 'Messenger', c: '#0866FF', do: isMobileUA ? {href: 'fb-messenger://share/?link=' + u, same: true} : {copy: url, msg: 'Link copied — paste it into Messenger', open: 'https://www.messenger.com/'}},
    pinterest: {name: 'Pinterest', c: '#BD081C', do: {href: 'https://pinterest.com/pin/create/button/?url=' + u + '&description=' + t + '&media=' + enc((CFG.siteUrl || location.origin) + '/assets/backpacker-logo.png')}},
    tumblr:    {name: 'Tumblr', c: '#36465D', do: {href: 'https://www.tumblr.com/widgets/share/tool?canonicalUrl=' + u + '&title=' + t}},
    threads:   {name: 'Threads', c: '#000000', do: {href: 'https://www.threads.net/intent/post?text=' + ut}},
    bluesky:   {name: 'Bluesky', c: '#1185FE', do: {href: 'https://bsky.app/intent/compose?text=' + ut}},
    mastodon:  {name: 'Mastodon', c: '#6364FF', do: {href: 'https://mastodonshare.com/?text=' + t + '&url=' + u}},
    snapchat:  {name: 'Snapchat', c: '#FFFC00', g: '#000000', do: {href: 'https://www.snapchat.com/scan?attachmentUrl=' + u}},
    sms:       {name: 'SMS / iMessage', c: '#34c759', stroke: 'message-square', do: {href: 'sms:?&body=' + ut, same: true}},
    wechat:    {name: 'WeChat', c: '#07C160', do: {qr: 'WeChat', hint: 'Open WeChat, tap the + (or Discover) → Scan, and scan this code. Then use “…” to send it to friends or Moments.'}},
    weibo:     {name: 'Weibo', c: '#E6162D', do: {href: 'https://service.weibo.com/share/share.php?url=' + u + '&title=' + t}},
    qq:        {name: 'QQ', c: '#12B7F5', txt: 'QQ', do: {href: 'https://connect.qq.com/widget/shareqq/index.html?url=' + u + '&title=' + t}},
    qzone:     {name: 'Qzone', c: '#FECE00', g: '#000000', do: {href: 'https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=' + u + '&title=' + t}},
    douban:    {name: 'Douban', c: '#2D963D', do: {href: 'https://www.douban.com/share/service?href=' + u + '&name=' + t}},
    line:      {name: 'LINE', c: '#00B900', do: {href: 'https://social-plugins.line.me/lineit/share?url=' + u}},
    kakaotalk: {name: 'KakaoTalk', c: '#FFCD00', g: '#3C1E1E', do: {copy: url, msg: 'Link copied — paste it into KakaoTalk', open: isMobileUA ? 'kakaotalk://' : null}},
    naver:     {name: 'Naver', c: '#03C75A', do: {href: 'https://share.naver.com/web/shareView?url=' + u + '&title=' + t}},
    zalo:      {name: 'Zalo', c: '#0068FF', do: {copy: url, msg: 'Link copied — paste it into Zalo', open: isMobileUA ? null : 'https://chat.zalo.me/'}},
    viber:     {name: 'Viber', c: '#7360F2', do: {href: 'viber://forward?text=' + ut, same: true}},
    vk:        {name: 'VK', c: '#0077FF', do: {href: 'https://vk.com/share.php?url=' + u + '&title=' + t}},
    ok:        {name: 'Odnoklassniki', c: '#EE8208', do: {href: 'https://connect.ok.ru/offer?url=' + u + '&title=' + t}},
    discord:   {name: 'Discord', c: '#5865F2', do: {copy: text, msg: 'Copied — paste it into any Discord chat', open: 'https://discord.com/app'}}
  };
}
function shareGlyph(id, t){
  if(t.stroke) return ico(t.stroke);
  return brandSvg(id, t.txt);
}
function runShare(id, t){
  var d = t.do;
  if(d.qr){ qrModal(d.qr, pageUrl(), d.hint); return; }
  if(d.copy){ copyAndOpen(d.copy, d.msg, d.open); return; }
  if(d.href){ if(d.same) window.location.href = d.href; else window.open(d.href, '_blank', 'noopener,noreferrer,width=640,height=560'); }
}
function makeSBtn(id, t){
  var b = h('button', {type: 'button', class: 'bd-sbtn' + (t.stroke ? ' stroke' : ''), 'aria-label': 'Share via ' + t.name, style: '--c:' + t.c + ';' + (t.g ? '--g:' + t.g : ''), html: shareGlyph(id, t)});
  b.appendChild(h('span', {class: 'bd-tip', role: 'presentation', text: t.name}));
  b.addEventListener('click', function(){ runShare(id, t); });
  return b;
}
function buildShare(slot){
  if(slot.dataset.bdDone) return; slot.dataset.bdDone = '1';
  slot.textContent = '';
  var url = slot.getAttribute('data-url') || pageUrl();
  var title = slot.getAttribute('data-title') || doc.title;
  var T = shareTargets(url, title);
  var primary = ['whatsapp', 'facebook', 'x', 'telegram', 'reddit', 'linkedin', 'email', 'copy'];
  var row = h('div', {class: 'bd-share-row'});
  if(navigator.share){
    var nat = h('button', {type: 'button', class: 'bd-sbtn stroke', 'aria-label': 'Share using your phone’s apps', style: '--c:#c65d2e', html: ico('share-2')});
    nat.appendChild(h('span', {class: 'bd-tip', role: 'presentation', text: 'Your apps…'}));
    nat.addEventListener('click', function(){ navigator.share({title: title, url: url}).catch(function(){}); });
    row.appendChild(nat);
  }
  primary.forEach(function(id){ row.appendChild(makeSBtn(id, T[id])); });
  var more = h('button', {type: 'button', class: 'bd-more-btn', 'aria-expanded': 'false', 'aria-haspopup': 'true'}, [h('span', {class: 'bd-ico', html: ico('globe')}), 'More apps', h('span', {class: 'chev', html: ico('chevron-down'), style: 'display:inline-grid'})]);
  more.querySelector('.chev svg').style.cssText = 'width:16px;height:16px;transition:transform .25s';
  var groups = [
    ['Popular worldwide', ['messenger', 'pinterest', 'tumblr', 'threads', 'bluesky', 'mastodon', 'snapchat', 'sms']],
    ['China', ['wechat', 'weibo', 'qq', 'qzone', 'douban']],
    ['Japan · Thailand · Taiwan · Korea', ['line', 'kakaotalk', 'naver']],
    ['Vietnam · Viber countries', ['zalo', 'viber']],
    ['Russia · Ukraine · CIS', ['vk', 'ok']],
    ['Communities', ['discord']]
  ];
  var panel = h('div', {class: 'bd-more-panel', role: 'group', 'aria-label': 'More apps to share with'});
  groups.forEach(function(g){
    panel.appendChild(h('h4', {text: g[0]}));
    var grid = h('div', {class: 'bd-more-grid'});
    g[1].forEach(function(id){
      var t = T[id];
      var sub = '';
      if(id === 'zalo' || id === 'kakaotalk' || id === 'discord' || id === 'messenger') sub = (t.do.copy ? 'copies the link' : 'opens the app');
      if(id === 'wechat') sub = 'shows a QR code';
      var tile = h('button', {type: 'button', class: 'bd-tile'}, [
        h('i', {style: '--c:' + t.c + ';' + (t.g ? '--g:' + t.g : ''), html: shareGlyph(id, t)}),
        h('span', {}, [t.name, sub ? h('small', {text: sub}) : null])
      ]);
      tile.addEventListener('click', function(){ runShare(id, t); if(!t.do.qr) closeSharePanels(); });
      grid.appendChild(tile);
    });
    panel.appendChild(grid);
  });
  if(CFG.discordInvite && isHttpUrl(CFG.discordInvite)){
    var dj = h('a', {class: 'bd-tile', href: CFG.discordInvite, target: '_blank', rel: 'noopener', style: 'text-decoration:none;margin-bottom:.8rem'}, [h('i', {style: '--c:#5865F2', html: brandSvg('discord')}), h('span', {}, ['Join our Discord', h('small', {text: 'the community server'})])]);
    panel.insertBefore(dj, panel.lastChild);
  }
  panel.appendChild(h('p', {class: 'bd-panel-note', text: 'Tip: on a phone, the “Your apps…” button opens your own share sheet with every app you have installed — including Zalo, LINE, KakaoTalk and WeChat.'}));
  row.appendChild(more); row.appendChild(panel);
  more.addEventListener('click', function(e){
    e.stopPropagation();
    var isOpen = panel.classList.contains('open');
    closeSharePanels();
    if(!isOpen){
      var r = more.getBoundingClientRect();
      panel.classList.toggle('up', (window.innerHeight - r.bottom) < 380 && r.top > (window.innerHeight - r.bottom));
      panel.classList.add('open'); more.setAttribute('aria-expanded', 'true');
      openPanels.push({panel: panel, btn: more, wrap: row});
      setTimeout(function(){
        var pr = panel.getBoundingClientRect();
        if(pr.bottom > window.innerHeight - 8) window.scrollBy({top: Math.min(pr.bottom - window.innerHeight + 24, pr.top - 60), behavior: 'smooth'});
        else if(pr.top < 50) window.scrollBy({top: pr.top - 70, behavior: 'smooth'});
      }, 30);
    }
  });
  slot.appendChild(h('span', {class: 'bd-share-label', text: slot.getAttribute('data-label') || 'Share this page'}));
  slot.appendChild(row);
}

/* ------------------------------------------------------------------ travellers' wall (opt-in, moderated) */
var AVATARS = ['🎒', '🧭', '🌴', '🏔️', '🐘', '🍜', '🛵', '⛺', '🌋', '🏄', '🛶', '🦜'];
var AV_BG = ['#fde8c8', '#dff0e6', '#e3ecfa', '#fbe1dc', '#f3e6f7', '#fff3c2'];
function countryList(){
  var out = []; try{ var dn = new Intl.DisplayNames(['en'], {type: 'region'});
    for(var a = 65; a <= 90; a++) for(var b = 65; b <= 90; b++){ var n = dn.of(String.fromCharCode(a, b)); if(n && n.length > 2 && !/^Unknown/i.test(n) && out.indexOf(n) < 0) out.push(n); }
  }catch(e){}
  return out.sort();
}
function openWallForm(){
  var form = h('form', {novalidate: 'novalidate', style: 'text-align:left;display:grid;gap:.6rem'});
  var nick = h('input', {type: 'text', name: 'nickname', maxlength: '24', required: 'required', placeholder: 'Nickname or first name', autocomplete: 'off', style: 'padding:.7em .8em;border:1.5px solid var(--line);border-radius:10px;font:inherit'});
  var dl = h('datalist', {id: 'bd-countries'}); countryList().forEach(function(c){ dl.appendChild(h('option', {value: c})); });
  var country = h('input', {type: 'text', name: 'country', list: 'bd-countries', required: 'required', placeholder: 'Country', autocomplete: 'off', style: 'padding:.7em .8em;border:1.5px solid var(--line);border-radius:10px;font:inherit'});
  var avWrap = h('div', {style: 'display:flex;flex-wrap:wrap;gap:.35rem'});
  AVATARS.forEach(function(a, i){
    var id = 'bd-av' + i;
    var r = h('input', {type: 'radio', name: 'avatar', value: a, id: id, style: 'position:absolute;opacity:0'});
    if(i === 0) r.checked = true;
    var l = h('label', {for: id, style: 'cursor:pointer;width:40px;height:40px;display:grid;place-items:center;border-radius:50%;font-size:1.3rem;border:2px solid var(--line);background:#fff', text: a});
    r.addEventListener('change', function(){ qa('label', avWrap).forEach(function(x){ x.style.borderColor = 'var(--line)'; }); l.style.borderColor = 'var(--accent)'; });
    if(i === 0) l.style.borderColor = 'var(--accent)';
    avWrap.appendChild(r); avWrap.appendChild(l);
  });
  var consent = h('label', {style: 'display:flex;gap:.5rem;font-size:.8rem;line-height:1.4;align-items:flex-start'}, [h('input', {type: 'checkbox', name: 'consent', required: 'required', style: 'margin-top:.2rem'}), 'I’m happy for this nickname, country and emoji to be shown publicly on the site once approved.']);
  var hp = h('input', {type: 'text', name: 'website', class: 'bd-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true'});
  var send = h('button', {type: 'submit', class: 'bd-btn bd-btn-primary bd-has-ico', style: 'padding:.8em 1.2em;border:0;justify-self:start'}, [iconSpan('send', 'fly'), 'Add me to the wall']);
  var msgBox = h('div', {class: 'bd-form-msg'});
  form.appendChild(h('label', {style: 'font-size:.8rem;font-weight:700'}, ['Nickname', nick]));
  form.appendChild(h('label', {style: 'font-size:.8rem;font-weight:700'}, ['Country', country, dl]));
  form.appendChild(h('div', {}, [h('div', {style: 'font-size:.8rem;font-weight:700;margin-bottom:.35rem', text: 'Pick your avatar'}), avWrap]));
  form.appendChild(consent); form.appendChild(hp); form.appendChild(send); form.appendChild(msgBox);
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!form.reportValidity()) return;
    var av = form.querySelector('input[name=avatar]:checked');
    if(hp.value){ showMsg(msgBox, 'ok', 'Thanks!'); return; }
    send.disabled = true;
    submitEntry('wall', {nickname: nick.value.trim().slice(0, 24), country: country.value.trim().slice(0, 60), avatar: av ? av.value : AVATARS[0]}).then(function(res){
      send.disabled = false;
      if(res.ok){ showMsg(msgBox, 'ok', 'Thanks! You’ll appear on the wall once it’s been approved.'); form.reset(); }
      else if(res.reason === 'off'){ showMsg(msgBox, 'off', 'The wall isn’t switched on yet — nothing was sent. Please check back soon.'); }
      else showMsg(msgBox, 'err', 'Couldn’t send that just now — please try again in a minute.');
    });
  });
  openModal(h('div', {}, [h('h3', {text: 'Join the Travellers’ Wall'}), h('p', {text: 'Pick a nickname and an emoji — no photos, no surnames. Every entry is checked before it shows.'}), form]));
}
function showMsg(box, kind, text){ box.className = 'bd-form-msg show ' + kind; box.textContent = text; }
function buildWall(){
  var old = q('#bd-wall'); if(old) old.remove();
  var foot = q('footer'); if(!foot) return;
  if(!CFG.submitUrl) return;   /* nothing to show until submissions are switched on */
  listApproved('wall').then(function(items){
    if(q('#bd-wall')) return;
    var wall = h('div', {id: 'bd-wall', role: 'region', 'aria-label': 'Travellers wall — opt-in community members'});
    var join = h('button', {type: 'button', class: 'bd-wall-join', text: 'Add yourself →'});
    join.addEventListener('click', openWallForm);
    wall.appendChild(h('div', {class: 'bd-wall-head'}, [h('strong', {text: 'The Travellers’ Wall'}), h('span', {text: items.length ? 'People who chose to say hello — from all over the world' : 'Be the first to say hello from wherever you are'}), join]));
    if(items.length){
      var mask = h('div', {class: 'bd-wall-mask'}), track = h('div', {class: 'bd-wall-track'});
      function chips(hide){ return items.slice(0, 60).map(function(it, i){
        return h('span', {class: 'bd-chip', 'aria-hidden': hide ? 'true' : null}, [
          h('span', {class: 'av', style: '--bg:' + AV_BG[i % AV_BG.length], text: AVATARS.indexOf(it.avatar) >= 0 ? it.avatar : '🎒'}),
          h('span', {}, [h('span', {class: 'nm', text: clip(it.nickname, 24)}), h('span', {class: 'ct', text: '\ud83d\udccd ' + clip(it.country, 30)})])
        ]);
      }); }
      chips(false).concat(chips(true)).forEach(function(c){ track.appendChild(c); });
      mask.appendChild(track); wall.appendChild(mask);
      foot.parentNode.insertBefore(wall, foot);
      var half = track.scrollWidth / 2; if(half > 0) wall.style.setProperty('--bd-wl-dur', Math.max(30, Math.round(half / 45)) + 's');
    } else foot.parentNode.insertBefore(wall, foot);
  });
}

/* ------------------------------------------------------------------ forms */
var FORM_OK = {
  event: 'Thanks! Your event is in the review queue — it will appear on the site once it’s approved.',
  business: 'Thanks! Your listing is in the review queue — we’ll check it before it goes live.',
  agent: 'Thanks — you’re on the list! We’ll email you when Agent sign-ups open.',
  subscribe: 'Thanks — you’re on the list! We’ll email you once when the directory opens.'
};
function bindForms(){
  qa('form[data-bd-type]').forEach(function(form){
    if(form.dataset.bdBound) return; form.dataset.bdBound = '1';
    form.removeAttribute('onsubmit');
    form.setAttribute('novalidate', 'novalidate');
    var type = form.getAttribute('data-bd-type');
    var hp = h('input', {type: 'text', name: 'website', class: 'bd-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true'});
    form.appendChild(hp);
    var msg = h('div', {class: 'bd-form-msg', role: 'status', 'aria-live': 'polite'});
    form.appendChild(msg);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(form.reportValidity && !form.reportValidity()) return;
      if(hp.value){ showMsg(msg, 'ok', FORM_OK[type] || 'Thanks!'); return; }
      var data = {};
      qa('input, select, textarea', form).forEach(function(el){
        var k = el.name || el.id; if(!k || k === 'website' || el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
        if((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
        data[k] = String(el.value).slice(0, 2000);
      });
      var btn = q('button[type=submit]', form); if(btn) btn.disabled = true;
      submitEntry(type, data).then(function(res){
        if(btn) btn.disabled = false;
        if(res.ok){ showMsg(msg, 'ok', FORM_OK[type] || 'Thanks!'); form.reset(); qa('input[type=file]', form).forEach(function(f){ f.value = ''; }); }
        else if(res.reason === 'off') showMsg(msg, 'off', 'Submissions aren’t switched on yet — nothing was sent. We’re finishing the review inbox, so please check back very soon.');
        else showMsg(msg, 'err', 'Couldn’t send that just now — please check your connection and try again.');
      });
    });
  });
}

/* ------------------------------------------------------------------ events board */
function pad(n){ return (n < 10 ? '0' : '') + n; }
function calLinkFor(ev){
  var d = String(ev.date || '').replace(/-/g, '');
  if(d.length !== 8) return '#';
  var start, end;
  if(ev.time && /^\d{2}:\d{2}/.test(ev.time)){ var tt = ev.time.replace(':', '').slice(0, 4) + '00'; start = d + 'T' + tt; var hh = parseInt(ev.time.slice(0, 2), 10); end = d + 'T' + pad(Math.min(hh + 2, 23)) + ev.time.slice(3, 5) + '00'; }
  else { var nd = new Date(ev.date + 'T12:00:00'); nd.setDate(nd.getDate() + 1); start = d; end = nd.getFullYear() + pad(nd.getMonth() + 1) + pad(nd.getDate()); }
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + enc(ev.name || '') + '&dates=' + start + '/' + end + '&details=' + enc(clip(ev.description || '', 400)) + '&location=' + enc([ev.city, ev.country].filter(Boolean).join(', '));
}
function hydrateCalLinks(){
  qa('.add-to-cal').forEach(function(el){
    if(el.getAttribute('href') && el.getAttribute('href') !== '#') return;
    el.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + enc(el.getAttribute('data-title') || '') + '&dates=' + el.getAttribute('data-start') + '/' + el.getAttribute('data-end') + '&details=' + enc(el.getAttribute('data-details') || '') + '&location=' + enc(el.getAttribute('data-location') || '');
  });
}
function buildEventsBoard(){
  var list = q('#eventList'); if(!list || list.dataset.bdLive) return;
  list.dataset.bdLive = '1';
  listApproved('event').then(function(items){
    var today = isoDay(new Date());
    items = items.filter(function(ev){ return ev && ev.name && /^\d{4}-\d{2}-\d{2}$/.test(ev.date || '') && ev.date >= today; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    if(!items.length) return;
    var frag = doc.createDocumentFragment();
    items.slice(0, 40).forEach(function(ev){
      var d = new Date(ev.date + 'T12:00:00');
      var mon = d.toLocaleDateString('en-GB', {month: 'short'});
      var meta = [ev.kind, [ev.city, ev.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
      var body = h('div', {class: 'event-body'}, [
        h('h3', {text: clip(ev.name, 90)}),
        h('p', {class: 'meta', text: clip(meta, 120) + (ev.time ? ' · ' + ev.time : '')}),
        ev.free && /^free/i.test(ev.free) ? h('div', {class: 'example-tag', style: 'background:#e7f4ec;color:#1f5b40;border-color:#9ed1b4', text: 'Free'}) : null,
        h('p', {text: clip(ev.description || '', 400)})
      ]);
      var cal = h('a', {class: 'btn-small add-to-cal bd-has-ico', href: calLinkFor(ev), target: '_blank', rel: 'noopener'}, [iconSpan('calendar-plus', 'flip'), 'Add to Google Calendar']);
      body.appendChild(cal);
      if(isHttpUrl(ev.link)){ body.appendChild(h('a', {class: 'btn-small bd-has-ico', href: ev.link, target: '_blank', rel: 'noopener nofollow ugc', style: 'margin-left:.5rem'}, [iconSpan('globe', 'spin'), 'Event page'])); }
      frag.appendChild(h('div', {class: 'event-card bd-reveal'}, [h('div', {class: 'event-date'}, [h('span', {class: 'day', text: pad(d.getDate())}), h('span', {class: 'mon', text: mon})]), body]));
    });
    if(items.length >= 3) qa('.event-card .example-tag', list).forEach(function(t){ if(t.parentNode && t.parentNode.parentNode) t.parentNode.parentNode.remove(); });
    list.insertBefore(frag, list.firstChild);
    var note = q('.calendar-note'); if(note) note.textContent = 'Every event here has been checked by a person before it went live. Each has its own “Add to Google Calendar” button — no sign-in with us needed.';
  });
}

/* ------------------------------------------------------------------ blog + comments */
function openVideo(id, title){
  var f = h('iframe', {src: 'https://www.youtube-nocookie.com/embed/' + enc(id) + '?autoplay=1&rel=0&modestbranding=1', title: title || 'Video', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '', style: 'width:100%;aspect-ratio:16/9;border:0;border-radius:10px;background:#000'});
  var wrap = h('div', {style: 'width:min(720px,88vw)'}, [h('h3', {text: clip(title || '', 90), style: 'font-size:1rem;margin:.2rem 2rem .6rem 0;text-align:left'}), f,
    h('p', {}, [h('a', {href: 'https://www.youtube.com/watch?v=' + enc(id), target: '_blank', rel: 'noopener', text: 'Open on YouTube'}), ' · ', h('a', {href: CFG.ytSubscribeUrl || CFG.ytChannelUrl, target: '_blank', rel: 'noopener', text: 'Subscribe'})])]);
  pauseDock();
  openModal(wrap);
  var card = q('.bd-modal-card'); if(card) card.style.width = 'auto';
}
function buildBlog(){
  qa('[data-bd-video]').forEach(function(card){
    if(card.dataset.bdBound) return; card.dataset.bdBound = '1';
    card.addEventListener('click', function(){ openVideo(card.getAttribute('data-bd-video'), card.getAttribute('data-title')); });
  });
  var list = q('#bd-posts'); if(!list || list.dataset.bdLive) return; list.dataset.bdLive = '1';
  fetchJSON(CFG.blogUrl || 'assets/data/blog.json', 6000).then(function(j){
    var posts = ((j && j.posts) || []).filter(function(p){ return p && p.title && /^[a-z0-9][a-z0-9_\-\/]*\.html?$/i.test(String(p.url || '')); });
    list.textContent = '';
    if(!posts.length){ list.appendChild(h('div', {class: 'bd-empty', text: 'The first stories are being written — each one is based on a video from the list below. Check back soon.'})); return; }
    posts.sort(function(a, b){ return String(b.date || '') < String(a.date || '') ? -1 : 1; }).forEach(function(p){
      list.appendChild(h('a', {class: 'bd-post bd-reveal', href: p.url}, [h('span', {class: 'd', text: p.date || ''}), h('h3', {text: p.title}), h('p', {text: clip(p.summary || '', 240)})]));
    });
  }).catch(function(){ list.textContent = ''; list.appendChild(h('div', {class: 'bd-empty', text: 'Stories are on their way.'})); });
}
function buildComments(){
  qa('[data-bd-comments]').forEach(function(box){
    if(box.dataset.bdBound) return; box.dataset.bdBound = '1';
    var slug = box.getAttribute('data-bd-comments') || location.pathname;
    box.classList.add('bd-comments');
    var list = h('div', {'aria-live': 'polite'});
    box.appendChild(h('h3', {text: 'Comments'}));
    box.appendChild(list);
    listApproved('comment', '&post=' + enc(slug)).then(function(items){
      if(!items.length){ list.appendChild(h('p', {class: 'bd-note', text: 'No comments yet — be the first.'})); return; }
      items.slice(0, 100).forEach(function(c){
        list.appendChild(h('div', {class: 'bd-comment'}, [h('span', {class: 'who', text: clip(c.name || 'Traveller', 40)}), c.date ? h('span', {class: 'when', text: String(c.date).slice(0, 10)}) : null, h('p', {text: clip(c.comment || '', 1500)})]));
      });
    });
    var name = h('input', {type: 'text', name: 'name', maxlength: '40', required: 'required', placeholder: 'Your name or nickname (no surnames please)'});
    var text = h('textarea', {name: 'comment', maxlength: '1500', required: 'required', placeholder: 'Write a comment…'});
    var hp = h('input', {type: 'text', name: 'website', class: 'bd-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true'});
    var send = h('button', {type: 'submit', class: 'bd-btn bd-btn-primary bd-has-ico', style: 'padding:.8em 1.2em;border:0;justify-self:start'}, [iconSpan('send', 'fly'), 'Post comment']);
    var msg = h('div', {class: 'bd-form-msg'});
    var form = h('form', {novalidate: 'novalidate'}, [name, text, hp, send, h('p', {class: 'bd-note', text: 'Comments are checked by a person before they appear. Links and personal details are removed.'}), msg]);
    form.addEventListener('submit', function(e){
      e.preventDefault(); if(!form.reportValidity()) return;
      if(hp.value){ showMsg(msg, 'ok', 'Thanks!'); return; }
      send.disabled = true;
      submitEntry('comment', {post: slug, name: name.value.trim(), comment: text.value.trim()}).then(function(res){
        send.disabled = false;
        if(res.ok){ showMsg(msg, 'ok', 'Thanks! Your comment will appear once it’s been approved.'); form.reset(); }
        else if(res.reason === 'off') showMsg(msg, 'off', 'Comments aren’t switched on yet — nothing was sent. Please check back soon.');
        else showMsg(msg, 'err', 'Couldn’t send that just now — please try again in a minute.');
      });
    });
    box.appendChild(form);
  });
}

/* ------------------------------------------------------------------ effects + buttons */
var BTN_ICONS = [
  [/subscribe|youtube/i, 'play', 'pulse'],
  [/post an event|add your event|submit event|events?\b/i, 'calendar-plus', 'bounce'],
  [/upcoming|map/i, 'map-pin', 'drop'],
  [/agent/i, 'compass', 'spin'],
  [/business|listing|list your/i, 'store', 'swing'],
  [/blog|stor(y|ies)|videos?/i, 'book-open', 'flip'],
  [/home/i, 'tent', 'pop'],
  [/notify/i, 'bell', 'ring'],
  [/calendar/i, 'calendar-plus', 'flip'],
  [/submit|send|join|apply|sign ?up|register|post comment/i, 'send', 'fly'],
  [/copy|link/i, 'link', 'wiggle']
];
function decorateButtons(root){
  qa('a.btn, button.btn, .btn-small, form button[type=submit], nav.top .nav-links a.back, .bd-btn', root).forEach(function(b){
    if(b.classList.contains('bd-has-ico') || b.querySelector('.bd-ico')) return;
    var text = (b.textContent || '').trim();
    for(var i = 0; i < BTN_ICONS.length; i++){
      if(BTN_ICONS[i][0].test(text)){ b.classList.add('bd-has-ico'); b.insertBefore(iconSpan(BTN_ICONS[i][1], BTN_ICONS[i][2]), b.firstChild); return; }
    }
  });
  var path = location.pathname.split('/').pop() || 'index.html';
  qa('nav.top .nav-links a').forEach(function(a){
    var href = (a.getAttribute('href') || '').split('#')[0];
    if(href && href === path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
function addSubscribePill(){
  if(q('.bd-sub-btn.nav')) return;
  var host = q('nav.top .nav-links') || q('.links');
  if(!host) return;
  var a = h('a', {class: 'bd-sub-btn nav bd-has-ico', href: CFG.ytSubscribeUrl || CFG.ytChannelUrl, target: '_blank', rel: 'noopener'}, [iconSpan('play', 'pulse'), 'Subscribe']);
  host.appendChild(a);
}
var revealObserver;
function setupReveal(){
  if(reduceMotion || !('IntersectionObserver' in window)) return;
  if(!revealObserver){
    revealObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); revealObserver.unobserve(en.target); } });
    }, {rootMargin: '0px 0px -6% 0px', threshold: 0.05});
  }
  var sel = '.kicker, h2, p.intro, .type-card, .event-card, .card, .plan-card, .step, .guide, .faq, .bd-vcard, .bd-post, .day-story, .pack-callout, .script-box, .deals, .global-strip, .map-frame, .field, form.listing, form.apply';
  var groups = new Map();
  qa(sel).forEach(function(el){
    if(el.classList.contains('bd-reveal') && el.dataset.bdSeen) return;
    el.dataset.bdSeen = '1';
    var p = el.parentNode; var n = groups.get(p) || 0; groups.set(p, n + 1);
    el.style.setProperty('--bd-d', Math.min(n * 0.06, 0.36) + 's');
    el.classList.add('bd-reveal');
    revealObserver.observe(el);
  });
  setTimeout(function(){ qa('.bd-reveal:not(.in)').forEach(function(el){ if(el.getBoundingClientRect().top < window.innerHeight * 1.2) el.classList.add('in'); }); }, 1800);
  setTimeout(function(){ qa('.bd-reveal:not(.in)').forEach(function(el){ el.classList.add('in'); }); }, 6000);
}
function buildSky(){
  if(q('#bd-sky')) return;
  var cloud = '<svg viewBox="0 0 120 64" fill="currentColor" aria-hidden="true"><circle cx="36" cy="38" r="20"/><circle cx="62" cy="28" r="24"/><circle cx="90" cy="40" r="18"/><rect x="16" y="38" width="90" height="22" rx="11"/></svg>';
  doc.body.insertBefore(h('div', {id: 'bd-sky', 'data-bd-keep': '', 'aria-hidden': 'true'}, [
    h('div', {class: 'bd-cloud c1', html: cloud}), h('div', {class: 'bd-cloud c2', html: cloud}), h('div', {class: 'bd-cloud c3', html: cloud}),
    h('div', {class: 'bd-plane', html: ico('plane')})
  ]), doc.body.firstChild);
}
function buildProgress(){
  if(q('#bd-progress')) return;
  var bar = h('div', {id: 'bd-progress', 'data-bd-keep': '', 'aria-hidden': 'true'});
  doc.body.appendChild(bar);
  var tick = false;
  window.addEventListener('scroll', function(){
    if(tick) return; tick = true;
    requestAnimationFrame(function(){ var max = html.scrollHeight - window.innerHeight; bar.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) + '%'; tick = false; });
  }, {passive: true});
}
function addCredits(){
  if(q('.bd-credits')) return;
  var foot = q('footer'); if(!foot) return;
  var c = h('p', {class: 'bd-credits'}, ['Ticker information only — always check official sources before you travel. Data: ',
    h('a', {href: 'https://earthquake.usgs.gov', target: '_blank', rel: 'noopener', text: 'USGS'}), ', ',
    h('a', {href: 'https://www.gdacs.org', target: '_blank', rel: 'noopener', text: 'GDACS'}), ', ',
    h('a', {href: 'https://eonet.gsfc.nasa.gov', target: '_blank', rel: 'noopener', text: 'NASA EONET'}), ', ',
    h('a', {href: 'https://www.gov.uk/foreign-travel-advice', target: '_blank', rel: 'noopener', text: 'UK FCDO travel advice'}), ' (Open Government Licence v3.0), ',
    h('a', {href: 'https://date.nager.at', target: '_blank', rel: 'noopener', text: 'Nager.Date'}), '.']);
  foot.parentNode.insertBefore(c, foot.nextSibling);
}

/* ------------------------------------------------------------------ per-page enhancement */
var pageNodes = [];
function isThirdParty(n){
  if(n.nodeType !== 1) return true;
  var tag = n.tagName;
  if(tag === 'SCRIPT' || tag === 'IFRAME' || tag === 'NOSCRIPT' || tag === 'STYLE') return true;
  if(n.hasAttribute('data-bd-keep')) return true;
  if(n.id && /^container-/i.test(n.id)) return true;
  return false;
}
function snapshotPageNodes(){ pageNodes = Array.prototype.slice.call(doc.body.children).filter(function(n){ return !isThirdParty(n); }); }
function enhancePage(){
  qa('[data-bd-share]').forEach(buildShare);
  bindForms();
  decorateButtons(doc);
  addSubscribePill();
  hydrateCalLinks();
  buildEventsBoard();
  buildBlog();
  buildComments();
  buildWall();
  addCredits();
  setupReveal();
}

/* ------------------------------------------------------------------ page swap (keeps the video playing) */
function sameOriginPage(a){
  if(!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-bd-noswap')) return false;
  var href = a.getAttribute('href'); if(!href || /^(mailto:|tel:|sms:|javascript:)/i.test(href)) return false;
  var u; try{ u = new URL(a.href, location.href); }catch(e){ return false; }
  if(u.origin !== location.origin) return false;
  if(u.pathname === location.pathname && u.search === location.search) return false;   /* hash-only → native scroll */
  return /(\.html?|\/)$/i.test(u.pathname) || u.pathname === '/';
}
var swapping = false;
function swapTo(url, push){
  if(swapping) return; swapping = true;
  var target = new URL(url, location.href);
  html.classList.add('bd-nav-out');
  fetch(target.href, {credentials: 'same-origin'}).then(function(r){
    if(!r.ok || !/text\/html/i.test(r.headers.get('content-type') || '')) throw new Error('bad response');
    return r.text();
  }).then(function(text){
    var next = new DOMParser().parseFromString(text, 'text/html');
    if(!next.body) throw new Error('no body');
    return new Promise(function(res){ setTimeout(function(){ res(next); }, 140); });
  }).then(function(next){
    /* 1. page styles */
    var themeLink = q('link[href*="theme.css"]');
    qa('head style[data-bd-page]').forEach(function(s){ s.remove(); });
    qa('style', next.head).forEach(function(s){ var c = h('style', {'data-bd-page': ''}); c.textContent = s.textContent; doc.head.insertBefore(c, themeLink || null); });
    /* 2. title + description */
    doc.title = next.title || doc.title;
    var md = q('meta[name=description]'), nmd = next.querySelector('meta[name=description]');
    if(md && nmd) md.setAttribute('content', nmd.getAttribute('content') || '');
    /* 3. body: replace only what belongs to the page */
    pageNodes.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); });
    qa('#bd-wall, .bd-credits').forEach(function(n){ n.remove(); });
    var fresh = [];
    Array.prototype.slice.call(next.body.childNodes).forEach(function(n){
      if(n.nodeType === 1 && n.tagName === 'SCRIPT') return;
      var imp = doc.importNode(n, true);
      doc.body.appendChild(imp);
      if(imp.nodeType === 1) fresh.push(imp);
    });
    /* body-level scripts: run inline ones again, skip third-party/external (already loaded once) */
    qa('script', next.body).forEach(function(s){
      if(s.src){ return; }
      var ns = doc.createElement('script'); ns.textContent = s.textContent; doc.body.appendChild(ns); ns.remove();
    });
    pageNodes = fresh.filter(function(n){ return !isThirdParty(n); });
    if(push) history.pushState({bd: 1}, '', target.href);
    if(target.hash){ var t = q(target.hash); if(t) t.scrollIntoView(); else window.scrollTo(0, 0); } else window.scrollTo(0, 0);
    closeSharePanels();
    enhancePage();
    html.classList.remove('bd-nav-out'); html.classList.add('bd-nav-in');
    setTimeout(function(){ html.classList.remove('bd-nav-in'); }, 500);
    swapping = false;
  }).catch(function(){
    swapping = false; html.classList.remove('bd-nav-out');
    window.location.href = target.href;
  });
}
doc.addEventListener('click', function(e){
  if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  var a = e.target.closest ? e.target.closest('a') : null;
  if(!sameOriginPage(a) || location.protocol === 'file:') return;
  e.preventDefault();
  swapTo(a.href, true);
});
window.addEventListener('popstate', function(){ swapTo(location.href, false); });

/* ------------------------------------------------------------------ init */
function init(){
  html.classList.add('bd-js');
  qa('head style').forEach(function(s){ s.setAttribute('data-bd-page', ''); });
  snapshotPageNodes();
  buildSky(); buildTicker(); buildDock(); buildProgress();
  enhancePage();
  window.BD = {toast: toast, submit: submitEntry, openVideo: openVideo, share: buildShare};
}
if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
