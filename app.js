/* Garden@109A app – screens and logic. Data comes from the Google Apps Script service set in config.js. */
(function () {
'use strict';

/* ================= basics ================= */
var S = { boot: null, pin: '', preview: false, lists: {}, timer: null, toastT: null, pm: {}, vm: {}, add: null };
try {
  S.pin = localStorage.getItem('g109a_pin') || '';
  S.preview = localStorage.getItem('g109a_preview') === '1';
} catch (e) { /* storage blocked */ }

var app = document.getElementById('app');
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function pad(n) { return String(n).padStart(2, '0'); }
function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function fmtDate(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); }
function money(n) { return n === '' || n == null || isNaN(+n) ? '' : '₹' + Math.round(+n).toLocaleString('en-IN'); }
function qtyText(g) {
  if (g === '' || g == null || isNaN(+g)) return '–';
  g = +g; return Math.abs(g) >= 1000 ? (g / 1000).toFixed(1).replace(/\.0$/, '') + ' kg or L' : Math.round(g) + ' g or ml';
}
function isOwner() { return !!(S.boot && S.boot.owner); }
function parseArgs(s) { var o = {}; String(s || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) o[p[0]] = p[1] || ''; }); return o; }

var UPLOAD_FNS = { savePhoto: 1, savePurchase: 1, saveCapture: 1 };
function apiUrl() {
  var url = String(window.GARDEN_API || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('The garden link in config.js is missing or not right.');
  return url;
}
function readJson(r) {
  return r.text().then(function (t) {
    try { return JSON.parse(t); } catch (e) {
      throw new Error('The garden service answered with a web page, not data. In Apps Script, paste the new Code.gs and deploy a New version. Test: open your link with ?ping=1 at the end.');
    }
  });
}
function netFail() { throw new Error('Could not reach the garden service. Check your internet. If it continues, open your Apps Script link with ?ping=1 at the end to test it.'); }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function api(fn) {
  var args = Array.prototype.slice.call(arguments, 1), url;
  if (/^(save|update|delete|file|skip|renumber|add)/.test(fn)) S.calCache = {};
  try { url = apiUrl(); } catch (e) { return Promise.reject(e); }
  var q = url + '?fn=' + encodeURIComponent(fn) + '&args=' + encodeURIComponent(JSON.stringify(args)) + '&t=' + Date.now();
  if (UPLOAD_FNS[fn] || q.length > 6000) return apiUpload(url, fn, args);
  return fetch(q, { credentials: 'omit', redirect: 'follow' }).then(readJson, netFail).then(function (j) {
    if (!j.ok) throw new Error(j.error || 'Something went wrong.');
    return j.data;
  });
}
// Big saves (photos): send, then collect the answer with a small read.
function apiUpload(url, fn, args) {
  var id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  return fetch(url, {
    method: 'POST', mode: 'no-cors', credentials: 'omit',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args, reqId: id })
  }).then(function () { return collect(url, id, 0); }, netFail);
}
function collect(url, id, n) {
  return fetch(url + '?result=' + id + '&t=' + Date.now(), { credentials: 'omit', redirect: 'follow' }).then(readJson, netFail).then(function (j) {
    if (j.pending) {
      if (n >= 30) throw new Error('The upload took too long. Check the Photo journal before trying again, so it is not saved twice.');
      return wait(1500).then(function () { return collect(url, id, n + 1); });
    }
    if (!j.ok) throw new Error(j.error || 'Something went wrong.');
    return j.data;
  });
}

function toast(msg, kind) {
  var t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + (kind || '');
  clearTimeout(S.toastT);
  S.toastT = setTimeout(function () { t.className = 'toast'; }, 4500);
}

/* ================= icons ================= */
var IC = {
  leaf: '<path d="M5 19C5 10 11 5 20 4c0 9-5 15-14 15z"/><path d="M5 19l8-8"/>',
  flower: '<circle cx="12" cy="9" r="2"/><path d="M12 7c-1.5-3 1.5-5 3-3s-1 3-3 3zM14 9c3-1.5 5 1.5 3 3s-3-1-3-3zM12 11c1.5 3-1.5 5-3 3s1-3 3-3zM10 9c-3 1.5-5-1.5-3-3s3 1 3 3z"/><path d="M12 13v8M12 18c-2-1.5-4-1.5-5 0"/>',
  water: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  vine: '<path d="M6 21c0-6 12-6 12-12 0-3-2-5-5-5"/><path d="M9 15c-2 0-3-1-3-3 2 0 3 1 3 3zM15 9c2 0 3-1 3-3-2 0-3 1-3 3z"/>',
  succ: '<path d="M12 20c-4 0-7-3-7-7 3 0 5 1 7 4 2-3 4-4 7-4 0 4-3 7-7 7z"/><path d="M12 17c-2-3-2-7 0-11 2 4 2 8 0 11z"/>',
  fruit: '<circle cx="12" cy="14" r="6"/><path d="M12 8c0-2 1-4 3-5M12 8c-1-2-3-2-4-1"/>',
  bulb: '<path d="M12 4c0 3 6 5 6 10a6 6 0 0 1-12 0c0-5 6-7 6-10z"/><path d="M9 20v1.5M12 20v1.5M15 20v1.5"/>',
  fish: '<path d="M3 12c3-5 10-6 14 0-4 6-11 5-14 0z"/><path d="M17 12l4-3v6z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  pot: '<path d="M5 9h14l-2 11H7z"/><path d="M4 9h16"/><path d="M12 9V5"/>',
  repeat: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'
};
function icon(name, size, cls) {
  return '<svg class="ic ' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[name] || '') + '</svg>';
}
function flowerArt(color, size) {
  var pet = '';
  for (var a = 0; a < 360; a += 60) pet += '<ellipse cx="60" cy="28" rx="10" ry="18" fill="rgba(255,255,255,.65)" transform="rotate(' + a + ' 60 48)"/>';
  return '<svg class="sway" width="' + (size || 90) + '" height="' + (size || 90) + '" viewBox="0 0 120 120" fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M60 70V118"/>' + pet + '<circle cx="60" cy="48" r="7" fill="#fff"/></svg>';
}

var GROUP = {
  'Aquatic plants': { ic: 'water', bg: 'var(--water-t)', fg: 'var(--water)', anim: 'bob' },
  'Bulbs & tubers': { ic: 'bulb', bg: 'var(--lotus-t)', fg: 'var(--lotus)' },
  'Creepers & climbers': { ic: 'vine', bg: 'var(--leaf-t)', fg: 'var(--leaf)' },
  'Flowering shrubs': { ic: 'flower', bg: '#F9DAD2', fg: '#A1351E' },
  'Succulents': { ic: 'succ', bg: '#EEF1E2', fg: '#56601F' },
  'Orchids': { ic: 'flower', bg: '#F1E2F1', fg: '#7A2E7A' },
  'Herbs & greens': { ic: 'leaf', bg: 'var(--leaf-t)', fg: 'var(--leaf)' },
  'Fruits & trees': { ic: 'fruit', bg: 'var(--mari-t)', fg: 'var(--mari)' },
  'Foliage plants': { ic: 'leaf', bg: 'var(--soft)', fg: 'var(--muted)' }
};
var SWATCH = { 'White': '#FFFFFF', 'Cream': '#F3E9C6', 'Yellow': '#F2C94C', 'Golden': '#D9A400', 'Orange': '#F2994A',
  'Peach': '#F6B99A', 'Red': '#D64545', 'Maroon': '#7A1F2B', 'Pink': '#E58BA8', 'Light pink': '#F5C6D6',
  'Magenta': '#C2185B', 'Purple': '#7E57C2', 'Lavender': '#B39DDB', 'Blue': '#4F7BD9', 'Green': '#6BAA75',
  'Multi-colour': 'conic-gradient(#E58BA8 0 25%,#F2C94C 0 50%,#7E57C2 0 75%,#6BAA75 0)' };
function swatchOf(c) { var m = S.boot && S.boot.meta && S.boot.meta.swatches; return (m && m[c]) || SWATCH[c] || '#C9D3C8'; }
function hexOf(c) { var v = swatchOf(c); return /^#[0-9a-f]{6}$/i.test(v) ? v : '#C9D3C8'; }
function hiddenOf(list) { return (S.boot && S.boot.meta && S.boot.meta.hidden && S.boot.meta.hidden[list]) || []; }
function splitColours(s) { return String(s || '').split(/\s*,\s*/).filter(Boolean); }
function varColours(v) { return v ? [v.colour].concat(splitColours(v.colour2)).filter(Boolean) : []; }
function colourNames(keep) {
  var vals = (S.boot.lists && S.boot.lists['Colours']) || Object.keys(SWATCH), hid = hiddenOf('Colours');
  keep = keep || [];
  return vals.filter(function (c) { return (hid.indexOf(c) < 0 && c !== 'Multi-colour') || keep.indexOf(c) >= 0; });
}
function colourPicker(id, selected) {
  selected = selected || [];
  return '<div class="swatches" id="' + id + '" role="group" aria-label="Colours, pick one or more">' + colourNames(selected).map(function (c) {
    return swatchBtn(c, selected.indexOf(c) >= 0);
  }).join('') + '<button type="button" class="swatch swatch-add" data-newcolour>' + icon('plus', 16) + 'New colour</button></div>';
}
function swatchBtn(c, on) {
  return '<button type="button" class="swatch" data-c="' + esc(c) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><span class="sw-dot" style="background:' + swatchOf(c) + '"></span>' + esc(c) + '</button>';
}
function bindColourPicker(id) {
  var el = $('#' + id);
  var api2 = {
    get: function () { return $$('.swatch[data-c][aria-pressed="true"]', el).map(function (b) { return b.dataset.c; }); },
    set: function (arr) {
      arr = arr || [];
      arr.forEach(function (c) { if (!$('.swatch[data-c="' + c.replace(/"/g, '') + '"]', el)) $('[data-newcolour]', el).insertAdjacentHTML('beforebegin', swatchBtn(c, false)); });
      $$('.swatch[data-c]', el).forEach(function (b) { b.setAttribute('aria-pressed', arr.indexOf(b.dataset.c) >= 0 ? 'true' : 'false'); });
    }
  };
  el.addEventListener('click', function (e) {
    var b = e.target.closest('.swatch'); if (!b) return;
    if (b.hasAttribute('data-newcolour')) {
      var name = (window.prompt('Name of the new colour (for example: Coral)') || '').trim();
      if (!name) return;
      api('saveListValue', S.pin, 'Colours', '', name, false).then(function () {
        S.boot.lists['Colours'] = (S.boot.lists['Colours'] || []).concat([name]);
        b.insertAdjacentHTML('beforebegin', swatchBtn(name, true));
        toast(name + ' added. You can set its swatch colour in Masters.');
      }).catch(function (err) { toast(err.message, 'err'); });
      return;
    }
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });
  return api2;
}
function tintOf(colour) {
  var m = { 'White': '#EEF1EA', 'Cream': '#F6F0DA', 'Yellow': '#FBF0C9', 'Golden': '#F8E2A8', 'Orange': '#FBE3C9', 'Peach': '#FBE6DA',
    'Red': '#F9D9D2', 'Maroon': '#F0D6DA', 'Pink': '#F7DCE4', 'Light pink': '#FBE8EE', 'Magenta': '#F6D3E1', 'Purple': '#E9E0F5',
    'Lavender': '#EFEAF7', 'Blue': '#DCE6F7', 'Green': '#E3EEE6' };
  return m[colour] || '#EEF0EA';
}

/* ================= months ================= */
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MI = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseMonths(text) {
  var all = {}, peak = {}, rest = {};
  String(text || '').split(/[;,]|\band\b/).forEach(function (seg) {
    var s = seg.trim(); if (!s) return;
    var isRest = /\brest/i.test(s);
    var isPeak = /\b(most|peak|best)\b/i.test(s) && !/most of the year/i.test(s);
    var t = {};
    if (/all year|most of the year|any time/i.test(s)) for (var i = 0; i < 12; i++) t[i] = 1;
    var re = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b(?:\s*[–-]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b)?/g, m;
    while ((m = re.exec(s))) {
      var a = MI[m[1].toLowerCase()], b = m[2] ? MI[m[2].toLowerCase()] : a, k = a;
      for (var n = 0; n < 12; n++) { t[k] = 1; if (k === b) break; k = (k + 1) % 12; }
    }
    Object.keys(t).forEach(function (x) { x = +x; if (isRest) rest[x] = 1; else { all[x] = 1; if (isPeak) peak[x] = 1; } });
  });
  return { all: all, peak: peak, rest: rest };
}
function seasonOf(p) {
  if (p._season) return p._season;
  var f = parseMonths(p.flowerSeason), pl = parseMonths(p.plantSeason);
  var peak = Object.keys(f.peak).length ? f.peak : f.all;
  var plantAll = Object.keys(pl.all).length === 12;
  var cell = MONTHS.map(function (_, i) {
    if (f.rest[i]) return 'rest';
    if (peak[i]) return 'peak';
    if (f.all[i]) return 'some';
    if (pl.all[i] && !plantAll) return 'plant';
    return 'rest';
  });
  p._season = { flower: f.all, rest: f.rest, cell: cell };
  return p._season;
}

/* ================= lookups ================= */
function indexBoot() {
  S.pm = {}; S.vm = {};
  S.boot.plants.forEach(function (p) { S.pm[p.id] = p; });
  S.boot.varieties.forEach(function (v) { S.vm[v.id] = v; });
  (S.boot.pots || []).forEach(function (p) {
    if (!p.plant) p.plant = plantName(p.plantId);
    if (!p.variety && p.varietyId) p.variety = varLabel(S.vm[p.varietyId]);
  });
}
function plantName(id) { return S.pm[id] ? S.pm[id].en : ''; }
function varLabel(v) { return v ? (v.trade ? v.trade + ' (' + v.name + ')' : v.name) : ''; }
function isFlowering(p) { var t = (p.tags + ' ' + p.group).toLowerCase(); return /flowering/.test(t) || p.group === 'Flowering shrubs' || p.group === 'Orchids'; }
function matchFilter(p, f) {
  var t = (p.tags + ' ' + p.group + ' ' + p.sun).toLowerCase();
  if (f === 'all') return true;
  if (f === 'flower') return isFlowering(p);
  if (f === 'climb') return p.group === 'Creepers & climbers' || /climber/.test(t);
  if (f === 'water') return p.group === 'Aquatic plants';
  if (f === 'edible') return /edible|medicinal/.test(t);
  if (f === 'shade') return /shade|indirect/.test(t);
  return true;
}
function searchText(p) { return [p.en, p.ta, p.te, p.ml, p.kn, p.hi, p.bot, p.group].join(' ').toLowerCase(); }
function activePots() { return (S.boot.pots || []).filter(function (p) { return (p.status || 'Active') === 'Active'; }); }
function parseRef(s) { var m = String(s || '').trim().match(/^([A-Za-z]{1,2})\s*-?\s*0*(\d+)$/); return m ? { code: m[1].toUpperCase(), num: +m[2] } : null; }
function findPot(s) {
  var t = String(s || '').trim().toUpperCase(); if (!t) return null;
  var pots = activePots();
  var hit = pots.filter(function (p) { return String(p.ref).toUpperCase() === t; })[0];
  if (hit) return hit;
  var r = parseRef(t); if (!r) return null;
  return pots.filter(function (p) { var q = parseRef(p.ref); return q && q.code === r.code && q.num === r.num; })[0] || null;
}
function nextRef(code) {
  var pc = (S.boot.potCodes || []).filter(function (c) { return c.code === code; })[0];
  var width = pc && +pc.digits ? +pc.digits : 0, max = 0;
  (S.boot.pots || []).forEach(function (p) {
    var r = parseRef(p.ref);
    if (r && r.code === code) { max = Math.max(max, r.num); if (!width) width = String(p.ref).replace(/^[A-Za-z]+/, '').length; }
  });
  return code + String(max + 1).padStart(width || 3, '0');
}
function imgUrl(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 800); }
function photoAlt(p) { return [plantName(p.plantId), varLabel(S.vm[p.varietyId]), p.stage].filter(Boolean).join(', '); }
function caption(p) {
  var line2 = [varLabel(S.vm[p.varietyId]), p.stage, p.potNo, fmtDate(p.date)].filter(Boolean).join(', ');
  return '<strong>' + esc(plantName(p.plantId) || 'Garden') + (p.archive ? '<span class="cap-old">Old photo</span>' : '') + '</strong>' +
    (line2 ? '<span>' + esc(line2) + '</span>' : '') + (p.remark ? '<span>' + esc(p.remark) + '</span>' : '');
}
function plantOptions(sel) {
  var groups = {};
  S.boot.plants.forEach(function (p) { (groups[p.group || 'Other'] = groups[p.group || 'Other'] || []).push(p); });
  return '<option value="">Pick a plant</option>' + Object.keys(groups).map(function (g) {
    return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.en) + '</option>';
    }).join('') + '</optgroup>';
  }).join('');
}
function listOptions(name, sel, blank) {
  var hid = hiddenOf(name);
  var vals = ((S.boot.lists && S.boot.lists[name]) || []).filter(function (v) { return hid.indexOf(v) < 0 || v === sel; });
  return (blank != null ? '<option value="">' + esc(blank) + '</option>' : '') + vals.map(function (v) {
    return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>';
  }).join('');
}
function unitOptions(sel) {
  return (S.boot.units || []).map(function (u) { return '<option' + (u.unit === sel ? ' selected' : '') + '>' + esc(u.unit) + '</option>'; }).join('');
}
function areaOptions(sel, blank) {
  return '<option value="">' + esc(blank || 'Not set') + '</option>' + (S.boot.areas || []).map(function (a) {
    return '<option value="' + esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.id + ' ' + a.name) + '</option>';
  }).join('');
}
function varietyOptions(plantId, sel, withNew) {
  var vs = S.boot.varieties.filter(function (v) { return v.plantId === plantId; });
  return '<option value="">Not sure / general</option>' + vs.map(function (v) {
    return '<option value="' + esc(v.id) + '"' + (v.id === sel ? ' selected' : '') + '>' + esc(varLabel(v)) + '</option>';
  }).join('') + (withNew ? '<option value="__new">+ New variety</option>' : '');
}
function potDatalist(id) {
  return '<datalist id="' + id + '">' + activePots().map(function (p) {
    return '<option value="' + esc(p.ref) + '">' + esc(p.plant + (p.variety ? ', ' + p.variety : '')) + '</option>';
  }).join('') + '</datalist>';
}

/* ================= images ================= */
function readBytes(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer();
  return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsArrayBuffer(blob); });
}
function readExif(file) {
  var start;
  try { start = readBytes(file.slice(0, 262144)); } catch (e) { return Promise.resolve(null); }
  return Promise.resolve(start).then(function (buf) {
    var v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    var off = 2;
    while (off + 4 < v.byteLength) {
      var marker = v.getUint16(off), len = v.getUint16(off + 2);
      if (marker === 0xFFE1 && off + 10 < v.byteLength && v.getUint32(off + 4) === 0x45786966) return exifDate(v, off + 10);
      if ((marker & 0xFF00) !== 0xFF00) break;
      off += 2 + len;
    }
    return null;
  }).catch(function () { return null; });
}
function exifDate(v, t) {
  try {
    var le = v.getUint16(t) === 0x4949;
    var u16 = function (o) { return v.getUint16(o, le); }, u32 = function (o) { return v.getUint32(o, le); };
    var str = function (o, n) { var s = ''; for (var i = 0; i < n; i++) { var c = v.getUint8(o + i); if (!c) break; s += String.fromCharCode(c); } return s; };
    var scan = function (start, want) { var n = u16(start); for (var i = 0; i < n; i++) { var e = start + 2 + i * 12, tag = u16(e); if (tag in want) want[tag] = e; } return want; };
    var a = scan(t + u32(t + 4), { 34665: -1, 306: -1, 34853: -1 });
    var ds = null, gps = null;
    if (a[34853] > 0) {
      var g = scan(t + u32(a[34853] + 8), { 1: -1, 2: -1, 3: -1, 4: -1 });
      var rat = function (e) { var o = t + u32(e + 8), v = 0; for (var k = 0; k < 3; k++) { var n = u32(o + k * 8), dn = u32(o + k * 8 + 4); v += (dn ? n / dn : 0) / Math.pow(60, k); } return v; };
      if (g[2] > 0 && g[4] > 0) {
        var lat = rat(g[2]), lon = rat(g[4]);
        if (g[1] > 0 && String.fromCharCode(v.getUint8(g[1] + 8)) === 'S') lat = -lat;
        if (g[3] > 0 && String.fromCharCode(v.getUint8(g[3] + 8)) === 'W') lon = -lon;
        if (lat || lon) gps = { lat: lat, lon: lon };
      }
    }
    if (a[34665] > 0) { var b = scan(t + u32(a[34665] + 8), { 36867: -1 }); if (b[36867] > 0) ds = str(t + u32(b[36867] + 8), 19); }
    if (!ds && a[306] > 0) ds = str(t + u32(a[306] + 8), 19);
    var m = ds && ds.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/);
    var out = m && m[1] !== '0000' ? { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] + ':' + m[5] } : null;
    if (gps) { out = out || {}; out.gps = gps; }
    return out;
  } catch (e) { return null; }
}
function fromTs(ms) {
  if (!ms) return null;
  var d = new Date(ms);
  return { date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
}
function resizeToJpeg(file, max, q) {
  max = max || 2000; q = q || 0.82;
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      try {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', q).split(',')[1]);
      } catch (e) { URL.revokeObjectURL(url); rej(e); }
    };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('this photo type cannot be read here; please use JPG')); };
    img.src = url;
  });
}

/* ================= shared pieces ================= */
function gallery(key, list, emptyText) {
  S.lists[key] = list;
  if (!list.length) {
    return '<div class="gal gal-empty">' + flowerArt('var(--leaf)', 100) + '<p>' + esc(emptyText) + '</p></div>';
  }
  var slides = list.map(function (p, i) {
    return '<figure class="gal-slide" aria-hidden="' + (i ? 'true' : 'false') + '">' +
      '<button class="gal-open" data-act="lb" data-lb="' + key + '" data-i="' + i + '" aria-label="Open photo ' + (i + 1) + '">' +
      '<img src="' + imgUrl(p.fileId, 1200) + '" alt="' + esc(photoAlt(p)) + '" loading="' + (i < 2 ? 'eager' : 'lazy') + '"></button></figure>';
  }).join('');
  var ctl = list.length > 1 ?
    '<div class="gal-ctl"><button type="button" data-g="prev" aria-label="Previous photo">' + icon('back') + '</button>' +
    '<button type="button" data-g="pause" aria-label="Pause slideshow">' + icon('pause') + '</button>' +
    '<button type="button" data-g="next" aria-label="Next photo">' + icon('next') + '</button></div>' +
    '<div class="gal-dots">' + list.map(function (_, i) { return '<button type="button" data-g="dot" data-i="' + i + '" aria-label="Show photo ' + (i + 1) + '"></button>'; }).join('') + '</div>' : '';
  return '<div class="gal" data-gal="' + key + '" role="region" aria-roledescription="carousel" aria-label="Photo gallery, changes by itself"><div class="gal-view"><div class="gal-track">' + slides + '</div>' + ctl + '</div><div class="gal-cap">' + caption(list[0]) + '</div></div>';
}
function mountGallery(key) {
  var el = $('[data-gal="' + key + '"]'); if (!el) return;
  var n = $$('.gal-slide', el).length, i = 0;
  var paused = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(k) {
    i = (k + n) % n;
    $('.gal-track', el).style.transform = 'translateX(-' + (i * 100) + '%)';
    $$('.gal-slide', el).forEach(function (s, j) { s.setAttribute('aria-hidden', j === i ? 'false' : 'true'); });
    $$('[data-g="dot"]', el).forEach(function (d, j) { d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    var cap = $('.gal-cap', el), lst = S.lists[key] || [];
    if (cap && lst[i]) cap.innerHTML = caption(lst[i]);
  }
  function setPaused(v) {
    paused = v; var b = $('[data-g="pause"]', el);
    if (b) { b.innerHTML = icon(v ? 'play' : 'pause'); b.setAttribute('aria-label', v ? 'Play slideshow' : 'Pause slideshow'); }
  }
  el.addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return;
    var g = b.dataset.g;
    if (g === 'prev') show(i - 1); else if (g === 'next') show(i + 1);
    else if (g === 'dot') show(+b.dataset.i); else if (g === 'pause') setPaused(!paused);
  });
  el.addEventListener('pointerdown', function (e) { if (!e.target.closest('[data-g]')) setPaused(true); });
  show(0); setPaused(paused);
  if (n > 1) S.timer = setInterval(function () { if (!paused && !document.hidden) show(i + 1); }, 5000);
}
function photoGrid(key, list) {
  S.lists[key] = list;
  return '<div class="grid g-photos">' + list.map(function (p, i) {
    return '<button type="button" class="ptile" data-act="lb" data-lb="' + key + '" data-i="' + i + '" aria-label="Open photo: ' + esc(photoAlt(p) || 'garden') + '">' +
      '<img src="' + imgUrl(p.fileId, 500) + '" alt="" loading="lazy">' +
      '<span class="ptag">' + esc([p.stage, fmtDate(p.date)].filter(Boolean).join(', ')) + '</span>' +
      (p.archive ? '<span class="ptag2">Old</span>' : '') + '</button>';
  }).join('') + '</div>';
}
function openLb(key, start) {
  var list = S.lists[key] || []; if (!list.length) return;
  var k = start || 0, lb = $('#lb'), before = document.activeElement;
  function draw() {
    var p = list[k];
    lb.innerHTML = '<div class="lb-in"><img src="' + imgUrl(p.fileId, 1800) + '" alt="' + esc(photoAlt(p)) + '">' +
      '<div class="lb-cap">' + detailsHtml(p) + '</div><div class="lb-ctl">' +
      (list.length > 1 ? '<button type="button" data-l="prev" aria-label="Previous photo">' + icon('back') + '</button><button type="button" data-l="next" aria-label="Next photo">' + icon('next') + '</button>' : '') +
      '<button type="button" data-l="close" aria-label="Close">' + icon('close') + '</button></div>' +
      (isOwner() && p.fileId ? '<div class="row gap" style="justify-content:center"><a class="btn sm lb-edit" href="#/photo/' + encodeURIComponent(p.fileId) + '">Edit details</a>' +
        '<button type="button" class="btn sm lb-edit" data-l="share">Share / Google Photos</button></div>' : '') + '</div>';
  }
  function close() { lb.hidden = true; lb.innerHTML = ''; document.removeEventListener('keydown', onKey); S.lbClose = null; if (before && before.focus && !lb.dataset.nav) before.focus(); lb.dataset.nav = ''; }
  S.lbClose = close;
  function step(d) { k = (k + d + list.length) % list.length; draw(); }
  function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); }
  lb.onclick = function (e) {
    var b = e.target.closest('[data-l]');
    if (!b) { if (e.target === lb) close(); return; }
    var a = b.dataset.l;
    if (a === 'close') { close(); return; }
    if (a === 'share') { shareLabelled(list[k]); return; }
    step(a === 'next' ? 1 : -1);
    var again = $('[data-l="' + a + '"]', lb); if (again) again.focus();
  };
  draw(); lb.hidden = false; document.addEventListener('keydown', onKey);
  var c = $('[data-l="close"]', lb); if (c) c.focus();
}
function varietyCover(v) {
  var id = v.photo;
  if (!id) { var hit = S.boot.photos.filter(function (p) { return p.varietyId === v.id && p.fileId; })[0]; if (hit) id = hit.fileId; }
  return id ? '<img src="' + imgUrl(id, 600) + '" alt="" loading="lazy">'
    : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + tintOf(v.colour) + '">' + flowerArt('#4A5A50', 64) + '</div>';
}
function varietyCard(v) {
  return '<a class="card vcard" href="#/variety/' + esc(v.id) + '"><div class="cover">' + varietyCover(v) + '</div><div class="info">' +
    '<h3>' + esc(v.trade || v.name) + '</h3>' + (v.trade ? '<span class="muted sm">' + esc(v.name) + '</span>' : '') +
    '<div class="meta">' + varColours(v).map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + (v.petal ? '<span>' + esc(v.petal) + ' petal</span>' : '') + '</div></div></a>';
}
function chipRow(id, items, current, label) {
  return '<div class="chips" role="group" aria-label="' + esc(label) + '" id="' + id + '">' + items.map(function (it) {
    return '<button type="button" class="chip" data-v="' + esc(it[0]) + '" aria-pressed="' + (it[0] === current) + '">' +
      (it[2] ? '<span class="sw-dot" style="background:' + it[2] + '"></span>' : '') + esc(it[1]) + '</button>';
  }).join('') + '</div>';
}
function bindChips(id, onPick) {
  var row = $('#' + id); if (!row) return;
  row.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]'); if (!b) return;
    $$('[data-v]', row).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    onPick(b.dataset.v);
  });
}

/* ================= chrome + router ================= */
function route() {
  var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  var i = h.indexOf('/');
  return { page: (i < 0 ? h : h.slice(0, i)) || 'home', arg: i < 0 ? '' : h.slice(i + 1) };
}
function renderChrome() {
  var owner = isOwner(), real = S.boot && S.boot.realOwner, cur = route().page;
  var pub = [['', 'Home', 'home'], ['gallery', 'Gallery', 'gallery'], ['calendar', 'Calendar', 'calendar'], ['plants', 'Plants', 'plants'], ['varieties', 'Varieties', 'varieties'], ['fish', 'Fish', 'fish']];
  var rvN = S.boot && S.boot.captureCount ? ' (' + S.boot.captureCount + ')' : '';
  var own = [['capture', 'Capture', 'capture'], ['review', 'Review' + rvN, 'review'], ['add', 'Add photo', 'add'], ['photos', 'Photos', 'photos'], ['log', 'Log', 'log'], ['pots', 'Pots', 'pots'], ['buy', 'Buy', 'buy'], ['inputs', 'Inputs', 'inputs'], ['masters', 'Masters', 'masters'], ['dash', 'Dashboard', 'dash']];
  function link(x) {
    var on = cur === x[2] || (x[2] === 'plants' && cur === 'plant') || (x[2] === 'varieties' && cur === 'variety') || (x[2] === 'pots' && cur === 'pot') || (x[2] === 'photos' && cur === 'photo');
    return '<a class="nav-a' + (on ? ' on' : '') + '" href="#/' + x[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + x[1] + '</a>';
  }
  $('#nav').innerHTML = pub.map(link).join('') + (owner ? '<span class="nav-sep" aria-hidden="true"></span>' + own.map(link).join('') : '');
  $('#hdrRight').innerHTML = real ? '<button type="button" class="btn sm" data-act="preview" aria-pressed="' + S.preview + '">Family view: ' + (S.preview ? 'on' : 'off') + '</button>' : '';
  $('#banner').innerHTML = real && S.preview ? '<div class="wrap"><p class="note">You are seeing what relatives see. Costs, vendors and logs are hidden. Turn family view off to edit.</p></div>' : '';
  $('#fab').hidden = !owner || cur === 'add' || cur === 'capture';
  $('#ftr').innerHTML = '<span>Garden@109A, Chennai. Rain from the terrace goes back to the well.</span>' +
    (real ? (S.pin ? '<button type="button" class="linkbtn" data-act="signout">Sign out as owner</button>' : '<span>Signed in as owner</span>')
      : '<a href="#/signin">Owner sign-in</a>');
}
function render() {
  if (!S.boot) return;
  clearInterval(S.timer); S.timer = null;
  if (S.lbClose) { $('#lb').dataset.nav = '1'; S.lbClose(); }
  if (S.io) { S.io.disconnect(); S.io = null; }
  app.onclick = null; app.onchange = null;
  var r = route(), owner = isOwner();
  var pub = { home: viewHome, gallery: viewGallery, calendar: viewCalendar, plants: viewPlants, plant: viewPlant, varieties: viewVarieties, variety: viewVariety, fish: viewFish, signin: viewSignIn };
  var own = { capture: viewCapture, review: viewReview, add: viewAdd, photos: viewPhotos, photo: viewPhoto, log: viewLog, pots: viewPots, pot: viewPot, buy: viewBuy, inputs: viewInputs, masters: viewMasters, dash: viewDash };
  renderChrome();
  var fn = pub[r.page] || (owner ? own[r.page] : null) || (own[r.page] ? viewNeedOwner : viewNotFound);
  try { fn(r.arg); } catch (err) {
    app.innerHTML = '<div class="empty"><h1>Something went wrong</h1><p>' + esc(err.message) + '</p><a class="btn" href="#/">Go home</a></div>';
    if (window.console) console.error(err);
  }
  window.scrollTo(0, 0);
}
var PASSIVE = { home: 1, plants: 1, varieties: 1, fish: 1, dash: 1, inputs: 1, photos: 1 };
function bootKey() { return 'g109a_boot_' + (S.pin && !S.preview ? 'owner' : 'family'); }
function saveBoot(b) { try { localStorage.setItem(bootKey(), JSON.stringify(b)); } catch (e) { /* storage full */ } }
function load() {
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(bootKey()) || 'null'); } catch (e) {}
  if (cached) { S.boot = cached; indexBoot(); render(); }
  else { S.boot = null; app.innerHTML = '<p class="loading">Loading your garden…</p>'; }
  return api('getBoot', S.pin, S.preview).then(function (b) {
    saveBoot(b);
    var first = !cached; S.boot = b; indexBoot();
    if (first || PASSIVE[route().page]) render(); else renderChrome();
    setTimeout(function () { flushQueue(false); }, 1500);
  }).catch(function (err) {
    if (cached) { toast('Showing your saved copy. ' + err.message, 'err'); return; }
    app.innerHTML = '<div class="empty"><h1>Could not open the garden</h1><p>' + esc(err.message) + '</p><button type="button" class="btn" data-act="reload">Try again</button></div>';
  });
}
function refreshBoot() {
  return api('getBoot', S.pin, S.preview).then(function (b) { saveBoot(b); S.boot = b; indexBoot(); }).catch(function () {});
}
var ACT = {
  preview: function () { S.preview = !S.preview; try { localStorage.setItem('g109a_preview', S.preview ? '1' : '0'); } catch (e) {} load(); },
  signout: function () { S.pin = ''; S.preview = false; try { localStorage.removeItem('g109a_pin'); localStorage.removeItem('g109a_preview'); localStorage.removeItem('g109a_boot_owner'); } catch (e) {} load(); },
  reload: function () { load(); },
  lb: function (el) { openLb(el.dataset.lb, +el.dataset.i); }
};
document.addEventListener('click', function (e) {
  var a = e.target.closest('[data-act]'); if (!a || !ACT[a.dataset.act]) return;
  e.preventDefault(); ACT[a.dataset.act](a, e);
});
$('#fab').addEventListener('click', function () {
  var r0 = route();
  if (['plant', 'pot', 'variety'].indexOf(r0.page) < 0) { location.hash = '#/capture'; return; }
  var r = r0, arg = '';
  if (r.page === 'plant') arg = 'plant=' + r.arg;
  else if (r.page === 'pot') arg = 'pot=' + r.arg;
  else if (r.page === 'variety' && S.vm[r.arg]) arg = 'plant=' + S.vm[r.arg].plantId + '&variety=' + r.arg;
  location.hash = '#/add' + (arg ? '/' + arg : '');
});
window.addEventListener('hashchange', render);

/* ================= public views ================= */
var FILTERS = [['all', 'All'], ['flower', 'Flowering'], ['climb', 'Climbers'], ['water', 'Water'], ['edible', 'Edible'], ['shade', 'Shade-friendly']];
function stat(n, label) { return '<div class="stat"><dt>' + esc(label) + '</dt><dd>' + esc(n) + '</dd></div>'; }

function viewHome() {
  var b = S.boot, owner = isOwner(), now = new Date().getMonth();
  var gal = b.photos.filter(function (p) { return p.gallery && p.fileId; }).slice(0, 12);
  var bloom = b.plants.filter(function (p) { var s = seasonOf(p); return isFlowering(p) && s.flower[now] && !s.rest[now]; });
  app.innerHTML =
    '<section class="hero"><div class="hero-text">' +
      '<h1 class="display">Garden@109A</h1>' +
      '<p class="lead">A Chennai terrace of lotus ponds, flowers, herbs and fruit. Rain from the terrace goes back into our well.</p>' +
      '<dl class="stats">' + stat(b.counts.plants, 'plant types') + stat(b.counts.varieties, 'varieties') + stat(b.counts.pots, 'pots') + stat(b.counts.fishPots, 'fish pots') + '</dl>' +
      (owner ? '<div class="row gap"><a class="btn btn-primary" href="#/add">' + icon('camera') + 'Add photo</a><a class="btn" href="#/log">Log work</a></div>' : '') +
    '</div><div class="hero-gal">' + gallery('home', gal, owner ? 'Your photos will show here. Tap Add photo to start.' : 'Photos are coming soon.') + '</div></section>' +
    '<section class="sec"><div class="sec-h"><h2>In bloom in ' + MONTHS[now] + '</h2><p class="muted sm">From the care guide.</p></div>' +
      (bloom.length ? '<div class="chips">' + bloom.map(function (p) {
        return '<a class="chip chip-bloom" href="#/plant/' + esc(p.id) + '"><span class="dot pulse"></span>' + esc(p.en) + '</a>';
      }).join('') + '</div>' : '<p class="muted">Nothing listed for this month.</p>') + '</section>' +
    groupsSection(false);
  mountGallery('home');
  bindGroups();
}
function groupsSection(standalone) {
  return '<section class="sec" id="groups"><div class="sec-h">' + (standalone ? '<h1>Plants</h1>' : '<h2>All plants</h2>') +
    '<p class="muted sm">Grouped by type. Search in English, Tamil or the botanical name.</p></div>' +
    '<div class="search"><label class="lbl" for="q">Search plants</label><div class="search-box">' + icon('search') +
    '<input id="q" type="search" placeholder="Try lotus, sampangi, hibiscus" autocomplete="off"></div></div>' +
    chipRow('gfilter', FILTERS, 'all', 'Filter by type') +
    '<p class="muted sm" id="gcount" role="status"></p><div class="grid g-groups" id="ggrid"></div></section>';
}
function bindGroups() {
  var f = 'all', q = $('#q');
  function draw() {
    var term = q.value.trim().toLowerCase(), groups = {}, order = [];
    S.boot.plants.forEach(function (p) {
      if (!matchFilter(p, f)) return;
      if (term && searchText(p).indexOf(term) < 0) return;
      var g = p.group || 'Other';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(p);
    });
    $('#ggrid').innerHTML = order.map(function (g) {
      var m = GROUP[g] || { ic: 'leaf', bg: 'var(--soft)', fg: 'var(--muted)' };
      return '<article class="card gcard"><div class="gcard-h"><span class="gicon" style="background:' + m.bg + ';color:' + m.fg + '">' + icon(m.ic, 26, m.anim || 'sway') + '</span>' +
        '<div><h3>' + esc(g) + '</h3><span class="muted sm">' + groups[g].length + (groups[g].length === 1 ? ' plant' : ' plants') + '</span></div></div>' +
        '<div class="chips">' + groups[g].map(function (p) { return '<a class="pchip" href="#/plant/' + esc(p.id) + '">' + esc(p.en) + '</a>'; }).join('') + '</div>' +
        (g === 'Aquatic plants' ? '<a class="back" href="#/fish" style="color:var(--water)">' + icon('fish', 20, 'bob') + 'See the fish in these pots</a>' : '') +
        '</article>';
    }).join('') || '<div class="empty">No plant matches "' + esc(q.value) + '". Try another name.</div>';
    var n = order.reduce(function (s, g) { return s + groups[g].length; }, 0);
    $('#gcount').textContent = n + (n === 1 ? ' plant' : ' plants') + ' shown';
  }
  q.addEventListener('input', draw);
  bindChips('gfilter', function (v) { f = v; draw(); });
  draw();
}
function viewPlants() { app.innerHTML = groupsSection(true); bindGroups(); }

function viewPlant(id) {
  var p = S.pm[id]; if (!p) return viewNotFound();
  var owner = isOwner(), se = seasonOf(p), now = new Date().getMonth();
  var vars = S.boot.varieties.filter(function (v) { return v.plantId === id; });
  var names = [['Tamil', 'ta'], ['Telugu', 'te'], ['Malayalam', 'ml'], ['Kannada', 'kn'], ['Hindi', 'hi']];
  var LBL = { peak: 'Most', some: 'Some', plant: 'Plant', rest: 'Rest' };
  var feeds = [['W', 'Weekly', p.feedW], ['F', 'Fortnightly', p.feedF], ['M', 'Monthly', p.feedM], ['Q', 'Quarterly', p.feedQ], ['Y', 'Yearly', p.feedY]];
  var care = [['Chennai suitability', p.suit], ['Planting season', p.plantSeason], ['Flowering or fruiting season', p.flowerSeason],
    ['Pruning season', p.pruneSeason], ['Sun', p.sun], ['Watering', p.water], ['Potting mix', p.mix], ['Pot size', p.potSize],
    ['Propagation', p.prop], ['Pruning method', p.prune], ['Pests and diseases', p.pests], ['Repot every', p.repot], ['Notes', p.notes]]
    .filter(function (c) { return c[1]; });
  var colours = [], petals = [];
  vars.forEach(function (v) { varColours(v).forEach(function (c) { if (colours.indexOf(c) < 0) colours.push(c); }); if (v.petal && petals.indexOf(v.petal) < 0) petals.push(v.petal); });
  var gm = GROUP[p.group] || {};

  app.innerHTML =
    '<a class="back" href="#/plants">' + icon('back') + 'All plants</a>' +
    '<section class="p-head"><div class="p-main">' +
      '<div class="chips">' + (p.suit ? '<span class="badge b-leaf">Chennai: ' + esc(p.suit.toLowerCase()) + '</span>' : '') +
        (p.group ? '<span class="badge" style="background:' + (gm.bg || 'var(--soft)') + ';color:' + (gm.fg || 'var(--ink)') + '">' + esc(p.group) + '</span>' : '') +
        (p.tags ? p.tags.split(',').map(function (t) { return '<span class="badge">' + esc(t.trim()) + '</span>'; }).join('') : '') + '</div>' +
      '<h1>' + esc(p.en) + '</h1>' +
      (p.ta ? '<p class="local-big" lang="ta">' + esc(p.ta) + '</p>' : '') +
      (p.bot ? '<p class="muted"><em>' + esc(p.bot) + '</em></p>' : '') +
      '<div class="names">' + names.map(function (n) {
        return '<div><div class="k">' + n[0] + '</div><div' + (p[n[1]] ? ' lang="' + n[1] + '"' : ' class="muted"') + '>' + esc(p[n[1]] || 'Not added yet') + '</div></div>';
      }).join('') + '</div>' +
    '</div><div class="p-side">' +
      fact('sun', 'Sun', p.sun) + fact('water', 'Water', p.water) + fact('pot', 'Pot size', p.potSize) + fact('repeat', 'Repot', p.repot) +
    '</div></section>' +

    '<section class="sec card"><h2>Year in Chennai</h2><div class="strip-wrap"><ol class="strip">' + MONTHS.map(function (m, i) {
      return '<li class="c-' + se.cell[i] + (i === now ? ' now' : '') + '"><span class="m">' + m + '</span><span class="k">' + LBL[se.cell[i]] + '</span></li>';
    }).join('') + '</ol></div><ul class="legend"><li><i class="c-plant"></i>Plant</li><li><i class="c-some"></i>Some flowers or fruit</li><li><i class="c-peak"></i>Most</li><li><i class="c-rest"></i>Rest</li><li><i style="outline:2px solid var(--ink)"></i>This month</li></ul></section>' +

    '<section class="sec"><div class="sec-h"><h2>Photos</h2>' + (owner ? '<a class="btn sm" href="#/add/plant=' + esc(id) + '">' + icon('camera') + 'Add photo</a>' : '') + '</div><div id="pphotos"><p class="muted">Loading photos…</p></div></section>' +

    ((vars.length || owner) ? '<section class="sec"><div class="sec-h"><h2>Varieties</h2><span class="muted sm" id="vcount"></span></div>' +
      (colours.length > 1 ? chipRow('vcol', [['all', 'All colours']].concat(colours.map(function (c) { return [c, c, swatchOf(c)]; })), 'all', 'Colour') : '') +
      (petals.length > 1 ? chipRow('vpet', [['all', 'Any petal']].concat(petals.map(function (x) { return [x, x + ' petal']; })), 'all', 'Petal type') : '') +
      '<div class="grid g-cards" id="vgrid"></div>' +
      (owner ? '<details class="addbox" id="avBox"' + (vars.length ? '' : ' open') + '><summary>' + icon('plus') + '&nbsp;Add a variety</summary>' +
        '<form id="avForm" class="form"><div class="f2">' +
        '<div class="field"><label for="avName">Variety name</label><input id="avName" autocomplete="off" placeholder="e.g. White Rabbit"></div>' +
        '<div class="field"><label for="avTrade">Trade name (optional)</label><input id="avTrade" autocomplete="off"></div>' +
        '<div class="field"><label for="avPetal">Petal type</label><select id="avPetal">' + listOptions('Petal types', '', 'Not set') + '</select></div></div>' +
        '<div class="field"><span class="lbl">Colours (tap one or more; the first is the main colour)</span>' + colourPicker('avColours', []) + '</div>' +
        '<div class="field"><label for="avNotes">Notes (optional)</label><textarea id="avNotes" rows="2"></textarea></div>' +
        '<button class="btn btn-primary" type="submit">Add variety</button></form></details>' : '') + '</section>' : '') +

    '<section class="sec card"><h2>Feeding</h2><p class="muted sm">Uses only items from your store.</p>' +
      '<div class="tabs" role="tablist" aria-label="How often">' + feeds.map(function (f, i) {
        return '<button type="button" role="tab" id="tab' + f[0] + '" aria-controls="feedPanel" aria-selected="' + (i === 2) + '" data-t="' + i + '">' + f[1] + '</button>';
      }).join('') + '</div><div class="tabpanel" id="feedPanel" role="tabpanel"></div></section>' +

    (care.length ? '<section class="sec"><h2>Care guide</h2><div>' + care.map(function (c, i) {
      return '<details class="care"' + (i === 0 ? ' open' : '') + '><summary>' + esc(c[0]) + '</summary><div class="body">' + esc(c[1]) + '</div></details>';
    }).join('') + '</div></section>' : '') +

    (owner ? '<section class="sec"><h2>Pots with ' + esc(p.en.toLowerCase()) + '</h2>' + potTable(activePots().filter(function (x) { return x.plantId === id; })) + '</section>' : '');

  // varieties grid with filters
  var fc = 'all', fp = 'all';
  function drawVars() {
    var list = vars.filter(function (v) { return (fc === 'all' || varColours(v).indexOf(fc) >= 0) && (fp === 'all' || v.petal === fp); });
    var g = $('#vgrid'); if (!g) return;
    g.innerHTML = list.map(varietyCard).join('') || '<p class="muted">No variety matches these filters.</p>';
    var c = $('#vcount'); if (c) c.textContent = list.length + ' of ' + vars.length;
  }
  var avForm = $('#avForm'), avPick = avForm ? bindColourPicker('avColours') : null;
  if (avForm) avForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#avName').value.trim();
    if (!name) { toast('Type the variety name.', 'err'); $('#avName').focus(); return; }
    var cols = avPick.get();
    var nv = { plantId: id, name: name, trade: $('#avTrade').value.trim(), colours: cols, colour: cols[0] || '', colour2: cols.slice(1).join(', '), petal: $('#avPetal').value, notes: $('#avNotes').value.trim() };
    var btn = $('button[type=submit]', avForm); btn.disabled = true;
    api('saveVariety', S.pin, nv).then(function (vid) {
      if (S.vm[vid]) { toast(name + ' is already in the list.'); return; }
      nv.id = vid; nv.photo = ''; S.boot.varieties.push(nv); S.vm[vid] = nv; vars.push(nv);
      toast(name + ' added.');
      $('#avName').value = ''; $('#avTrade').value = ''; $('#avNotes').value = ''; avPick.set([]); $('#avName').focus();
      drawVars(); saveBoot(S.boot);
    }).catch(function (err) { toast(err.message, 'err'); }).then(function () { btn.disabled = false; });
  });
  bindChips('vcol', function (v) { fc = v; drawVars(); });
  bindChips('vpet', function (v) { fp = v; drawVars(); });
  drawVars();

  // feeding tabs
  function showTab(i) {
    $$('[role=tab]', app).forEach(function (t) { t.setAttribute('aria-selected', String(+t.dataset.t === i)); });
    $('#feedPanel').textContent = feeds[i][2] || 'Not filled yet.';
    $('#feedPanel').setAttribute('aria-labelledby', 'tab' + feeds[i][0]);
  }
  $$('[role=tab]', app).forEach(function (t) { t.addEventListener('click', function () { showTab(+t.dataset.t); }); });
  showTab(2);

  api('getPhotos', S.pin, { plantId: id }, S.preview).then(function (list) {
    var box = $('#pphotos'); if (!box || route().arg !== id) return;
    box.innerHTML = list.length ? photoGrid('plant', list) : '<p class="muted">No photos yet.</p>';
  }).catch(function (err) { var box = $('#pphotos'); if (box) box.innerHTML = '<p class="hint bad">Photos did not load: ' + esc(err.message) + '</p>'; });
}
function fact(ic, k, v) {
  return '<div class="fact">' + icon(ic, 26, 'sway') + '<span class="k">' + esc(k) + '</span><span class="v">' + esc(v || 'Not filled yet') + '</span></div>';
}
function potTable(pots) {
  if (!pots.length) return '<p class="muted">No active pots.</p>';
  return '<div class="tbl-wrap"><table><thead><tr><th>Pot</th><th>Variety</th><th>Area</th><th>Potted on</th><th>Last fed</th></tr></thead><tbody>' +
    pots.map(function (x) {
      return '<tr><td><a href="#/pot/' + esc(x.uid) + '"><strong>' + esc(x.ref) + '</strong></a></td><td>' + esc(x.variety || '–') + '</td><td>' + esc(x.area || '–') +
        '</td><td>' + esc(fmtDate(x.potted) || '–') + '</td><td>' + esc(fmtDate(x.lastFed) || '–') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function viewVarieties() {
  var vars = S.boot.varieties, plantIds = [], colours = [], petals = [];
  vars.forEach(function (v) {
    if (plantIds.indexOf(v.plantId) < 0) plantIds.push(v.plantId);
    varColours(v).forEach(function (c) { if (colours.indexOf(c) < 0) colours.push(c); });
    if (v.petal && petals.indexOf(v.petal) < 0) petals.push(v.petal);
  });
  app.innerHTML = '<div class="page-h"><h1>Varieties</h1><p class="muted">' + vars.length + ' varieties. Filter by plant, colour or petal type.</p></div>' +
    '<div class="f2" style="max-width:760px"><div class="field"><label for="vp">Plant</label><select id="vp"><option value="">All plants</option>' +
      plantIds.map(function (id) { return '<option value="' + esc(id) + '">' + esc(plantName(id)) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label for="vq">Search</label><input id="vq" type="search" placeholder="Variety or trade name" autocomplete="off"></div></div>' +
    (colours.length ? '<div style="margin-top:14px">' + chipRow('vlc', [['all', 'All colours']].concat(colours.map(function (c) { return [c, c, swatchOf(c)]; })), 'all', 'Colour') + '</div>' : '') +
    (petals.length ? '<div style="margin-top:10px">' + chipRow('vlp', [['all', 'Any petal']].concat(petals.map(function (x) { return [x, x + ' petal']; })), 'all', 'Petal type') + '</div>' : '') +
    '<p class="muted sm" id="vlcount" role="status" style="margin:14px 0 10px"></p><div class="grid g-cards" id="vlgrid"></div>' +
    '<div style="margin-top:16px"><button type="button" class="btn" id="vmore" hidden>Show more</button></div>';
  var fc = 'all', fp = 'all', shown = 60;
  function draw() {
    var pid = $('#vp').value, q = $('#vq').value.trim().toLowerCase();
    var list = vars.filter(function (v) {
      return (!pid || v.plantId === pid) && (fc === 'all' || varColours(v).indexOf(fc) >= 0) && (fp === 'all' || v.petal === fp) &&
        (!q || (v.name + ' ' + v.trade + ' ' + plantName(v.plantId)).toLowerCase().indexOf(q) >= 0);
    });
    $('#vlgrid').innerHTML = list.slice(0, shown).map(varietyCard).join('') || '<div class="empty">No variety matches. Change the filters.</div>';
    $('#vlcount').textContent = list.length + (list.length === 1 ? ' variety' : ' varieties');
    $('#vmore').hidden = list.length <= shown;
  }
  $('#vp').addEventListener('change', function () { shown = 60; draw(); });
  $('#vq').addEventListener('input', function () { shown = 60; draw(); });
  $('#vmore').addEventListener('click', function () { shown += 60; draw(); });
  bindChips('vlc', function (v) { fc = v; shown = 60; draw(); });
  bindChips('vlp', function (v) { fp = v; shown = 60; draw(); });
  draw();
}

function viewVariety(id) {
  var v = S.vm[id]; if (!v) return viewNotFound();
  var owner = isOwner(), p = S.pm[v.plantId] || {};
  var vendor = owner && v.vendorId ? (S.boot.vendors || []).filter(function (x) { return x.id === v.vendorId; })[0] : null;
  var facts = [['Colours', varColours(v).join(', ')], ['Petal type', v.petal], ['Flower size', v.size], ['Fragrance', v.fragrance]];
  if (owner) facts = facts.concat([['Bought from', vendor ? vendor.name : ''], ['Date bought', fmtDate(v.bought)], ['Cost', money(v.cost)], ['Pots now', v.potsNow]]);
  app.innerHTML = '<a class="back" href="#/plant/' + esc(v.plantId) + '">' + icon('back') + esc(p.en || 'Plant') + '</a>' +
    '<div class="page-h"><h1>' + esc(v.trade || v.name) + '</h1><p class="muted">' + esc([v.trade ? v.name : '', p.en].filter(Boolean).join(', ')) + '</p></div>' +
    '<div class="grid g-cards">' + facts.filter(function (f) { return f[1] !== '' && f[1] != null; }).map(function (f) {
      return '<div class="fact"><span class="k">' + esc(f[0]) + '</span><span class="v">' + esc(f[1]) + '</span></div>';
    }).join('') + '</div>' + (v.notes ? '<p style="margin-top:14px;max-width:70ch">' + esc(v.notes) + '</p>' : '') +
    '<section class="sec"><div class="sec-h"><h2>Photos</h2>' + (owner ? '<a class="btn sm" href="#/add/plant=' + esc(v.plantId) + '&variety=' + esc(id) + '">' + icon('camera') + 'Add photo</a>' : '') +
    '</div><div id="vphotos"><p class="muted">Loading photos…</p></div></section><section class="sec" id="blooms" hidden><h2>Flower life</h2><p class="muted sm">Each row is one flower, from bud to dry.</p><div id="bloomList"></div></section>';
  api('getPhotos', S.pin, { varietyId: id }, S.preview).then(function (list) {
    if (route().arg !== id) return;
    $('#vphotos').innerHTML = list.length ? photoGrid('variety', list) : '<p class="muted">No photos yet.</p>';
    var by = {}, order = [];
    list.slice().reverse().forEach(function (x) { if (!x.bloom) return; if (!by[x.bloom]) { by[x.bloom] = []; order.push(x.bloom); } by[x.bloom].push(x); });
    if (order.length) {
      $('#blooms').hidden = false;
      $('#bloomList').innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>Flower</th><th>Stages</th></tr></thead><tbody>' + order.reverse().map(function (b) {
        return '<tr><td><strong>' + esc(b) + '</strong></td><td>' + esc(by[b].map(function (x) { return (x.stage || 'Photo') + ' ' + fmtDate(x.date); }).join(', ')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }
  }).catch(function (err) { $('#vphotos').innerHTML = '<p class="hint bad">Photos did not load: ' + esc(err.message) + '</p>'; });
}

var FISH_CARE = [
  ['Feeding', 'Feed a small pinch once a day. Give only what they finish in 2 minutes. Skip one day a week; they also eat mosquito larvae.'],
  ['Summer (Apr–Jun)', 'Water dries fast. Top up with well water every 2–3 days. Keep part of the pot shaded with lily leaves or a shade net, so the water stays cool.'],
  ['Monsoon (Oct–Dec)', 'Heavy rain can overflow the pot and wash the fish out. Make an overflow hole near the top and cover it with fine mesh. Feed less on cloudy days.'],
  ['Babies and breeding', 'Guppies, mollies and platies give birth to live babies. Adults eat babies, so floating plants and roots help them hide. Move extra babies to a new pot.'],
  ['Water', 'Your well water has no chlorine, so it is good for fish. Change about one-fourth of the water once a month. Never change all of it at once.']
];
function viewFish() {
  var b = S.boot, owner = isOwner();
  var aquatic = b.plants.filter(function (p) { return p.group === 'Aquatic plants'; }).map(function (p) { return p.id; });
  var gal = b.photos.filter(function (p) { return aquatic.indexOf(p.plantId) >= 0 && p.gallery && p.fileId; }).slice(0, 10);
  var fishName = {}; b.fishTypes.forEach(function (f) { fishName[f.id] = f.name; });
  app.innerHTML =
    '<section class="hero"><div class="hero-text"><h1>Fish in our pots</h1>' +
      '<p class="lead">Every lotus and water lily pot has fish. They eat mosquito larvae and keep the water healthy.</p>' +
      '<dl class="stats">' + stat(b.counts.fishPots, 'fish pots') + stat(b.fishTypes.length, 'fish types') + '</dl></div>' +
    '<div class="hero-gal">' + gallery('fish', gal, 'Photos of the lotus and lily pots will show here.') + '</div></section>' +
    '<section class="sec"><h2>Fish types</h2><div class="grid g-groups">' + b.fishTypes.map(function (f) {
      return '<article class="card gcard"><div class="gcard-h"><span class="gicon" style="background:var(--water-t);color:var(--water)">' + icon('fish', 28, 'bob') + '</span>' +
        '<div><h3>' + esc(f.name) + '</h3>' + (f.sci ? '<em class="muted sm">' + esc(f.sci) + '</em>' : '') + '</div></div>' +
        (f.strain || f.colour || f.ta ? '<p class="sm">' + esc([f.strain, f.colour, f.ta].filter(Boolean).join(', ')) + '</p>' : '') +
        (f.notes ? '<p class="sm muted">' + esc(f.notes) + '</p>' : '') + (owner && f.now !== '' ? '<span class="badge b-water">' + esc(f.now) + ' now</span>' : '') + '</article>';
    }).join('') + '</div></section>' +
    (owner ? '<section class="sec"><div class="sec-h"><h2>Which fish, which pot</h2><a class="btn sm" href="#/log/tab=fish">Log fish</a></div>' +
      ((b.fishStock || []).length ? '<div class="tbl-wrap"><table><thead><tr><th>Pot</th><th>Fish</th><th>Count</th></tr></thead><tbody>' +
        b.fishStock.map(function (s) { return '<tr><td><a href="#/pot/' + esc(s.potUid) + '"><strong>' + esc(s.potNo) + '</strong></a></td><td>' + esc(fishName[s.fishId] || s.fishId) + '</td><td>' + esc(s.count) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="muted">No fish logged yet. Use Log → Fish to add them.</p>') + '</section>' : '') +
    '<section class="sec"><div class="warn">' + icon('warn', 28) + '<div><h2 style="font-size:19px">Keep these away from fish pots</h2><ul>' +
      '<li>Neem oil and soap sprays. They harm fish.</li><li>Bio-pesticide sprays. Spray nearby plants only on a still day, and cover the pot.</li>' +
      '<li>Panchagavya, jeevamrutham and meen amilam. They make the water foul.</li><li>To feed lotus, press fertilizer balls deep into the soil, not into the water.</li></ul></div></div></section>' +
    '<section class="sec"><h2>Fish care in Chennai</h2><div>' + FISH_CARE.map(function (c, i) {
      return '<details class="care"' + (i === 0 ? ' open' : '') + '><summary>' + esc(c[0]) + '</summary><div class="body">' + esc(c[1]) + '</div></details>';
    }).join('') + '</div></section>';
  mountGallery('fish');
}

function viewSignIn() {
  if (S.boot.realOwner) { app.innerHTML = '<div class="empty"><h1>You are signed in as owner</h1><a class="btn btn-primary" href="#/add">Add photo</a></div>'; return; }
  app.innerHTML = '<div class="page-h"><h1>Owner sign-in</h1><p class="muted">Enter the PIN shown when you ran setup in Apps Script. This phone will remember it. Never share the PIN.</p></div>' +
    '<form id="pinForm" class="form" style="max-width:360px"><div class="field"><label for="pin">PIN</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" required></div>' +
    '<p class="hint bad" id="pinMsg" role="alert"></p><button class="btn btn-primary lg" type="submit">Sign in</button></form>';
  $('#pinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pin = $('#pin').value.trim();
    api('checkPin', pin).then(function (ok) {
      if (!ok) { $('#pinMsg').textContent = 'That PIN is not right. Check it in Apps Script → Project settings → Script properties. After 10 wrong tries, wait 15 minutes.'; return; }
      S.pin = pin; S.preview = false;
      try { localStorage.setItem('g109a_pin', pin); localStorage.setItem('g109a_preview', '0'); } catch (err) {}
      location.hash = '#/'; load();
    }).catch(function (err) { $('#pinMsg').textContent = err.message; });
  });
}
function viewNeedOwner() { app.innerHTML = '<div class="empty"><h1>This page is for the garden owner</h1><p>Sign in with your PIN to use it.</p><a class="btn btn-primary" href="#/signin">Owner sign-in</a></div>'; }
function viewNotFound() { app.innerHTML = '<div class="empty"><h1>Page not found</h1><p>This link may be old.</p><a class="btn" href="#/">Go home</a></div>'; }

/* ================= owner: add photos ================= */
var FLOWER_STAGES = ['Bud', 'Bud opening', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Full bloom', 'Fading', 'Dried', 'Seed pod', 'Seeds'];
var NEW_BLOOM_STAGES = ['Bud', 'Bud opening', 'Day 1'];
function isFlowerStage(st) { return FLOWER_STAGES.indexOf(st) >= 0 || /^(bud|day\s*\d+|full bloom|fading|dried|seed)/i.test(String(st || '')); }

/* ---------- typable search box (combobox) ---------- */
function comboHtml(id, label, placeholder) {
  return '<div class="field combo"><label for="' + id + '">' + esc(label) + '</label>' +
    '<input id="' + id + '" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + id + 'List" autocomplete="off" spellcheck="false" placeholder="' + esc(placeholder || 'Type to search') + '">' +
    '<ul class="combo-list" id="' + id + 'List" role="listbox" hidden></ul></div>';
}
function Combo(id, options, value) {
  var input = $('#' + id), list = $('#' + id + 'List'), cur = '', opts = [], shown = [], active = -1, cbs = [];
  function labelOf(v) { var o = opts.filter(function (x) { return x.value === v; })[0]; return o ? o.label : ''; }
  function hi() {
    $$('li[data-i]', list).forEach(function (li, i) { li.classList.toggle('on', i === active); });
    if (active >= 0) input.setAttribute('aria-activedescendant', id + '_o' + active); else input.removeAttribute('aria-activedescendant');
  }
  function open(term) {
    var t = String(term || '').trim().toLowerCase();
    shown = opts.filter(function (o) { return o.always || !t || (o.label + ' ' + (o.search || '')).toLowerCase().indexOf(t) >= 0; }).slice(0, 80);
    active = t && shown.length ? shown.findIndex(function (o) { return !o.always; }) : -1;
    list.innerHTML = shown.map(function (o, i) {
      return '<li role="option" id="' + id + '_o' + i + '" data-i="' + i + '" aria-selected="' + (o.value === cur) + '"' + (o.cls ? ' class="' + o.cls + '"' : '') + '>' +
        esc(o.label) + (o.hint ? '<span class="combo-hint">' + esc(o.hint) + '</span>' : '') + '</li>';
    }).join('') || '<li class="combo-none">No match</li>';
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); hi();
  }
  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; hi(); }
  function pick(o) { var changed = o.value !== cur; cur = o.value; input.value = o.label; close(); if (changed) cbs.forEach(function (f) { f(cur); }); }
  input.addEventListener('focus', function () { if (input.select) input.select(); open(''); });
  input.addEventListener('input', function () { open(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (list.hidden) open(input.value);
      var n = shown.length; if (!n) return;
      active = e.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n; hi();
    } else if (e.key === 'Enter') {
      if (!list.hidden && shown.length) { e.preventDefault(); pick(shown[active < 0 ? 0 : active]); }
    } else if (e.key === 'Escape') { close(); input.value = labelOf(cur); }
  });
  list.addEventListener('mousedown', function (e) { e.preventDefault(); });
  list.addEventListener('click', function (e) { var li = e.target.closest('li[data-i]'); if (li) pick(shown[+li.dataset.i]); });
  input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) { close(); input.value = labelOf(cur); } }, 180); });
  var self = {
    input: input,
    get value() { return cur; },
    set value(v) { cur = v || ''; input.value = labelOf(cur); },
    setOptions: function (o, v) { opts = o || []; if (v !== undefined) cur = v || ''; if (!opts.some(function (x) { return x.value === cur; })) cur = ''; input.value = labelOf(cur); },
    onChange: function (f) { cbs.push(f); },
    focus: function () { input.focus(); }
  };
  self.setOptions(options, value);
  return self;
}
function plantComboOpts() {
  return S.boot.plants.map(function (p) { return { value: p.id, label: p.en, hint: p.group, search: [p.ta, p.te, p.ml, p.kn, p.hi, p.bot, p.group].join(' ') }; });
}
function varietyComboOpts(plantId, withNew) {
  var o = [{ value: '', label: 'Not sure / general', always: true }].concat(S.boot.varieties.filter(function (v) { return v.plantId === plantId; }).map(function (v) {
    return { value: v.id, label: varLabel(v), hint: varColours(v).join(', '), search: v.name + ' ' + v.trade + ' ' + varColours(v).join(' ') };
  }));
  if (withNew) o.push({ value: '__new', label: '+ New variety', always: true, cls: 'combo-new' });
  return o;
}
function potsOfVariety(vid) { return activePots().filter(function (p) { return p.varietyId === vid; }); }

/* ================= owner: add photos ================= */
function viewAdd(arg) {
  var b = S.boot, pre = parseArgs(arg);
  var pot = pre.pot ? (b.pots || []).filter(function (x) { return x.uid === pre.pot; })[0] : null;
  var stages = ((b.lists && b.lists['Photo stages']) || FLOWER_STAGES).filter(function (x) { return hiddenOf('Photo stages').indexOf(x) < 0; });
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  S.add = { files: [], seq: 0 };
  app.innerHTML =
    '<div class="page-h"><h1>Add photos</h1><p class="muted">Take a photo, or pick from your phone or computer. Fill the details once for all the photos you pick.</p></div>' +
    '<form id="addForm" class="form" novalidate>' +
      '<div class="pick"><label class="pick-btn"><input type="file" accept="image/*" capture="environment" id="fCam">' + icon('camera', 28) + '<span>Take photo</span></label>' +
      '<label class="pick-btn"><input type="file" accept="image/*" multiple id="fGal">' + icon('image', 28) + '<span>' + (coarse ? 'Choose from phone' : 'Choose files') + '</span></label></div>' +
      (coarse ? '' : '<div class="drop" id="drop">Or drag photos here from your computer</div>') +
      '<ul class="flist" id="flist"></ul><div id="aTool"></div>' +
      '<fieldset class="fs"><legend>Plant</legend><div class="f2">' +
        '<div class="field"><label for="aPot">Pot ref</label><input id="aPot" list="potRefs" placeholder="e.g. T036" autocomplete="off" autocapitalize="characters" value="' + esc(pot ? pot.ref : '') + '">' + potDatalist('potRefs') +
          '<p class="hint" id="aPotMsg">Optional. Fills plant, variety and colours.</p></div>' +
        comboHtml('aPlant', 'Plant', 'Type: lotus, sampangi…') + comboHtml('aVar', 'Variety', 'Type a variety name') + '</div>' +
        '<div class="newpot" id="newPotBox" hidden><p id="newPotText"></p><div class="f2">' +
          '<div class="field"><label for="npArea">Area (optional)</label><select id="npArea">' + areaOptions('') + '</select></div>' +
          '<div class="field"><label for="npSize">Pot size in inches (optional)</label><input id="npSize" type="number" inputmode="decimal" min="1"></div></div>' +
          '<button type="button" class="btn btn-primary" id="npCreate">Create pot</button></div>' +
        '<div class="newvar f2" id="newVar" hidden><div class="field"><label for="nvName">New variety name</label><input id="nvName" placeholder="e.g. Pink multi petal" autocomplete="off"><p class="hint" id="nvMsg"></p></div>' +
          '<div class="field"><label for="nvTrade">Trade name (optional)</label><input id="nvTrade" placeholder="e.g. Cherry" autocomplete="off"></div>' +
          '<div class="field"><label for="nvPetal">Petal type</label><select id="nvPetal">' + listOptions('Petal types', '', 'Not set') + '</select></div></div>' +
        '<div class="field"><span class="lbl">Colours in the photo (tap one or more)</span>' + colourPicker('aColours', []) + '</div>' +
      '</fieldset>' +
      '<fieldset class="fs"><legend>Stage</legend><div class="chips stage" role="radiogroup" aria-label="Stage">' + stages.map(function (x) {
        return '<label class="chip-r"><input type="radio" name="stage" value="' + esc(x) + '"><span>' + esc(x) + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<fieldset class="fs"><legend>Details</legend>' +
        '<div class="field"><label for="aRemark">Remark</label><textarea id="aRemark" rows="2" placeholder="Anything to remember"></textarea></div>' +
        '<label class="sw"><input type="checkbox" id="aArchive"><span><strong>Old photo (archive)</strong><br><span class="hint">Keeps its own date. Not counted for flowering.</span></span></label>' +
        '<div class="field" id="bloomBox" hidden><label for="aBloom">Same flower as</label><select id="aBloom"></select><p class="hint">Links Bud, Day 1, Day 2 … photos of one flower.</p></div>' +
        '<label class="sw" id="countBox" hidden><input type="checkbox" id="aCount"><span>Count as a new flower</span></label>' +
        '<label class="sw"><input type="checkbox" id="aFamily" checked><span>Show to family</span></label>' +
        '<label class="sw"><input type="checkbox" id="aGallery" checked><span>Show in gallery</span></label>' +
      '</fieldset>' +
      '<div class="actions"><button class="btn btn-primary lg" id="aSave" type="submit">Save photos</button></div>' +
    '</form>';
  bindAdd(pre, pot);
}

function bindAdd(pre, pot) {
  var A = S.add, curPot = pot || null, bloomToken = 0;
  var potIn = $('#aPot'), colPick = bindColourPicker('aColours');
  var plantC = Combo('aPlant', plantComboOpts(), pre.plant || (pot && pot.plantId) || '');
  var varC = Combo('aVar', varietyComboOpts(plantC.value, true), '');
  function stage() { var r = $('input[name=stage]:checked'); return r ? r.value : ''; }
  function archive() { return $('#aArchive').checked; }
  function potMsg(t, kind) { var m = $('#aPotMsg'); m.textContent = t; m.className = 'hint' + (kind ? ' ' + kind : ''); }
  function setPot(p, why) {
    curPot = p; $('#newPotBox').hidden = true;
    if (!p) return;
    potIn.value = p.ref;
    potMsg(p.ref + ': ' + p.plant + (p.variety ? ', ' + p.variety : '') + (why ? ' (' + why + ')' : ''), 'good');
  }
  function fillVarieties(sel) { varC.setOptions(varietyComboOpts(plantC.value, true), sel || ''); onVar(true); }
  function onVar(quiet) {
    var v = S.vm[varC.value];
    $('#newVar').hidden = varC.value !== '__new';
    if (varC.value === '__new') { $('#nvName').focus(); return; }
    if (v) {
      colPick.set(varColours(v));
      if (!quiet && !potIn.value.trim()) {
        var ps = potsOfVariety(v.id);
        if (ps.length === 1) setPot(ps[0], 'the only pot with this variety; clear it if not right');
      }
    }
    refreshBloom();
  }
  function firstDate() { return A.files.length ? A.files[0].date : today(); }
  function refreshBloom() {
    var st = stage(), box = $('#bloomBox'), cnt = $('#countBox');
    var flowerStage = isFlowerStage(st);
    cnt.hidden = archive() || !curPot || !flowerStage;
    if (!cnt.hidden) $('#aCount').checked = st === 'Day 1';
    if (archive() || !flowerStage || !plantC.value) { box.hidden = true; return; }
    box.hidden = false;
    var sel = $('#aBloom'), token = ++bloomToken;
    sel.innerHTML = '<option value="new">New flower</option>';
    var q = { potUid: curPot ? curPot.uid : '', varietyId: varC.value && varC.value !== '__new' ? varC.value : '', plantId: plantC.value, date: firstDate() };
    api('getOpenBlooms', S.pin, q).then(function (list) {
      if (token !== bloomToken) return;
      sel.innerHTML = '<option value="new">New flower</option>' + list.map(function (x) {
        return '<option value="' + esc(x.bloom) + '">' + esc(x.bloom + ': ' + (x.stage || 'photo') + ' on ' + fmtDate(x.date)) + '</option>';
      }).join('');
      if (NEW_BLOOM_STAGES.indexOf(st) < 0 && list.length) sel.value = list[0].bloom;
    }).catch(function () {});
  }
  function drawFiles() {
    $('#flist').innerHTML = A.files.map(function (f) {
      return '<li data-k="' + f.k + '"><img src="' + f.url + '" alt=""><div class="fm">' +
        '<label class="sm">Date<input type="date" data-f="date" value="' + esc(f.date) + '"></label>' +
        '<label class="sm">Time<input type="time" data-f="time" value="' + esc(f.time) + '"></label>' +
        '<span class="st ' + (f.status === 'done' ? 'done' : f.status === 'error' ? 'err' : '') + '">' + esc(f.msg || '') + '</span></div>' +
        '<button type="button" class="icon-btn" data-rm="' + f.k + '" aria-label="Remove this photo">' + icon('close') + '</button></li>';
    }).join('');
  }
  function addFiles(list, source) {
    var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name); });
    return Promise.all(files.map(function (file) {
      return readExif(file).then(function (ex) {
        var d = (ex && ex.date ? ex : null) || (source === 'Mobile camera' ? { date: today(), time: nowTime() } : fromTs(file.lastModified)) || { date: today(), time: nowTime() };
        A.files.push({ k: A.seq++, file: file, url: URL.createObjectURL(file), date: d.date, time: d.time, gps: ex && ex.gps, source: source, status: '', msg: '' });
      });
    })).then(function () {
      drawFiles(); refreshBloom();
      if (!A.tool && A.files[0]) A.tool = mountColourTool($('#aTool'), A.files[0].file, function (ci) {
        var names = ci.main.map(function (p) { return p.name; });
        if (names.length) colPick.set(names.filter(function (n, i) { return names.indexOf(n) === i; }));
      });
    });
  }
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  $('#fCam').addEventListener('change', function (e) { addFiles(e.target.files, 'Mobile camera'); e.target.value = ''; });
  $('#fGal').addEventListener('change', function (e) { addFiles(e.target.files, coarse ? 'Mobile gallery' : 'Computer'); e.target.value = ''; });
  var drop = $('#drop');
  if (drop) {
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files, 'Computer'); });
  }
  $('#flist').addEventListener('click', function (e) {
    var rm = e.target.closest('[data-rm]'); if (!rm) return;
    var k = +rm.dataset.rm;
    A.files = A.files.filter(function (f) { if (f.k === k) URL.revokeObjectURL(f.url); return f.k !== k; });
    drawFiles();
  });
  $('#flist').addEventListener('change', function (e) {
    var li = e.target.closest('li'), fld = e.target.dataset.f; if (!li || !fld) return;
    var f = A.files.filter(function (x) { return x.k === +li.dataset.k; })[0]; if (f) f[fld] = e.target.value;
    if (fld === 'date') refreshBloom();
  });

  // pot ref: existing pot fills the form; a new ref offers to create the pot here
  potIn.addEventListener('change', function () {
    var v = potIn.value.trim();
    $('#newPotBox').hidden = true;
    if (!v) { curPot = null; potMsg('Optional. Fills plant, variety and colours.'); refreshBloom(); return; }
    var p = findPot(v);
    if (p) {
      plantC.value = p.plantId; fillVarieties(p.varietyId); setPot(p); refreshBloom(); return;
    }
    curPot = null; refreshBloom();
    var r = parseRef(v), code = r && (S.boot.potCodes || []).filter(function (c) { return c.code === r.code; })[0];
    if (!r) { potMsg('"' + v + '" is not a pot ref. Use letters then a number, like T037.', 'bad'); return; }
    if (!code) { potMsg('There is no pot code "' + r.code + '". Add it in Masters → Pot codes first.', 'bad'); return; }
    var ref = r.code + String(r.num).padStart(+code.digits || String(v).replace(/^[A-Za-z]+/, '').length || 3, '0');
    potIn.value = ref;
    potMsg(ref + ' is a new ' + code.type.toLowerCase() + '.', 'bad');
    $('#newPotText').textContent = 'Create pot ' + ref + ' (' + code.type + ')' + (plantC.value ? ' for ' + plantName(plantC.value) + (S.vm[varC.value] ? ', ' + varLabel(S.vm[varC.value]) : '') : '') + '?';
    $('#npCreate').textContent = 'Create pot ' + ref;
    $('#newPotBox').hidden = false;
  });
  $('#npCreate').addEventListener('click', function () {
    var ref = potIn.value.trim().toUpperCase();
    if (!plantC.value) { toast('Pick the plant first, then tap Create pot.', 'err'); plantC.focus(); return; }
    var vid = varC.value && varC.value !== '__new' ? varC.value : '';
    var btn = $('#npCreate'); btn.disabled = true;
    var data = { ref: ref, plantId: plantC.value, varietyId: vid, area: $('#npArea').value, size: $('#npSize').value, potted: today(), fish: false, family: true };
    api('savePot', S.pin, data).then(function (res) {
      var v = S.vm[vid];
      var np = { uid: res.uid, ref: res.ref, area: data.area, plantId: data.plantId, plant: plantName(data.plantId), varietyId: vid, variety: v ? varLabel(v) : '',
        size: data.size, type: '', mix: '', potted: data.potted, status: 'Active', fish: 'No', lastFed: '', lastRepot: '', notes: '' };
      S.boot.pots.push(np); saveBoot(S.boot);
      $('#potRefs').insertAdjacentHTML('beforeend', '<option value="' + esc(np.ref) + '">' + esc(np.plant) + '</option>');
      setPot(np, 'new pot created'); refreshBloom();
      toast('Pot ' + res.ref + ' created.');
    }).catch(function (err) { toast(err.message, 'err'); }).then(function () { btn.disabled = false; });
  });
  plantC.onChange(function () {
    if (curPot && curPot.plantId !== plantC.value) { curPot = null; potIn.value = ''; potMsg('Pot cleared because the plant changed.'); }
    fillVarieties('');
  });
  varC.onChange(function () { onVar(false); });
  $('#nvName').addEventListener('input', function () {
    var t = $('#nvName').value.trim().toLowerCase(), m = $('#nvMsg');
    var hit = S.boot.varieties.filter(function (v) { return v.plantId === plantC.value && t && (v.name.toLowerCase() === t || String(v.trade).toLowerCase() === t); })[0];
    m.innerHTML = hit ? esc(varLabel(hit)) + ' already exists. <button type="button" class="linkbtn" id="nvUse">Use it</button>' : '';
    var use = $('#nvUse'); if (use) use.addEventListener('click', function () { varC.value = hit.id; onVar(false); });
  });
  $$('input[name=stage]').forEach(function (r) { r.addEventListener('change', refreshBloom); });
  $('#aArchive').addEventListener('change', refreshBloom);

  fillVarieties(pre.variety || (pot && pot.varietyId) || '');
  if (pot) setPot(pot);

  $('#addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var todo = A.files.filter(function (f) { return f.status !== 'done'; });
    if (!todo.length) { toast('Add at least one photo first.', 'err'); return; }
    if (!plantC.value) { toast('Pick the plant.', 'err'); plantC.focus(); return; }
    if (potIn.value.trim() && !curPot) { toast('Create the new pot first, or clear the pot ref.', 'err'); return; }
    var btn = $('#aSave'); btn.disabled = true;
    var st = stage(), arch = archive(), pid = plantC.value;
    var bloom = !arch && !$('#bloomBox').hidden ? $('#aBloom').value : '';
    var count = !arch && !$('#countBox').hidden && $('#aCount').checked && !!curPot;
    var ok = 0, bad = 0;
    var start = Promise.resolve(varC.value);
    if (varC.value === '__new') {
      var name = $('#nvName').value.trim();
      if (!name) { btn.disabled = false; toast('Type the new variety name.', 'err'); $('#nvName').focus(); return; }
      btn.textContent = 'Saving variety…';
      var nc = colPick.get();
      var nv = { plantId: pid, name: name, trade: $('#nvTrade').value.trim(), colours: nc, colour: nc[0] || '', colour2: nc.slice(1).join(', '), petal: $('#nvPetal').value };
      start = api('saveVariety', S.pin, nv).then(function (id) {
        nv.id = id; nv.photo = ''; if (!S.vm[id]) { S.boot.varieties.push(nv); S.vm[id] = nv; }
        fillVarieties(id); return id;
      });
    }
    start.then(function (varietyId) {
      var v = S.vm[varietyId];
      var base = { potUid: curPot ? curPot.uid : '', potNo: curPot ? curPot.ref : '', plantId: pid, plantName: plantName(pid),
        varietyId: varietyId || '', varietyFolder: v ? varietyId + ' ' + (v.trade || v.name) : 'General', stage: st, colour: colPick.get(),
        colourCodes: A.tool ? A.tool.get().main.map(function (p) { return p.hex; }) : [],
        edge: A.tool ? A.tool.get().edge.map(function (p) { return p.name; }) : [], centre: A.tool ? A.tool.get().centre.map(function (p) { return p.name; }) : [],
        remark: $('#aRemark').value.trim(), archive: arch, family: $('#aFamily').checked, gallery: $('#aGallery').checked };
      var n = todo.length, started = 0;
      function one(f, first) {
        f.msg = 'Uploading…'; f.status = ''; drawFiles();
        var meta = Object.assign({}, base, { date: f.date, time: f.time, source: f.source, bloom: bloom, countFlower: first && count, who: whoAmI(), gps: f.gps });
        var imgs;
        return prepareImages(f.file, Object.assign({ shotBy: whoAmI() }, meta)).then(function (r) {
          imgs = r;
          return api('savePhoto', S.pin, meta, r.clean);
        }).then(function (res) {
          if (!imgs.labelled) return res;
          return api('saveLabel', S.pin, res.fileId, imgs.labelled).then(function (lid) { res.labelId = lid; return res; }, function () { return res; });
        }).then(function (res) {
          if (bloom === 'new' && res.bloom) {
            bloom = res.bloom;
            var sel = $('#aBloom'); if (sel) { sel.insertAdjacentHTML('beforeend', '<option value="' + esc(res.bloom) + '">' + esc(res.bloom + ': ' + (st || 'photo') + ' on ' + fmtDate(f.date)) + '</option>'); sel.value = res.bloom; }
          }
          if (first) count = false;
          f.status = 'done'; f.msg = 'Saved'; ok++;
          S.boot.photos.unshift(Object.assign({}, base, { date: f.date, time: f.time, colour: base.colour.join(', '), colourCodes: (base.colourCodes || []).join(', '),
            edge: (base.edge || []).join(', '), centre: (base.centre || []).join(', '), shotBy: whoAmI(), bloom: res.bloom, fileId: res.fileId, labelId: res.labelId || '' }));
        }).catch(function (err) { f.status = 'error'; f.msg = 'Not saved: ' + err.message; bad++; }).then(function () {
          drawFiles(); btn.textContent = 'Saved ' + (ok + bad) + ' of ' + n + '…';
        });
      }
      // first photo alone (it may start a new flower ID), then up to 3 at a time
      return one(todo[0], true).then(function () {
        var rest = todo.slice(1), i = 0;
        function worker() { if (i >= rest.length) return Promise.resolve(); var f = rest[i++]; return one(f, false).then(worker); }
        return Promise.all([worker(), worker(), worker()]);
      });
    }).then(function () {
      saveBoot(S.boot);
      if (bad) toast(ok + ' saved, ' + bad + ' not saved. Tap Save photos again to retry.', 'err');
      else {
        toast(ok + (ok === 1 ? ' photo saved.' : ' photos saved.'));
        A.files.forEach(function (f) { URL.revokeObjectURL(f.url); });
        A.files = []; drawFiles(); A.tool = null; $('#aTool').innerHTML = '';
        $('#aRemark').value = '';
      }
    }).catch(function (err) { toast(err.message, 'err'); })
      .then(function () { btn.disabled = false; btn.textContent = 'Save photos'; });
  });
}

/* ================= owner: log ================= */
function viewLog(arg) {
  var b = S.boot, pre = parseArgs(arg), tab = pre.tab || 'work';
  var acts = (b.lists && b.lists['Activities']) || ['Feed', 'Spray', 'Prune', 'Repot', 'Other'];
  var inputs = (b.inputs || []).slice().sort(function (x, y) { return String(x.cat).localeCompare(String(y.cat)) || String(x.name).localeCompare(String(y.name)); });
  var cats = {}; inputs.forEach(function (i) { (cats[i.cat || 'Other'] = cats[i.cat || 'Other'] || []).push(i); });
  var prodOpts = '<option value="">Not needed</option>' + Object.keys(cats).map(function (c) {
    return '<optgroup label="' + esc(c) + '">' + cats[c].map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>'; }).join('') + '</optgroup>';
  }).join('');
  var tabs = [['work', 'Work done'], ['flowers', 'Flower count'], ['fish', 'Fish']];
  app.innerHTML = '<div class="page-h"><h1>Log</h1><p class="muted">Record work done, flowers counted, or fish changes.</p></div>' +
    '<div class="tabs" role="tablist" aria-label="Log type" style="max-width:760px">' + tabs.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="logBody" style="margin-top:18px"></div>' + potDatalist('potRefs');

  function potField(id, val, label, hint) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" list="potRefs" autocomplete="off" autocapitalize="characters" value="' + esc(val || '') + '" placeholder="e.g. T036"><p class="hint" id="' + id + 'Msg">' + esc(hint || '') + '</p></div>';
  }
  function resolveOne(id) {
    var v = $('#' + id).value.trim(), p = findPot(v), m = $('#' + id + 'Msg');
    if (!v) { m.textContent = ''; return null; }
    if (!p) { m.textContent = 'No active pot "' + v + '".'; m.className = 'hint bad'; return null; }
    $('#' + id).value = p.ref; m.textContent = p.plant + (p.variety ? ', ' + p.variety : ''); m.className = 'hint good'; return p;
  }
  function draw() {
    $$('[data-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === tab)); });
    var body = $('#logBody');
    if (tab === 'work') {
      body.innerHTML = '<form id="wForm" class="form"><div class="f2"><div class="field"><label for="wDate">Date</label><input type="date" id="wDate" value="' + today() + '"></div>' +
        '<div class="field"><label for="wArea">Whole area (instead of pots)</label><select id="wArea">' + areaOptions('', 'No, only the pots below') + '</select></div></div>' +
        '<div class="field"><label for="wPots">Pot refs</label><input id="wPots" autocomplete="off" autocapitalize="characters" placeholder="e.g. T036, T037, B03" value="' + esc(pre.pot || '') + '"><p class="hint">Separate with commas or spaces.</p><div class="chips" id="wChips"></div></div>' +
        '<fieldset class="fs"><legend>What was done</legend><div class="chips stage" role="radiogroup" aria-label="What was done">' + acts.map(function (a, i) {
          return '<label class="chip-r"><input type="radio" name="act" value="' + esc(a) + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(a) + '</span></label>';
        }).join('') + '</div></fieldset>' +
        '<div class="f2" id="wProd"><div class="field"><label for="wProduct">Product used</label><select id="wProduct">' + prodOpts + '</select></div>' +
        '<div class="field"><label for="wQty">Quantity</label><input id="wQty" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 1"></div>' +
        '<div class="field"><label for="wUnit">Unit</label><select id="wUnit">' + unitOptions('handful') + '</select></div></div>' +
        '<p class="hint" id="wFish"></p>' +
        '<div class="field"><label for="wNotes">Notes</label><textarea id="wNotes" rows="2"></textarea></div>' +
        '<div class="actions"><button class="btn btn-primary lg" type="submit">Save work</button></div></form>';
      var potsIn = $('#wPots');
      var parse = function () {
        var refs = potsIn.value.split(/[\s,]+/).filter(Boolean), found = [], miss = [];
        refs.forEach(function (r) { var p = findPot(r); if (p) { if (found.indexOf(p) < 0) found.push(p); } else miss.push(r); });
        $('#wChips').innerHTML = found.map(function (p) { return '<span class="badge b-leaf">' + esc(p.ref + ' ' + p.plant) + '</span>'; }).join('') +
          miss.map(function (r) { return '<span class="badge b-err">' + esc(r) + ' not found</span>'; }).join('');
        var prod = (S.boot.inputs || []).filter(function (i) { return i.id === $('#wProduct').value; })[0];
        var fishPots = found.filter(function (p) { return String(p.fish).toLowerCase() === 'yes'; });
        $('#wFish').textContent = prod && String(prod.fish).toLowerCase() === 'no' && fishPots.length ? 'Careful: ' + prod.name + ' is not safe near fish, and ' + fishPots.map(function (p) { return p.ref; }).join(', ') + ' has fish.' : '';
        $('#wFish').className = 'hint bad';
        return { found: found, miss: miss };
      };
      potsIn.addEventListener('input', parse); $('#wProduct').addEventListener('change', parse); parse();
      $('#wForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var r = parse(), area = $('#wArea').value, act = ($('input[name=act]:checked') || {}).value;
        if (r.miss.length) { toast('Fix the pot refs that were not found.', 'err'); return; }
        if (!r.found.length && !area) { toast('Enter at least one pot ref, or pick a whole area.', 'err'); return; }
        var btn = $('button[type=submit]', body); btn.disabled = true;
        api('saveActivity', S.pin, { date: $('#wDate').value, potUids: r.found.map(function (p) { return p.uid; }), areaId: area, activity: act,
          productId: $('#wProduct').value, qty: $('#wQty').value, unit: $('#wQty').value ? $('#wUnit').value : '', notes: $('#wNotes').value.trim() })
          .then(function (n) { toast('Saved for ' + (r.found.length ? n + (n === 1 ? ' pot.' : ' pots.') : 'the whole area.')); potsIn.value = ''; $('#wNotes').value = ''; parse(); refreshBoot(); })
          .catch(function (err) { toast(err.message, 'err'); }).then(function () { btn.disabled = false; });
      });
    } else if (tab === 'flowers') {
      body.innerHTML = '<form id="flForm" class="form"><div class="f2"><div class="field"><label for="flDate">Date</label><input type="date" id="flDate" value="' + today() + '"></div>' +
        potField('flPot', pre.pot, 'Pot ref') + '<div class="field"><label for="flN">Flowers counted</label><input id="flN" type="number" inputmode="numeric" min="1" value="1"></div></div>' +
        '<div class="field"><label for="flNotes">Notes</label><textarea id="flNotes" rows="2"></textarea></div>' +
        '<p class="hint">Day 1 photos already add a count when "Count as a new flower" is ticked. Use this for flowers you did not photograph.</p>' +
        '<div class="actions"><button class="btn btn-primary lg" type="submit">Save count</button></div></form>';
      $('#flPot').addEventListener('change', function () { resolveOne('flPot'); });
      $('#flForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var p = resolveOne('flPot'); if (!p) { toast('Enter a valid pot ref.', 'err'); return; }
        api('saveFlowers', S.pin, { date: $('#flDate').value, potUid: p.uid, flowers: $('#flN').value, notes: $('#flNotes').value.trim() })
          .then(function () { toast('Flower count saved.'); $('#flNotes').value = ''; }).catch(function (err) { toast(err.message, 'err'); });
      });
    } else {
      var fishOpts = (b.fishTypes || []).map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.name + (f.strain ? ' (' + f.strain + ')' : '')) + '</option>'; }).join('');
      body.innerHTML = '<form id="fiForm" class="form"><div class="f2"><div class="field"><label for="fiDate">Date</label><input type="date" id="fiDate" value="' + today() + '"></div>' +
        potField('fiPot', pre.pot, 'Pot ref') + '<div class="field"><label for="fiFish">Fish</label><select id="fiFish">' + fishOpts + '</select></div>' +
        '<div class="field"><label for="fiEvent">What happened</label><select id="fiEvent">' + listOptions('Fish events', 'Added') + '</select></div>' +
        '<div class="field"><label for="fiN">How many</label><input id="fiN" type="number" inputmode="numeric" min="1" value="1"></div></div>' +
        '<div class="field"><label for="fiNotes">Notes</label><textarea id="fiNotes" rows="2"></textarea></div>' +
        '<div class="actions"><button class="btn btn-primary lg" type="submit">Save fish log</button></div></form>';
      $('#fiPot').addEventListener('change', function () { resolveOne('fiPot'); });
      $('#fiForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var p = resolveOne('fiPot'); if (!p) { toast('Enter a valid pot ref.', 'err'); return; }
        api('saveFish', S.pin, { date: $('#fiDate').value, potUid: p.uid, fishId: $('#fiFish').value, event: $('#fiEvent').value, count: $('#fiN').value, notes: $('#fiNotes').value.trim() })
          .then(function () { toast('Fish log saved.'); $('#fiNotes').value = ''; refreshBoot(); }).catch(function (err) { toast(err.message, 'err'); });
      });
    }
  }
  $$('[data-tab]').forEach(function (t) { t.addEventListener('click', function () { tab = t.dataset.tab; draw(); }); });
  draw();
}

/* ================= owner: pots ================= */
function viewPots() {
  var b = S.boot, codes = b.potCodes || [];
  app.innerHTML = '<div class="page-h"><h1>Pots</h1><p class="muted">Search by pot ref, like T036 or t36.</p></div>' +
    '<details class="addbox"' + ((b.pots || []).length ? '' : ' open') + '><summary>' + icon('plus') + '&nbsp;Add a pot</summary>' +
      (codes.length ? '<form id="pForm" class="form"><div class="f2">' +
        '<div class="field"><label for="pCode">Pot type</label><select id="pCode">' + codes.map(function (c) { return '<option value="' + esc(c.code) + '">' + esc(c.code + ' – ' + c.type) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="pRef">Pot ref</label><input id="pRef" autocomplete="off" autocapitalize="characters"><p class="hint" id="pRefMsg"></p></div>' +
        comboHtml('pPlant', 'Plant', 'Type: lotus, sampangi…') + comboHtml('pVar', 'Variety', 'Type a variety name') +
        '<div class="field"><label for="pArea">Area</label><select id="pArea">' + areaOptions('') + '</select></div>' +
        '<div class="field"><label for="pSize">Pot size (inch)</label><input id="pSize" type="number" inputmode="decimal" min="1"></div>' +
        '<div class="field"><label for="pDate">Potted on</label><input id="pDate" type="date" value="' + today() + '"></div></div>' +
        '<div class="field"><label for="pMix">Potting mix used</label><input id="pMix"></div>' +
        '<label class="sw"><input type="checkbox" id="pFish"><span>Has fish</span></label>' +
        '<label class="sw"><input type="checkbox" id="pFamily" checked><span>Show to family</span></label>' +
        '<div class="field"><label for="pNotes">Notes</label><textarea id="pNotes" rows="2"></textarea></div>' +
        '<button class="btn btn-primary lg" type="submit">Add pot</button></form>'
        : '<p class="form muted">Add your pot codes (T, B, S …) in the "Pot codes" tab of the Sheet first.</p>') +
    '</details>' +
    '<div class="f2" style="margin-top:20px;max-width:760px"><div class="field"><label for="psq">Search</label><input id="psq" type="search" placeholder="Pot ref or plant" autocomplete="off"></div>' +
      '<div class="field"><label for="pss">Show</label><select id="pss"><option value="Active">Active pots</option><option value="">All pots</option></select></div></div>' +
    (codes.length ? '<div style="margin-top:12px">' + chipRow('pst', [['all', 'All types']].concat(codes.map(function (c) { return [c.code, c.type]; })), 'all', 'Pot type') + '</div>' : '') +
    '<p class="muted sm" id="pcount" role="status" style="margin:14px 0 10px"></p><div class="grid g-cards" id="pgrid"></div>';
  var ft = 'all';
  function draw() {
    var q = $('#psq').value.trim().toLowerCase(), st = $('#pss').value, r = parseRef(q);
    var list = (S.boot.pots || []).filter(function (p) {
      if (st && (p.status || 'Active') !== st) return false;
      var pr = parseRef(p.ref);
      if (ft !== 'all' && !(pr && pr.code === ft)) return false;
      if (!q) return true;
      if (r && pr && r.code === pr.code && r.num === pr.num) return true;
      return (p.ref + ' ' + p.plant + ' ' + p.variety).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b2) { return String(a.ref).localeCompare(String(b2.ref), undefined, { numeric: true }); });
    $('#pgrid').innerHTML = list.map(function (p) {
      return '<a class="card potcard" href="#/pot/' + esc(p.uid) + '"><span class="potref">' + esc(p.ref) + '</span><span class="muted sm">' + esc(p.type || '') + '</span>' +
        '<strong>' + esc(p.plant || '') + '</strong>' + (p.variety ? '<span class="sm">' + esc(p.variety) + '</span>' : '') +
        '<span class="muted sm">Last fed: ' + esc(fmtDate(p.lastFed) || '–') + '</span>' + (String(p.fish).toLowerCase() === 'yes' ? '<span class="badge b-water">Fish</span>' : '') + '</a>';
    }).join('') || '<div class="empty">No pots match.</div>';
    $('#pcount').textContent = list.length + (list.length === 1 ? ' pot' : ' pots');
  }
  $('#psq').addEventListener('input', draw); $('#pss').addEventListener('change', draw);
  bindChips('pst', function (v) { ft = v; draw(); });
  draw();

  var form = $('#pForm'); if (!form) return;
  function suggest() { $('#pRef').value = nextRef($('#pCode').value); checkRef(); }
  function checkRef() {
    var v = $('#pRef').value.trim().toUpperCase(), m = $('#pRefMsg');
    var used = activePots().some(function (p) { return String(p.ref).toUpperCase() === v; });
    m.textContent = used ? v + ' is already used by an active pot.' : (v ? 'Free to use.' : ''); m.className = 'hint ' + (used ? 'bad' : 'good');
  }
  $('#pCode').addEventListener('change', suggest); $('#pRef').addEventListener('input', checkRef);
  var pPlantC = Combo('pPlant', plantComboOpts(), ''), pVarC = Combo('pVar', varietyComboOpts('', false), '');
  pPlantC.onChange(function () {
    pVarC.setOptions(varietyComboOpts(pPlantC.value, false), '');
    var pl = S.pm[pPlantC.value]; if (pl && !$('#pMix').value) $('#pMix').value = pl.mix || '';
  });
  suggest();
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pPlantC.value) { toast('Pick the plant.', 'err'); pPlantC.focus(); return; }
    var btn = $('button[type=submit]', form); btn.disabled = true;
    var data = { ref: $('#pRef').value, plantId: pPlantC.value, varietyId: pVarC.value, area: $('#pArea').value, size: $('#pSize').value,
      potted: $('#pDate').value, mix: $('#pMix').value.trim(), fish: $('#pFish').checked, family: $('#pFamily').checked, notes: $('#pNotes').value.trim() };
    api('savePot', S.pin, data).then(function (res) {
      toast('Pot ' + res.ref + ' added.');
      var pl = S.pm[data.plantId] || {}, v = S.vm[data.varietyId];
      S.boot.pots.push({ uid: res.uid, ref: res.ref, area: data.area, plantId: data.plantId, plant: pl.en || '', varietyId: data.varietyId, variety: v ? varLabel(v) : '',
        size: data.size, type: '', mix: data.mix, potted: data.potted, status: 'Active', fish: data.fish ? 'Yes' : 'No', lastFed: '', lastRepot: '', notes: data.notes });
      refreshBoot().then(function () { if (route().page === 'pots') render(); });
    }).catch(function (err) { toast(err.message, 'err'); }).then(function () { btn.disabled = false; });
  });
}

function viewPot(uid) {
  var p = (S.boot.pots || []).filter(function (x) { return x.uid === uid; })[0]; if (!p) return viewNotFound();
  var facts = [['Plant', p.plant], ['Variety', p.variety], ['Pot type', p.type], ['Area', p.area], ['Pot size', p.size ? p.size + ' inch' : ''], ['Potted on', fmtDate(p.potted)],
    ['Status', p.status], ['Has fish', p.fish], ['Last fed', fmtDate(p.lastFed)], ['Last repot', fmtDate(p.lastRepot)], ['Plant cost', money(p.cost)], ['Potting mix', p.mix]];
  app.innerHTML = '<a class="back" href="#/pots">' + icon('back') + 'All pots</a>' +
    '<div class="page-h"><h1>' + esc(p.ref) + '</h1><p class="muted">' + esc([p.plant, p.variety].filter(Boolean).join(', ')) + '</p>' +
    '<div class="row gap"><a class="btn btn-primary" href="#/add/pot=' + esc(uid) + '">' + icon('camera') + 'Add photo</a><a class="btn" href="#/log/pot=' + esc(p.ref) + '">Log work</a>' +
    (p.plantId ? '<a class="btn" href="#/plant/' + esc(p.plantId) + '">Care guide</a>' : '') + '</div></div>' +
    '<div class="grid g-cards">' + facts.filter(function (f) { return f[1]; }).map(function (f) { return '<div class="fact"><span class="k">' + esc(f[0]) + '</span><span class="v">' + esc(f[1]) + '</span></div>'; }).join('') + '</div>' +
    (p.notes ? '<p style="margin-top:12px">' + esc(p.notes) + '</p>' : '') +
    '<section class="sec"><details class="addbox"><summary>Change pot ref or move to a new pot</summary><form id="rnForm" class="form"><div class="f2">' +
      '<div class="field"><label for="rnRef">New pot ref</label><input id="rnRef" autocomplete="off" autocapitalize="characters" placeholder="e.g. B05"></div>' +
      '<div class="field"><label for="rnDate">Date</label><input id="rnDate" type="date" value="' + today() + '"></div></div>' +
      '<div class="field"><label for="rnWhy">Reason</label><input id="rnWhy" placeholder="e.g. Repotted into a bowl"></div>' +
      '<p class="hint">The plant keeps all its photos and history.</p><button class="btn btn-primary" type="submit">Save new ref</button></form></details></section>' +
    '<section class="sec"><h2>History</h2><div id="tl"><p class="muted">Loading…</p></div></section>';
  $('#rnForm').addEventListener('submit', function (e) {
    e.preventDefault();
    api('renumberPot', S.pin, uid, $('#rnRef').value, $('#rnWhy').value.trim(), $('#rnDate').value).then(function (ref) {
      toast('Pot ref changed to ' + ref + '.'); p.ref = ref; refreshBoot().then(function () { if (route().arg === uid) render(); });
    }).catch(function (err) { toast(err.message, 'err'); });
  });
  api('getPotTimeline', S.pin, uid).then(function (items) {
    if (route().arg !== uid) return;
    var photos = items.filter(function (x) { return x.kind === 'photo' && x.fileId; }).map(function (x) {
      return { fileId: x.fileId, date: x.date, time: x.time, plantId: p.plantId, varietyId: p.varietyId, stage: x.text, archive: x.archive, potNo: p.ref };
    });
    S.lists.pot = photos;
    var pi = 0, LBL = { photo: 'Photo', work: 'Work', flower: 'Flowers', fish: 'Fish', renumber: 'Pot ref' };
    $('#tl').innerHTML = items.length ? '<ul class="tl">' + items.map(function (x) {
      var thumb = x.kind === 'photo' && x.fileId ? '<button type="button" class="thumb" data-act="lb" data-lb="pot" data-i="' + (pi++) + '" aria-label="Open photo"><img src="' + imgUrl(x.fileId, 200) + '" alt="" loading="lazy"></button>' : '';
      return '<li><span class="when">' + esc(fmtDate(x.date)) + (x.time ? '<br>' + esc(x.time) : '') + '</span>' + thumb +
        '<div><strong>' + LBL[x.kind] + (x.archive ? ' (old)' : '') + '</strong><br><span class="sm">' + esc(x.text || '') + '</span></div></li>';
    }).join('') + '</ul>' : '<p class="muted">Nothing logged for this pot yet.</p>';
  }).catch(function (err) { $('#tl').innerHTML = '<p class="hint bad">' + esc(err.message) + '</p>'; });
}

/* ================= owner: buy ================= */
var CAT_TO_INPUT = { 'Potting mix': 'Potting mix', 'Fertilizer': 'Organic fertilizer', 'Bio-fertilizer': 'Bio-fertilizer', 'Bio-control': 'Bio-control' };
function viewBuy() {
  var b = S.boot;
  app.innerHTML = '<div class="page-h"><h1>Buy</h1><p class="muted">Log anything you buy: plants, pots, soil, fertilizer, fish, tools.</p></div>' +
    '<form id="bForm" class="form"><div class="f2">' +
      '<div class="field"><label for="bDate">Date</label><input type="date" id="bDate" value="' + today() + '"></div>' +
      '<div class="field"><label for="bVendor">Bought from</label><select id="bVendor"><option value="">Not set</option>' +
        (b.vendors || []).map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.name + (v.city ? ', ' + v.city : '')) + '</option>'; }).join('') +
        '<option value="__new">+ New vendor</option></select></div></div>' +
      '<fieldset class="fs" id="nvBox" hidden><legend>New vendor</legend><div class="f2">' +
        '<div class="field"><label for="vName">Vendor name</label><input id="vName"></div><div class="field"><label for="vContact">Contact person</label><input id="vContact"></div>' +
        '<div class="field"><label for="vMobile">Mobile</label><input id="vMobile" type="tel" inputmode="tel"></div><div class="field"><label for="vEmail">Email</label><input id="vEmail" type="email"></div>' +
        '<div class="field"><label for="vArea">Area</label><input id="vArea"></div><div class="field"><label for="vCity">City</label><input id="vCity" value="Chennai"></div>' +
        '<div class="field"><label for="vState">State</label><input id="vState" value="Tamil Nadu"></div><div class="field"><label for="vWeb">Website</label><input id="vWeb" type="url" inputmode="url"></div>' +
        '<div class="field"><label for="vFound">Found through</label><select id="vFound">' + listOptions('Found through', '', 'Not set') + '</select></div>' +
        '<div class="field"><label for="vType">Vendor type</label><select id="vType">' + listOptions('Vendor types', '', 'Not set') + '</select></div></div></fieldset>' +
      '<div class="f2"><div class="field"><label for="bCat">Category</label><select id="bCat">' + listOptions('Purchase categories', 'Plant') + '</select></div>' +
        '<div class="field"><label for="bItem">Item</label><select id="bItem"></select></div>' +
        '<div class="field"><label for="bName">Item name</label><input id="bName" placeholder="What you bought"></div>' +
        '<div class="field"><label for="bQty">Quantity</label><input id="bQty" type="number" inputmode="decimal" min="0" step="any" value="1"></div>' +
        '<div class="field"><label for="bUnit">Unit</label><select id="bUnit">' + unitOptions('piece') + '</select></div>' +
        '<div class="field"><label for="bTotal">Total paid (₹)</label><input id="bTotal" type="number" inputmode="decimal" min="0" step="any"></div>' +
        '<div class="field"><label for="bPot">For pot (optional)</label><input id="bPot" list="potRefs" autocomplete="off" autocapitalize="characters" placeholder="e.g. T036"><p class="hint" id="bPotMsg"></p></div>' +
        '<div class="field"><label for="bBill">Bill photo (optional)</label><input id="bBill" type="file" accept="image/*"></div></div>' + potDatalist('potRefs') +
      '<div class="field"><label for="bNotes">Notes</label><textarea id="bNotes" rows="2"></textarea></div>' +
      '<div class="actions"><button class="btn btn-primary lg" type="submit">Save purchase</button></div></form>' +
    '<section class="sec"><h2>Recent purchases</h2>' + ((b.purchases || []).length ? '<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Item</th><th>From</th><th>Qty</th><th>Paid</th></tr></thead><tbody>' +
      b.purchases.map(function (x) { return '<tr><td>' + esc(fmtDate(x.date)) + '</td><td>' + esc(x.itemName) + '<br><span class="muted sm">' + esc(x.category) + '</span></td><td>' + esc(x.vendor || '–') + '</td><td>' + esc([x.qty, x.unit].join(' ')) + '</td><td>' + esc(money(x.total)) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="muted">No purchases yet.</p>') + '</section>';

  function items() {
    var cat = $('#bCat').value, opts = '<option value="">Other / not listed</option>';
    if (cat === 'Plant' || cat === 'Bulb / seed') opts += S.boot.varieties.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(plantName(v.plantId) + ': ' + varLabel(v)) + '</option>'; }).join('');
    else if (CAT_TO_INPUT[cat]) opts += (S.boot.inputs || []).filter(function (i) { return i.cat === CAT_TO_INPUT[cat]; }).map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>'; }).join('');
    else if (cat === 'Fish') opts += (S.boot.fishTypes || []).map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.name) + '</option>'; }).join('');
    $('#bItem').innerHTML = opts;
  }
  $('#bCat').addEventListener('change', items); items();
  $('#bItem').addEventListener('change', function () { var o = $('#bItem').selectedOptions[0]; if ($('#bItem').value && o) $('#bName').value = o.textContent; });
  $('#bVendor').addEventListener('change', function () { $('#nvBox').hidden = $('#bVendor').value !== '__new'; });
  $('#bPot').addEventListener('change', function () {
    var v = $('#bPot').value.trim(), p = findPot(v), m = $('#bPotMsg');
    m.textContent = !v ? '' : p ? p.plant : 'No active pot "' + v + '".'; m.className = 'hint ' + (!v ? '' : p ? 'good' : 'bad'); if (p) $('#bPot').value = p.ref;
  });
  $('#bForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var potV = $('#bPot').value.trim(), pot = potV ? findPot(potV) : null;
    if (potV && !pot) { toast('Fix the pot ref, or leave it empty.', 'err'); return; }
    var isNew = $('#bVendor').value === '__new';
    if (isNew && !$('#vName').value.trim()) { toast('Type the new vendor name.', 'err'); return; }
    var data = { date: $('#bDate').value, vendorId: isNew ? '' : $('#bVendor').value, category: $('#bCat').value, itemId: $('#bItem').value,
      itemName: $('#bName').value.trim(), qty: $('#bQty').value, unit: $('#bUnit').value, total: $('#bTotal').value, potUid: pot ? pot.uid : '', notes: $('#bNotes').value.trim(),
      newVendor: isNew ? { name: $('#vName').value.trim(), contact: $('#vContact').value.trim(), mobile: $('#vMobile').value.trim(), email: $('#vEmail').value.trim(),
        area: $('#vArea').value.trim(), city: $('#vCity').value.trim(), state: $('#vState').value.trim(), web: $('#vWeb').value.trim(), found: $('#vFound').value, type: $('#vType').value } : null };
    if (!data.itemName && !data.itemId) { toast('Enter what you bought.', 'err'); return; }
    var btn = $('button[type=submit]', $('#bForm')); btn.disabled = true;
    var bill = $('#bBill').files[0];
    (bill ? resizeToJpeg(bill, 1600, 0.8) : Promise.resolve('')).then(function (b64) { return api('savePurchase', S.pin, data, b64); })
      .then(function (res) { toast('Purchase ' + res.id + ' saved.'); return refreshBoot().then(function () { if (route().page === 'buy') render(); }); })
      .catch(function (err) { toast(err.message, 'err'); }).then(function () { btn.disabled = false; });
  });
}

/* ================= owner: inputs ================= */
function viewInputs() {
  var list = S.boot.inputs || [], cats = [];
  list.forEach(function (i) { if (i.cat && cats.indexOf(i.cat) < 0) cats.push(i.cat); });
  app.innerHTML = '<div class="page-h"><h1>Inputs and stock</h1><p class="muted">Potting mix, fertilizers and bio-controls. Stock is rough: bought minus used.</p></div>' +
    chipRow('ifil', [['all', 'All'], ['low', 'Running low']].concat(cats.map(function (c) { return [c, c]; })), 'all', 'Filter inputs') +
    '<div id="ilist" style="margin-top:16px"></div>';
  var f = 'all';
  function draw() {
    var rows = list.filter(function (i) { return f === 'all' || (f === 'low' ? i.status === 'Running low' : i.cat === f); });
    $('#ilist').innerHTML = rows.map(function (i) {
      var info = [['What it does', i.what], ['How to use', i.how], ['Normal dose', i.dose], ['How often', i.often], ['Best season', i.season],
        ['Safe near fish pots', i.fish], ['Shelf life', i.shelf], ['Storage', i.storage], ['Brand', i.brand], ['Notes', i.notes]].filter(function (x) { return x[1]; });
      var pill = i.status === 'Running low' ? '<span class="badge b-err">Running low</span>' : i.status === 'OK' ? '<span class="badge b-leaf">OK</span>' : '';
      return '<details class="care"><summary><span>' + esc(i.name) + ' <span class="muted sm">' + esc(i.cat) + '</span></span><span class="row gap sm">' + esc(qtyText(i.stock)) + ' ' + pill + '</span></summary>' +
        '<div class="body">' + info.map(function (x) { return '<p><strong>' + esc(x[0]) + ':</strong> ' + esc(x[1]) + '</p>'; }).join('') +
        '<p class="muted sm" style="margin-top:8px">Bought ' + esc(qtyText(i.bought)) + ', used ' + esc(qtyText(i.used)) + (i.low !== '' ? ', alert below ' + esc(qtyText(i.low)) : '') + '.</p></div></details>';
    }).join('') || '<div class="empty">Nothing here.</div>';
  }
  bindChips('ifil', function (v) { f = v; draw(); });
  draw();
}

/* ================= owner: dashboard (placeholder) ================= */
function viewDash() {
  var b = S.boot, ym = today().slice(0, 7);
  var month = b.photos.filter(function (p) { return String(p.date).slice(0, 7) === ym; });
  var live = month.filter(function (p) { return !p.archive; });
  var spent = (b.purchases || []).filter(function (x) { return String(x.date).slice(0, 7) === ym; }).reduce(function (s, x) { return s + (+x.total || 0); }, 0);
  var low = (b.inputs || []).filter(function (i) { return i.status === 'Running low'; });
  app.innerHTML = '<div class="page-h"><h1>Dashboard</h1><p class="muted">A first look. Flowering charts and growth trends come in the next step.</p></div>' +
    '<dl class="stats">' + stat(live.length, 'new photos this month') + stat(month.length - live.length, 'old photos added this month') +
    stat(b.photoCount, 'photos in total') + stat(money(spent) || '₹0', 'spent this month') + stat(low.length, 'inputs running low') + '</dl>' +
    (low.length ? '<section class="sec"><h2>Running low</h2><div class="chips">' + low.map(function (i) { return '<span class="badge b-err">' + esc(i.name) + '</span>'; }).join('') + '</div></section>' : '');
}

/* ================= gallery: one sliding row per plant ================= */
function galSpeed() { var v = 3; try { v = +localStorage.getItem('g109a_speed') || 3; } catch (e) {} return Math.min(10, Math.max(1, v)); }
function viewGallery(arg) {
  var groups = [];
  S.boot.plants.forEach(function (p) { if (p.group && groups.indexOf(p.group) < 0) groups.push(p.group); });
  var group = decodeURIComponent(parseArgs(arg).group || '');
  var speed = galSpeed(), paused = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  app.innerHTML = '<div class="page-h"><h1>Gallery</h1><p class="muted">One row for each plant. Rows slide by themselves. Tap a photo to see it big.</p></div>' +
    '<div class="gl-bar"><div class="field gl-grp"><label for="glGroup">Group</label><select id="glGroup"><option value="">All groups</option>' +
      groups.map(function (g) { return '<option' + (g === group ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></div>' +
    '<div class="gl-ctl" role="group" aria-label="Slideshow controls">' +
      '<button type="button" data-gl="back" aria-label="Back one photo">' + icon('back') + '</button>' +
      '<button type="button" data-gl="pause" aria-label="Pause">' + icon('pause') + '</button>' +
      '<button type="button" data-gl="next" aria-label="Forward one photo">' + icon('next') + '</button>' +
      '<span class="gl-sep" aria-hidden="true"></span>' +
      '<button type="button" data-gl="slower" aria-label="Slower">Slower</button>' +
      '<span class="gl-speed" id="glSpeed" aria-live="polite">' + speed + ' s</span>' +
      '<button type="button" data-gl="faster" aria-label="Faster">Faster</button></div></div>' +
    '<div id="glRows"><p class="muted">Loading photos…</p></div><div id="glMore" style="margin:18px 0"></div>';

  var rows = [], shown = 0, visible = {}, reduce = paused;
  function setPaused(v) {
    paused = v; var b = $('[data-gl="pause"]');
    if (b) { b.innerHTML = icon(v ? 'play' : 'pause'); b.setAttribute('aria-label', v ? 'Play' : 'Pause'); }
  }
  function step(strip, dir) {
    var card = strip.querySelector('.gl-card'); if (!card) return;
    var w = card.getBoundingClientRect().width + 10, max = strip.scrollWidth - strip.clientWidth;
    if (max <= 2) return;
    var next = strip.scrollLeft + dir * w;
    if (next > max + 2) next = 0; else if (next < -2) next = max;
    if (strip.scrollTo) strip.scrollTo({ left: next, behavior: reduce ? 'auto' : 'smooth' }); else strip.scrollLeft = next;
  }
  function stepAll(dir) {
    $$('.gl-row', app).forEach(function (row, k) {
      if (!visible[row.dataset.row] || row.dataset.hold === '1') return;
      setTimeout(function () { step($('.gl-strip', row), dir); }, k % 5 * 180);
    });
  }
  function restart() {
    clearInterval(S.timer);
    S.timer = setInterval(function () { if (!paused && !document.hidden) stepAll(1); }, speed * 1000);
    $('#glSpeed').textContent = speed + ' s';
    try { localStorage.setItem('g109a_speed', String(speed)); } catch (e) {}
  }
  function rowHtml(r, i) {
    var p = S.pm[r.plantId] || {};
    S.lists['gl' + i] = r.photos;
    return '<section class="gl-row" data-row="' + i + '"><div class="gl-h"><a href="#/plant/' + esc(r.plantId) + '"><h2 class="gl-t">' + esc(p.en || r.plantId) + '</h2></a>' +
      '<span class="muted sm">' + r.total + (r.total === 1 ? ' photo' : ' photos') + '</span></div>' +
      '<div class="gl-strip" tabindex="0" aria-label="' + esc((p.en || '') + ' photos') + '">' + r.photos.map(function (ph, k) {
        var label = varLabel(S.vm[ph.varietyId]) || ph.stage || fmtDate(ph.date);
        return '<button type="button" class="gl-card" data-act="lb" data-lb="gl' + i + '" data-i="' + k + '" aria-label="Open photo: ' + esc(photoAlt(ph) || p.en) + '">' +
          '<img src="' + imgUrl(ph.fileId, 400) + '" alt="" loading="lazy"><span class="gl-cap">' + esc(label) + '</span></button>';
      }).join('') + '</div></section>';
  }
  function more() {
    var next = rows.slice(shown, shown + 5);
    if (!next.length) return;
    $('#glRows').insertAdjacentHTML('beforeend', next.map(function (r, k) { return rowHtml(r, shown + k); }).join(''));
    next.forEach(function (_, k) {
      var row = $('[data-row="' + (shown + k) + '"]');
      if (S.io) S.io.observe(row); else visible[row.dataset.row] = true;
      var strip = $('.gl-strip', row);
      strip.addEventListener('pointerdown', function () { row.dataset.hold = '1'; clearTimeout(row._t); row._t = setTimeout(function () { row.dataset.hold = ''; }, 8000); });
    });
    shown += next.length;
    $('#glMore').innerHTML = shown < rows.length ? '<button type="button" class="btn" id="glMoreBtn">Show more plants (' + (rows.length - shown) + ' left)</button>' : '';
    var mb = $('#glMoreBtn'); if (mb) { mb.addEventListener('click', more); if (S.io) S.io.observe(mb); }
  }
  if ('IntersectionObserver' in window) {
    S.io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.target.id === 'glMoreBtn') { if (en.isIntersecting) more(); return; }
        visible[en.target.dataset.row] = en.isIntersecting;
      });
    }, { rootMargin: '120px 0px' });
  }
  $('.gl-ctl').addEventListener('click', function (e) {
    var b = e.target.closest('[data-gl]'); if (!b) return;
    var a = b.dataset.gl;
    if (a === 'pause') setPaused(!paused);
    else if (a === 'next' || a === 'back') stepAll(a === 'next' ? 1 : -1);
    else if (a === 'slower') { speed = Math.min(10, speed + 1); restart(); }
    else if (a === 'faster') { speed = Math.max(1, speed - 1); restart(); }
  });
  $('#glGroup').addEventListener('change', function () {
    var g = $('#glGroup').value;
    location.hash = '#/gallery' + (g ? '/group=' + encodeURIComponent(g) : '');
  });
  setPaused(paused);
  api('getGallery', S.pin, group, S.preview).then(function (data) {
    if (route().page !== 'gallery') return;
    rows = data;
    $('#glRows').innerHTML = rows.length ? '' : '<div class="empty">No photos for ' + esc(group || 'any plant') + ' yet.' + (isOwner() ? ' Add photos and they will show here.' : '') + '</div>';
    more(); restart();
  }).catch(function (err) { $('#glRows').innerHTML = '<p class="hint bad">Photos did not load: ' + esc(err.message) + '</p>'; });
}

/* ================= owner: photos list ================= */
function viewPhotos(arg) {
  var pre = parseArgs(arg), list = S.boot.photos;
  var ids = []; list.forEach(function (p) { if (ids.indexOf(p.plantId) < 0) ids.push(p.plantId); });
  app.innerHTML = '<div class="page-h"><h1>My photos</h1><p class="muted">Your latest ' + list.length + ' photos. Tap one to change its details or delete it.</p></div>' +
    '<div class="f2" style="max-width:760px"><div class="field"><label for="phP">Plant</label><select id="phP"><option value="">All plants</option>' +
      ids.map(function (id) { return '<option value="' + esc(id) + '"' + (id === pre.plant ? ' selected' : '') + '>' + esc(plantName(id) || id) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label for="phK">Show</label><select id="phK"><option value="">All photos</option><option value="live">New photos only</option><option value="old">Old photos (archive) only</option><option value="nostage">Photos without a stage</option></select></div></div>' +
    '<p class="muted sm" id="phCount" role="status" style="margin:14px 0 10px"></p><div class="grid g-photos" id="phGrid"></div>';
  function draw() {
    var pid = $('#phP').value, k = $('#phK').value;
    var rows = list.filter(function (p) {
      return p.fileId && (!pid || p.plantId === pid) && (k !== 'live' || !p.archive) && (k !== 'old' || p.archive) && (k !== 'nostage' || !p.stage);
    });
    $('#phGrid').innerHTML = rows.map(function (p) {
      return '<a class="ptile" href="#/photo/' + encodeURIComponent(p.fileId) + '" aria-label="Edit photo: ' + esc(photoAlt(p) || 'garden') + '">' +
        '<img src="' + imgUrl(p.fileId, 400) + '" alt="" loading="lazy"><span class="ptag">' + esc([plantName(p.plantId), p.stage, fmtDate(p.date)].filter(Boolean).join(', ')) + '</span>' +
        (p.archive ? '<span class="ptag2">Old</span>' : '') + '</a>';
    }).join('') || '<div class="empty">No photos here.</div>';
    $('#phCount').textContent = rows.length + (rows.length === 1 ? ' photo' : ' photos');
  }
  $('#phP').addEventListener('change', draw); $('#phK').addEventListener('change', draw);
  draw();
}

/* ================= owner: edit one photo ================= */
function viewPhoto(fileId) {
  app.innerHTML = '<a class="back" href="#/photos">' + icon('back') + 'My photos</a><div class="page-h"><h1>Edit photo</h1></div><p class="muted" id="peLoad">Loading…</p><div id="peBody"></div>';
  api('getPhotos', S.pin, { fileId: fileId }, false).then(function (list) {
    if (route().arg !== fileId) return;
    var p = list[0];
    if (!p) { $('#peLoad').textContent = 'This photo was not found. It may have been deleted.'; return; }
    $('#peLoad').remove();
    var b = S.boot, pot = p.potUid ? (b.pots || []).filter(function (x) { return x.uid === p.potUid; })[0] : null;
    var stages = ((b.lists && b.lists['Photo stages']) || FLOWER_STAGES).filter(function (x) { return hiddenOf('Photo stages').indexOf(x) < 0 || x === p.stage; });
    if (p.stage && stages.indexOf(p.stage) < 0) stages.push(p.stage);
    var cols = splitColours(p.colour);
    $('#peBody').innerHTML =
      '<div class="pe-wrap"><button type="button" class="pe-img" data-act="lb" data-lb="pe" data-i="0" aria-label="See photo big"><img src="' + imgUrl(p.fileId, 900) + '" alt="' + esc(photoAlt(p)) + '"></button>' +
      '<form id="peForm" class="form" novalidate>' +
        '<fieldset class="fs"><legend>When</legend><div class="f2"><div class="field"><label for="peDate">Date</label><input type="date" id="peDate" value="' + esc(p.date) + '"></div>' +
        '<div class="field"><label for="peTime">Time</label><input type="time" id="peTime" value="' + esc(p.time) + '"></div></div></fieldset>' +
        '<fieldset class="fs"><legend>Plant</legend><div class="f2">' +
          '<div class="field"><label for="pePot">Pot ref</label><input id="pePot" list="potRefs" autocomplete="off" autocapitalize="characters" value="' + esc(pot ? pot.ref : '') + '" placeholder="e.g. T036">' + potDatalist('potRefs') + '<p class="hint" id="pePotMsg">Leave empty if not from a pot.</p></div>' +
          comboHtml('pePlant', 'Plant') + comboHtml('peVar', 'Variety') + '</div>' +
          '<div class="field"><span class="lbl">Colours</span>' + colourPicker('peColours', cols) + '</div></fieldset>' +
        '<fieldset class="fs"><legend>Stage</legend><div class="chips stage" role="radiogroup" aria-label="Stage">' + stages.map(function (x) {
          return '<label class="chip-r"><input type="radio" name="peStage" value="' + esc(x) + '"' + (x === p.stage ? ' checked' : '') + '><span>' + esc(x) + '</span></label>';
        }).join('') + '<label class="chip-r"><input type="radio" name="peStage" value=""' + (!p.stage ? ' checked' : '') + '><span>No stage</span></label></div></fieldset>' +
        '<fieldset class="fs"><legend>Details</legend>' +
          '<div class="field"><label for="peRemark">Remark</label><textarea id="peRemark" rows="2">' + esc(p.remark) + '</textarea></div>' +
          '<div class="field"><label for="peBloom">Flower ID (links photos of one flower)</label><input id="peBloom" autocomplete="off" autocapitalize="characters" value="' + esc(p.bloom) + '" placeholder="e.g. BL0003"><p class="hint">Leave empty if this is not part of a flower series.</p></div>' +
          '<label class="sw"><input type="checkbox" id="peArchive"' + (p.archive ? ' checked' : '') + '><span><strong>Old photo (archive)</strong><br><span class="hint">Not counted for flowering. Turning this on also removes its flower count.</span></span></label>' +
          '<label class="sw"><input type="checkbox" id="peFamily"' + (p.family === false ? '' : ' checked') + '><span>Show to family</span></label>' +
          '<label class="sw"><input type="checkbox" id="peGallery"' + (p.gallery ? ' checked' : '') + '><span>Show in gallery</span></label>' +
        '</fieldset>' +
        '<div class="actions row gap"><button class="btn btn-primary lg" type="submit">Save changes</button><button class="btn lg" type="button" id="peShare">Share / Google Photos</button><button class="btn lg pe-del" type="button" id="peDel">Delete photo</button></div>' +
      '</form></div>';
    S.lists.pe = [p];
    var pick = bindColourPicker('peColours'), curPot = pot;
    var plantC = Combo('pePlant', plantComboOpts(), p.plantId), varC = Combo('peVar', varietyComboOpts(p.plantId, false), p.varietyId);
    plantC.onChange(function () {
      varC.setOptions(varietyComboOpts(plantC.value, false), '');
      if (curPot && curPot.plantId !== plantC.value) { curPot = null; $('#pePot').value = ''; }
    });
    varC.onChange(function () { var v = S.vm[varC.value]; if (v) pick.set(varColours(v)); });
    $('#pePot').addEventListener('change', function () {
      var v = $('#pePot').value.trim(), m = $('#pePotMsg');
      if (!v) { curPot = null; m.textContent = 'Leave empty if not from a pot.'; m.className = 'hint'; return; }
      var f = findPot(v);
      if (!f) { curPot = null; m.textContent = 'No active pot "' + v + '".'; m.className = 'hint bad'; return; }
      curPot = f; $('#pePot').value = f.ref; plantC.value = f.plantId; varC.setOptions(varietyComboOpts(f.plantId, false), f.varietyId);
      m.textContent = f.plant + (f.variety ? ', ' + f.variety : ''); m.className = 'hint good';
    });
    $('#peForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('#pePot').value.trim() && !curPot) { toast('Fix the pot ref, or leave it empty.', 'err'); return; }
      if (!plantC.value) { toast('Pick the plant.', 'err'); plantC.focus(); return; }
      var st = $('input[name=peStage]:checked');
      var ch = { date: $('#peDate').value, time: $('#peTime').value, potUid: curPot ? curPot.uid : '', plantId: plantC.value, varietyId: varC.value,
        stage: st ? st.value : '', colour: pick.get(), remark: $('#peRemark').value.trim(), bloom: $('#peBloom').value.trim().toUpperCase(),
        archive: $('#peArchive').checked, family: $('#peFamily').checked, gallery: $('#peGallery').checked };
      var btn = $('button[type=submit]', $('#peForm')); btn.disabled = true;
      api('updatePhoto', S.pin, fileId, ch).then(function () {
        S.boot.photos.forEach(function (x) {
          if (x.fileId !== fileId) return;
          Object.keys(ch).forEach(function (k) { x[k] = k === 'colour' ? ch.colour.join(', ') : ch[k]; });
          x.potNo = curPot ? curPot.ref : '';
        });
        saveBoot(S.boot);
        toast('Changes saved. Updating the labelled copy…');
        var ph = Object.assign({}, p, ch, { colour: ch.colour.join(', '), potNo: curPot ? curPot.ref : '' });
        relabel(ph).then(function (lid) { p.labelId = lid; toast('Changes saved and label updated.'); }, function () {});
      }).catch(function (err) { toast(err.message, 'err'); }).then(function () { btn.disabled = false; });
    });
    $('#peShare').addEventListener('click', function () { shareLabelled(p); });
    $('#peDel').addEventListener('click', function () {
      if (!window.confirm('Delete this photo? It goes to Google Drive trash, where you can restore it for 30 days.')) return;
      api('deletePhoto', S.pin, fileId).then(function () {
        S.boot.photos = S.boot.photos.filter(function (x) { return x.fileId !== fileId; });
        S.boot.photoCount = Math.max(0, (S.boot.photoCount || 1) - 1);
        saveBoot(S.boot);
        toast('Photo deleted.');
        location.hash = '#/photos';
      }).catch(function (err) { toast(err.message, 'err'); });
    });
  }).catch(function (err) { $('#peLoad').textContent = 'Could not load the photo: ' + err.message; });
}

/* ================= owner: masters ================= */
var MASTER_LISTS = [['Colours', 'Colours'], ['Petal types', 'Petal types'], ['Photo stages', 'Photo stages'], ['Activities', 'Work done (activities)'],
  ['Fish events', 'Fish events'], ['Purchase categories', 'Purchase categories'], ['Found through', 'Found through (vendor source)'],
  ['Vendor types', 'Vendor types'], ['Input categories', 'Input categories'], ['Plant groups', 'Plant groups']];
var LOCKED_UI = { 'Activities': ['Feed', 'Repot'], 'Fish events': ['Died', 'Moved out', 'Gifted'], 'Photo stages': ['Bud', 'Bud opening', 'Day 1'] };
var REC = {
  potCode: { title: 'Pot codes', key: 'code', keyLabel: 'Code (1 or 2 letters)', list: function () { return S.boot.potCodes || []; },
    label: function (r) { return r.code + ' – ' + r.type + (r.digits ? ' (' + r.digits + ' digits)' : ''); },
    fields: [['type', 'Pot type'], ['digits', 'Number digits', 'number'], ['notes', 'Notes']] },
  area: { title: 'Areas', key: 'id', auto: true, list: function () { return S.boot.areas || []; },
    label: function (r) { return r.id + ' ' + r.name + (r.side ? ', ' + r.side : ''); },
    fields: [['name', 'Area name'], ['side', 'Side / location'], ['sun', 'Sun hours (approx)', 'number'], ['size', 'Size (sq ft)', 'number'], ['notes', 'Notes']] },
  unit: { title: 'Units', key: 'unit', keyLabel: 'Unit name', list: function () { return S.boot.units || []; },
    label: function (r) { return r.unit + (r.grams !== '' ? ' = ' + r.grams + ' g or ml' : ''); },
    fields: [['measures', 'Measures (weight, liquid or count)'], ['grams', 'Approx g or ml', 'number']] },
  fish: { title: 'Fish types', key: 'id', auto: true, list: function () { return S.boot.fishTypes || []; },
    label: function (r) { return r.name + (r.strain ? ' (' + r.strain + ')' : ''); },
    fields: [['name', 'Fish name'], ['sci', 'Scientific name'], ['strain', 'Strain'], ['colour', 'Colour'], ['ta', 'Tamil name'], ['notes', 'Notes']] },
  vendor: { title: 'Vendors', key: 'id', auto: true, list: function () { return S.boot.vendors || []; },
    label: function (r) { return r.name + (r.city ? ', ' + r.city : ''); },
    fields: [['name', 'Vendor name'], ['contact', 'Contact person'], ['mobile', 'Mobile', 'tel'], ['email', 'Email', 'email'], ['area', 'Area'], ['city', 'City'],
      ['state', 'State'], ['web', 'Website', 'url'], ['found', 'Found through', 'list:Found through'], ['type', 'Vendor type', 'list:Vendor types'], ['notes', 'Notes']] }
};
function viewMasters() {
  S.openM = S.openM || {};
  var open = function (k) { return S.openM[k] ? ' open' : ''; };
  var st = (S.boot.meta && S.boot.meta.settings) || {};
  app.innerHTML = '<div class="page-h"><h1>Masters</h1><p class="muted">Add or change the choices used in the app. Hidden items stay in old records but are not offered for new ones.</p></div>' +
    '<details class="care" data-mk="S"' + open('S') + '><summary>Photo label</summary><div class="body"><form id="stForm" class="form"><div class="f2">' +
      '<div class="field"><label for="stBrand">Brand on photos</label><input id="stBrand" value="' + esc(st.brand || '@109A') + '"></div>' +
      '<div class="field"><label for="stPlace">Place shown on photos</label><input id="stPlace" value="' + esc(st.place || 'Chennai') + '"><p class="hint">Shown instead of the exact address.</p></div></div>' +
      '<label class="sw"><input type="checkbox" id="stGps"' + (st.gps ? ' checked' : '') + '><span><strong>Keep exact GPS inside photo files</strong><br><span class="hint">Off is safer: anyone you share a photo with could see where it was taken.</span></span></label>' +
      '<button class="btn btn-primary" type="submit">Save</button></form></div></details>' +
    '<h2 style="margin:20px 0 10px">Choice lists</h2>' + MASTER_LISTS.map(function (m) {
      return '<details class="care" data-mk="L:' + esc(m[0]) + '"' + open('L:' + m[0]) + '><summary>' + esc(m[1]) + ' <span class="muted sm">' + ((S.boot.lists[m[0]] || []).length) + '</span></summary><div class="body">' + listEditor(m[0]) + '</div></details>';
    }).join('') +
    '<h2 style="margin:28px 0 10px">Records</h2>' + Object.keys(REC).map(function (k) {
      return '<details class="care" data-mk="R:' + k + '"' + open('R:' + k) + '><summary>' + esc(REC[k].title) + ' <span class="muted sm">' + REC[k].list().length + '</span></summary><div class="body" id="rec_' + k + '">' + recEditor(k, null) + '</div></details>';
    }).join('');
  $$('details[data-mk]', app).forEach(function (d) { d.addEventListener('toggle', function () { S.openM[d.dataset.mk] = d.open; }); });
  $('#stForm').addEventListener('submit', function (e) {
    e.preventDefault();
    api('saveSettings', S.pin, { brand: $('#stBrand').value, place: $('#stPlace').value, gps: $('#stGps').checked }).then(function (ns) {
      S.boot.meta.settings = ns; saveBoot(S.boot); toast('Photo label saved. New photos will use it.');
    }).catch(function (err) { toast(err.message, 'err'); });
  });
  app.onclick = mastersClick;
  app.onchange = function (e) {
    var sw = e.target.closest('.ml-sw'); if (!sw) return;
    var name = sw.closest('.ml-row').dataset.v;
    api('setColourSwatch', S.pin, name, sw.value).then(function () {
      S.boot.meta.swatches = S.boot.meta.swatches || {}; S.boot.meta.swatches[name] = sw.value; saveBoot(S.boot); toast('Swatch for ' + name + ' saved.');
    }).catch(function (err) { toast(err.message, 'err'); });
  };
}
function listEditor(name) {
  var vals = S.boot.lists[name] || [], hid = hiddenOf(name), locked = LOCKED_UI[name] || [];
  return '<div class="ml" data-list="' + esc(name) + '">' + vals.map(function (v) {
    var isHid = hid.indexOf(v) >= 0, isLock = locked.indexOf(v) >= 0;
    return '<div class="ml-row' + (isHid ? ' ml-hid' : '') + '" data-v="' + esc(v) + '">' +
      (name === 'Colours' ? '<input type="color" class="ml-sw" value="' + hexOf(v) + '" aria-label="Swatch colour for ' + esc(v) + '">' : '') +
      '<input class="ml-name" value="' + esc(v) + '" aria-label="Name"' + (isLock ? ' disabled title="Used by the app; cannot be renamed"' : '') + '>' +
      (isLock ? '' : '<button type="button" class="btn sm" data-ml="rename">Rename</button>') +
      '<button type="button" class="btn sm" data-ml="hide">' + (isHid ? 'Show again' : 'Hide') + '</button></div>';
  }).join('') +
    '<div class="ml-row"><input class="ml-new" placeholder="New ' + esc(name.toLowerCase().replace(/s$/, '')) + '" aria-label="New item name"><button type="button" class="btn sm btn-primary" data-ml="add">Add</button></div>' +
    '<label class="sw sm"><input type="checkbox" class="ml-upd" checked><span>When renaming, also change old records</span></label></div>';
}
function recEditor(kind, editKey) {
  var R = REC[kind], rows = R.list(), cur = editKey !== null && editKey !== undefined ? rows.filter(function (r) { return String(r[R.key]) === String(editKey); })[0] : null;
  var isNew = editKey === '';
  var list = '<ul class="rec-list">' + rows.map(function (r) {
    return '<li><span>' + esc(R.label(r)) + '</span><button type="button" class="btn sm" data-rec="edit" data-kind="' + kind + '" data-key="' + esc(r[R.key]) + '">Edit</button></li>';
  }).join('') + '</ul><button type="button" class="btn sm btn-primary" data-rec="new" data-kind="' + kind + '">' + icon('plus', 16) + 'Add new</button>';
  if (!cur && !isNew) return list;
  var val = function (k) { return cur ? cur[k] : ''; };
  var keyField = R.auto ? '' : '<div class="field"><label for="rk_' + kind + '">' + esc(R.keyLabel) + '</label><input id="rk_' + kind + '" data-f="' + R.key + '" value="' + esc(val(R.key)) + '"' + (cur ? ' disabled' : '') + '></div>';
  var fields = R.fields.map(function (f) {
    var id = 'rf_' + kind + '_' + f[0], type = f[2] || 'text';
    if (type.indexOf('list:') === 0) return '<div class="field"><label for="' + id + '">' + esc(f[1]) + '</label><select id="' + id + '" data-f="' + f[0] + '">' + listOptions(type.slice(5), val(f[0]), 'Not set') + '</select></div>';
    return '<div class="field"><label for="' + id + '">' + esc(f[1]) + '</label><input id="' + id + '" data-f="' + f[0] + '" type="' + type + '"' + (type === 'number' ? ' inputmode="decimal" step="any"' : '') + ' value="' + esc(val(f[0])) + '"></div>';
  }).join('');
  return list + '<form class="form rec-form" data-kind="' + kind + '" data-new="' + (isNew ? '1' : '') + '" data-key="' + esc(cur ? cur[R.key] : '') + '" style="margin-top:14px">' +
    '<h3>' + (isNew ? 'New' : 'Edit ' + esc(R.label(cur))) + '</h3><div class="f2">' + keyField + fields + '</div>' +
    '<div class="row gap"><button class="btn btn-primary" type="submit">Save</button><button class="btn" type="button" data-rec="cancel" data-kind="' + kind + '">Cancel</button></div></form>';
}
function mastersClick(e) {
  var b = e.target.closest('[data-ml],[data-rec]'); if (!b || route().page !== 'masters') return;
  if (b.dataset.rec) {
    var kind = b.dataset.kind, box = $('#rec_' + kind);
    if (b.dataset.rec === 'edit') box.innerHTML = recEditor(kind, b.dataset.key);
    else if (b.dataset.rec === 'new') box.innerHTML = recEditor(kind, '');
    else box.innerHTML = recEditor(kind, null);
    var form = $('.rec-form', box);
    if (form) { var first = $('input:not([disabled]),select', form); if (first) first.focus(); form.addEventListener('submit', saveRec); }
    return;
  }
  var wrap = b.closest('.ml'), list = wrap.dataset.list, row = b.closest('.ml-row'), act = b.dataset.ml;
  var done = function (msg) { toast(msg); refreshBoot().then(function () { if (route().page === 'masters') render(); }); };
  b.disabled = true;
  var p;
  if (act === 'add') {
    var nv = $('.ml-new', wrap).value.trim();
    if (!nv) { b.disabled = false; toast('Type a name first.', 'err'); return; }
    p = api('saveListValue', S.pin, list, '', nv, false).then(function () { S.boot.lists[list] = (S.boot.lists[list] || []).concat([nv]); done(nv + ' added.'); });
  } else if (act === 'rename') {
    var ov = row.dataset.v, nn = $('.ml-name', row).value.trim(), upd = $('.ml-upd', wrap).checked;
    if (!nn || nn === ov) { b.disabled = false; toast('Change the name in the box first, then tap Rename.', 'err'); return; }
    p = api('saveListValue', S.pin, list, ov, nn, upd).then(function (res) {
      S.boot.lists[list] = S.boot.lists[list].map(function (v) { return v === ov ? nn : v; });
      done(ov + ' renamed to ' + nn + (upd ? '. ' + res.changed + ' old records changed.' : '.'));
    });
  } else if (act === 'hide') {
    var v = row.dataset.v, hide = hiddenOf(list).indexOf(v) < 0;
    p = api('hideListValue', S.pin, list, v, hide).then(function (h) {
      S.boot.meta.hidden = S.boot.meta.hidden || {}; S.boot.meta.hidden[list] = h; saveBoot(S.boot);
      toast(v + (hide ? ' hidden.' : ' shown again.')); render();
    });
  }
  if (p) p.catch(function (err) { toast(err.message, 'err'); b.disabled = false; });
}
function saveRec(e) {
  e.preventDefault();
  var form = e.target, kind = form.dataset.kind, R = REC[kind], data = {};
  $$('[data-f]', form).forEach(function (el) { data[el.dataset.f] = el.value; });
  if (form.dataset.new) data._new = true; else data[R.key] = form.dataset.key;
  var btn = $('button[type=submit]', form); btn.disabled = true;
  api('saveMaster', S.pin, kind, data).then(function (id) {
    toast(R.title + ': saved ' + id + '.');
    S.openM['R:' + kind] = true;
    return refreshBoot().then(function () { if (route().page === 'masters') render(); });
  }).catch(function (err) { toast(err.message, 'err'); btn.disabled = false; });
}

/* ================= details written inside the photo file (EXIF) ================= */
function asciiOnly(s) { return String(s || '').replace(/\s*[·•]\s*/g, ' - ').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '').slice(0, 1000); }
function buildTiff(ifds) {
  var SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };
  function bytesOf(e) {
    if (e.type === 2) { var a = asciiOnly(e.value); var b = new Uint8Array(a.length + 1); for (var i = 0; i < a.length; i++) b[i] = a.charCodeAt(i); return b; }
    if (e.type === 1 || e.type === 7) return new Uint8Array(e.value);
    var vals = e.value, out = new Uint8Array(vals.length * SZ[e.type]), dv = new DataView(out.buffer);
    vals.forEach(function (x, i) {
      if (e.type === 3) dv.setUint16(i * 2, x); else if (e.type === 4) dv.setUint32(i * 4, x);
      else { dv.setUint32(i * 8, x[0]); dv.setUint32(i * 8 + 4, x[1]); }
    });
    return out;
  }
  var off = 8, starts = [];
  ifds.forEach(function (ifd) {
    ifd.sort(function (a, b) { return a.tag - b.tag; });
    starts.push(off);
    var d = off + 2 + ifd.length * 12 + 4;
    ifd.forEach(function (e) { e._b = e.ptr !== undefined ? null : bytesOf(e); var len = e._b ? e._b.length : 4; if (len > 4) { e._off = d; d += len + (len % 2); } });
    ifd._end = d; off = d;
  });
  var buf = new Uint8Array(off), dv = new DataView(buf.buffer);
  buf[0] = 0x4D; buf[1] = 0x4D; dv.setUint16(2, 42); dv.setUint32(4, 8);
  ifds.forEach(function (ifd, k) {
    var p = starts[k];
    dv.setUint16(p, ifd.length); p += 2;
    ifd.forEach(function (e) {
      dv.setUint16(p, e.tag);
      if (e.ptr !== undefined) { dv.setUint16(p + 2, 4); dv.setUint32(p + 4, 1); dv.setUint32(p + 8, starts[e.ptr]); }
      else {
        var cnt = e.type === 2 || e.type === 1 || e.type === 7 ? e._b.length : e.value.length;
        dv.setUint16(p + 2, e.type); dv.setUint32(p + 4, cnt);
        if (e._b.length > 4) { dv.setUint32(p + 8, e._off); buf.set(e._b, e._off); } else buf.set(e._b, p + 8);
      }
      p += 12;
    });
    dv.setUint32(p, 0);
  });
  return buf;
}
function gpsRat(x) { x = Math.abs(x); var d = Math.floor(x), m = Math.floor((x - d) * 60), sc = Math.round(((x - d) * 60 - m) * 60 * 100); return [[d, 1], [m, 1], [sc, 100]]; }
/** Adds date, description, author, copyright and (optionally) GPS into a JPEG (base64 in, base64 out). */
function addExif(b64, o) {
  try {
    var bin = atob(b64), jpg = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
    if (jpg[0] !== 0xFF || jpg[1] !== 0xD8) return b64;
    var dt = (o.date || today()).replace(/-/g, ':') + ' ' + (o.time || '00:00') + ':00';
    var ifd0 = [{ tag: 0x010E, type: 2, value: o.desc }, { tag: 0x0131, type: 2, value: 'Garden@109A app' }, { tag: 0x0132, type: 2, value: dt },
      { tag: 0x013B, type: 2, value: o.artist || 'Garden@109A' }, { tag: 0x8298, type: 2, value: o.copyright || '@109A' }, { tag: 0x8769, ptr: 1 }];
    var exif = [{ tag: 0x9000, type: 7, value: [48, 50, 51, 50] }, { tag: 0x9003, type: 2, value: dt }, { tag: 0x9004, type: 2, value: dt }];
    var ifds = [ifd0, exif];
    if (o.gps && isFinite(o.gps.lat) && isFinite(o.gps.lon)) {
      ifd0.push({ tag: 0x8825, ptr: 2 });
      ifds.push([{ tag: 0, type: 1, value: [2, 3, 0, 0] }, { tag: 1, type: 2, value: o.gps.lat < 0 ? 'S' : 'N' }, { tag: 2, type: 5, value: gpsRat(o.gps.lat) },
        { tag: 3, type: 2, value: o.gps.lon < 0 ? 'W' : 'E' }, { tag: 4, type: 5, value: gpsRat(o.gps.lon) }]);
    }
    var tiff = buildTiff(ifds), seg = new Uint8Array(4 + 6 + tiff.length);
    seg[0] = 0xFF; seg[1] = 0xE1; seg[2] = ((seg.length - 2) >> 8) & 255; seg[3] = (seg.length - 2) & 255;
    [0x45, 0x78, 0x69, 0x66, 0, 0].forEach(function (x, k) { seg[4 + k] = x; });
    seg.set(tiff, 10);
    var pos = 2;
    if (jpg[2] === 0xFF && jpg[3] === 0xE0) pos = 4 + ((jpg[4] << 8) | jpg[5]);
    var out = new Uint8Array(jpg.length + seg.length);
    out.set(jpg.subarray(0, pos), 0); out.set(seg, pos); out.set(jpg.subarray(pos), pos + seg.length);
    var str = '';
    for (var j = 0; j < out.length; j += 0x8000) str += String.fromCharCode.apply(null, out.subarray(j, j + 0x8000));
    return btoa(str);
  } catch (e) { return b64; }
}

/* ================= the label strip under the photo ================= */
function setting(k, d) { var st = (S.boot && S.boot.meta && S.boot.meta.settings) || {}; return st[k] !== undefined && st[k] !== '' ? st[k] : d; }
/** d: plantId, varietyId, potNo, stage, date, time, colour, colourCodes, edge, centre, shotBy */
function labelInfo(d) {
  if (!d.potNo && d.potUid) { var pt = (S.boot.pots || []).filter(function (x) { return x.uid === d.potUid; })[0]; if (pt) d = Object.assign({}, d, { potNo: pt.ref }); }
  var v = S.vm[d.varietyId], cols = Array.isArray(d.colour) ? d.colour : splitColours(d.colour);
  var edge = Array.isArray(d.edge) ? d.edge : splitColours(d.edge), centre = Array.isArray(d.centre) ? d.centre : splitColours(d.centre);
  var colourText = cols.join(', ') + (edge.length ? (cols.length ? ', ' : '') + edge.join(' & ') + ' edge' : '') + (centre.length ? (cols.length || edge.length ? ', ' : '') + centre.join(' & ') + ' centre' : '');
  return {
    brand: setting('brand', '@109A'),
    l1: [plantName(d.plantId), v ? varLabel(v) : '', d.potNo ? 'Pot ' + d.potNo : '', d.stage].filter(Boolean).join(' · '),
    l2: [fmtDate(d.date) + (d.time ? ' ' + d.time : ''), setting('place', 'Chennai')].filter(Boolean).join(' · '),
    l3: [colourText, v && v.petal ? v.petal + ' petal' : '', d.shotBy ? 'by ' + d.shotBy : ''].filter(Boolean).join(' · '),
    codes: Array.isArray(d.colourCodes) ? d.colourCodes : splitColours(d.colourCodes)
  };
}
function exifFor(d) {
  var L = labelInfo(d);
  return { date: d.date, time: d.time, desc: [L.brand, L.l1, L.l2, L.l3].filter(Boolean).join(' | '), artist: d.shotBy || 'Garden@109A', copyright: L.brand + ' Garden', gps: setting('gps', false) ? d.gps : null };
}
function loadImg(src) {
  return new Promise(function (res, rej) {
    var img = new Image();
    img.onload = function () { res(img); };
    img.onerror = function () { rej(new Error('this photo type cannot be read here; please use JPG')); };
    img.src = src;
  });
}
function cleanFromImg(img, max, q) {
  var w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, (max || 1600) / Math.max(w, h));
  var c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q || 0.8).split(',')[1];
}
function labelledFromImg(img, d) {
  var L = labelInfo(d), w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, 1280 / Math.max(w, h));
  var W = Math.round(w * sc), H = Math.round(h * sc), fs = Math.max(15, Math.round(W * 0.027)), pad = Math.round(fs * 0.9), lh = Math.round(fs * 1.45);
  var c = document.createElement('canvas'), ctx = c.getContext('2d');
  var font = function (wt, size) { return wt + ' ' + size + 'px Manrope, "Segoe UI", Roboto, Arial, sans-serif'; };
  function wrap(text, maxW, f) {
    ctx.font = f;
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  c.width = W; c.height = H;
  var brandF = font(800, Math.round(fs * 1.15)), boldF = font(700, fs), normF = font(500, Math.round(fs * 0.92));
  ctx.font = brandF; var bw = ctx.measureText(L.brand).width + fs * 0.8;
  var dot = L.codes.length ? L.codes.length * fs * 0.9 + fs * 0.3 : 0;
  var lines1 = wrap(L.l1, W - pad * 2 - bw, boldF), lines2 = wrap(L.l2, W - pad * 2, normF), lines3 = wrap(L.l3, W - pad * 2 - dot, normF);
  var stripH = pad * 2 + lh * (lines1.length + lines2.length + lines3.length);
  c.height = H + stripH;
  ctx.drawImage(img, 0, 0, W, H);
  ctx.fillStyle = '#1B2A21'; ctx.fillRect(0, H, W, stripH);
  ctx.textBaseline = 'middle';
  var y = H + pad + lh / 2;
  ctx.font = brandF; ctx.fillStyle = '#9AD6B6'; ctx.fillText(L.brand, pad, y);
  ctx.font = boldF; ctx.fillStyle = '#FFFFFF';
  lines1.forEach(function (t, i) { ctx.fillText(t, pad + bw, y); if (i < lines1.length - 1) y += lh; });
  y += lh;
  ctx.font = normF; ctx.fillStyle = '#D7E3DA';
  lines2.forEach(function (t) { ctx.fillText(t, pad, y); y += lh; });
  L.codes.forEach(function (hx, i) {
    ctx.beginPath(); ctx.arc(pad + fs * 0.4 + i * fs * 0.9, y, fs * 0.35, 0, Math.PI * 2); ctx.fillStyle = hx; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  });
  ctx.font = normF; ctx.fillStyle = '#D7E3DA';
  lines3.forEach(function (t, i) { ctx.fillText(t, pad + (i === 0 ? dot : 0), y); y += lh; });
  return c.toDataURL('image/jpeg', 0.82).split(',')[1];
}
/** Clean copy + labelled copy from one photo file, both with details inside the file. */
function prepareImages(file, d) {
  var url = URL.createObjectURL(file);
  return loadImg(url).then(function (img) {
    URL.revokeObjectURL(url);
    var ex = exifFor(d), labelled = null;
    try { labelled = addExif(labelledFromImg(img, d), ex); } catch (e) { labelled = null; } // the photo still saves without a label
    return { clean: addExif(cleanFromImg(img, 1600, 0.8), ex), labelled: labelled };
  }, function (e) { URL.revokeObjectURL(url); throw e; });
}
/** Make a new labelled copy from the photo stored in Drive (after edits or for older photos). */
function relabel(d) {
  return api('getPhotoData', S.pin, d.fileId).then(function (data) { return loadImg('data:' + (data.mime || 'image/jpeg') + ';base64,' + data.b64); })
    .then(function (img) { return addExif(labelledFromImg(img, d), exifFor(d)); })
    .then(function (b64) { return api('saveLabel', S.pin, d.fileId, b64); })
    .then(function (labelId) {
      S.boot.photos.forEach(function (x) { if (x.fileId === d.fileId) x.labelId = labelId; });
      return labelId;
    });
}
/** Share the labelled photo through the phone's share menu (pick Google Photos to save it there). */
function shareLabelled(p) {
  var ready = p.labelId ? Promise.resolve(p.labelId) : relabel(p);
  toast('Preparing the labelled photo…');
  return ready.then(function (labelId) { p.labelId = labelId; return api('getPhotoData', S.pin, labelId); }).then(function (data) {
    var bin = atob(data.b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var name = (data.name || 'garden109a.jpg').replace(/[^\w.-]+/g, '_');
    var file = new File([arr], name, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: labelInfo(p).l1 }).then(function () { toast('Shared.'); }, function () {});
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast('Saved to your Downloads. Open Google Photos to back it up.');
  }).catch(function (err) { toast(err.message, 'err'); });
}
/** All details under a photo, never over it. */
function detailsHtml(p) {
  var L = labelInfo(p);
  return '<div class="pdet"><div class="pdet-1"><span class="pdet-brand">' + esc(L.brand) + '</span> ' + esc(L.l1 || 'Garden photo') + (p.archive ? '<span class="cap-old">Old photo</span>' : '') + '</div>' +
    '<div class="pdet-2">' + esc(L.l2) + '</div>' +
    (L.l3 ? '<div class="pdet-3">' + L.codes.map(function (h) { return '<span class="sw-dot" style="background:' + esc(h) + '"></span>'; }).join('') + esc(L.l3) + '</div>' : '') +
    (p.remark ? '<div class="pdet-2">' + esc(p.remark) + '</div>' : '') + '</div>';
}

/* ================= colour science ================= */
function hexToRgb(h) { h = String(h).replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(function (x) { return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'); }).join('').toUpperCase(); }
function rgbToLab(r, g, b) {
  var f = function (c) { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
  var R = f(r), G = f(g), B = f(b);
  var x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  var t = function (v) { return v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116; };
  var fx = t(x), fy = t(y), fz = t(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb(L, a, bb) {
  var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
  var inv = function (v) { var c = v * v * v; return c > 0.008856 ? c : (v - 16 / 116) / 7.787; };
  var x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  var R = x * 3.2406 + y * -1.5372 + z * -0.4986, G = x * -0.9689 + y * 1.8758 + z * 0.0415, B = x * 0.0557 + y * -0.2040 + z * 1.0570;
  var g = function (c) { c = c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c; return c * 255; };
  return [g(R), g(G), g(B)];
}
function dE(l1, l2) { return Math.sqrt(Math.pow(l1[0] - l2[0], 2) + Math.pow(l1[1] - l2[1], 2) + Math.pow(l1[2] - l2[2], 2)); }
function hexLab(h) { var c = hexToRgb(h); return rgbToLab(c[0], c[1], c[2]); }
// Common flower colour names, used to suggest a name for a colour that is not in the master yet.
var COLOUR_DICT = { 'White': '#FFFFFF', 'Ivory': '#FFFFF0', 'Cream': '#F3E9C6', 'Lemon': '#FFF44F', 'Yellow': '#F2C94C', 'Golden': '#D9A400',
  'Mustard': '#C9A227', 'Amber': '#FFBF00', 'Apricot': '#FBCEB1', 'Peach': '#F6B99A', 'Orange': '#F2994A', 'Tangerine': '#F28500',
  'Coral': '#F88379', 'Salmon': '#FA8072', 'Rust': '#B7410E', 'Scarlet': '#FF2400', 'Red': '#D64545', 'Crimson': '#DC143C',
  'Maroon': '#7A1F2B', 'Burgundy': '#800020', 'Wine': '#722F37', 'Rose': '#E7546E', 'Hot pink': '#FF69B4', 'Pink': '#E58BA8',
  'Light pink': '#F5C6D6', 'Blush': '#F3D1D6', 'Fuchsia': '#D2329B', 'Magenta': '#C2185B', 'Plum': '#8E4585', 'Mauve': '#B784A7',
  'Lilac': '#C8A2C8', 'Lavender': '#B39DDB', 'Violet': '#8F00FF', 'Purple': '#7E57C2', 'Indigo': '#4B0082', 'Blue': '#4F7BD9',
  'Sky blue': '#87CEEB', 'Lime': '#BFD641', 'Green': '#6BAA75', 'Brown': '#8B5A2B', 'Black': '#1E1E1E' };
function masterHexes() {
  var out = [];
  colourNames().concat(hiddenOf('Colours')).forEach(function (c) { var h = swatchOf(c); if (/^#[0-9a-f]{6}$/i.test(h)) out.push([c, h]); });
  return out;
}
/** Nearest master colour, or a suggested new name when nothing in the master is close. */
function nameColour(hex) {
  var lab = hexLab(hex), best = null, bd = 1e9;
  masterHexes().forEach(function (m) { var d = dE(lab, hexLab(m[1])); if (d < bd) { bd = d; best = m[0]; } });
  if (best && bd <= 16) return { name: best, hex: hex, isNew: false };
  var sug = null, sd = 1e9;
  Object.keys(COLOUR_DICT).forEach(function (n) { var d = dE(lab, hexLab(COLOUR_DICT[n])); if (d < sd) { sd = d; sug = n; } });
  var inMaster = ((S.boot.lists && S.boot.lists['Colours']) || []).some(function (c) { return c.toLowerCase() === sug.toLowerCase(); });
  if (inMaster) return { name: sug, hex: hex, isNew: false };
  return { name: sug, hex: hex, isNew: true };
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
/** Main flower colours from the middle of the photo (leaves, soil and shadows left out). */
function dominantColours(ctx, w, h) {
  var x0 = Math.floor(w * 0.15), y0 = Math.floor(h * 0.15), ww = Math.ceil(w * 0.7), hh = Math.ceil(h * 0.7);
  var data = ctx.getImageData(x0, y0, ww, hh).data, step = Math.max(1, Math.floor(Math.sqrt(ww * hh / 4000))), pts = [];
  for (var y = 0; y < hh; y += step) for (var x = 0; x < ww; x += step) {
    var i = (y * ww + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], hsv = rgbToHsv(r, g, b);
    if (hsv[2] < 0.2) continue;                                       // shadow
    if (hsv[0] >= 60 && hsv[0] <= 170 && hsv[1] > 0.18) continue;     // leaves
    if (hsv[0] >= 15 && hsv[0] <= 45 && hsv[1] > 0.2 && hsv[2] < 0.45) continue; // soil
    pts.push(rgbToLab(r, g, b));
  }
  if (pts.length < 40) return [];
  var k = 4, cs = [];
  for (var c = 0; c < k; c++) cs.push(pts[Math.floor((c + 0.5) * pts.length / k)].slice());
  var asg = new Array(pts.length);
  for (var it = 0; it < 8; it++) {
    pts.forEach(function (p, n) { var bi = 0, bd = 1e9; cs.forEach(function (q, j) { var d = dE(p, q); if (d < bd) { bd = d; bi = j; } }); asg[n] = bi; });
    cs = cs.map(function (q, j) {
      var sum = [0, 0, 0], cnt = 0;
      pts.forEach(function (p, n) { if (asg[n] === j) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; cnt++; } });
      return cnt ? [sum[0] / cnt, sum[1] / cnt, sum[2] / cnt, cnt] : q;
    });
  }
  return cs.filter(function (q) { return (q[3] || 0) / pts.length >= 0.12; }).sort(function (a, b) { return b[3] - a[3]; }).slice(0, 2)
    .map(function (q) { var rgb = labToRgb(q[0], q[1], q[2]); return rgbToHex(rgb[0], rgb[1], rgb[2]); });
}

/* ================= colour tool: tap the photo to pick colours ================= */
var ROLES = [['main', 'Petal'], ['edge', 'Edge / tip'], ['centre', 'Centre']];
function mountColourTool(box, file, onChange) {
  var picked = [], role = 'main', ctx, cw, ch;
  box.innerHTML = '<div class="ctool"><div class="ct-top"><span class="lbl">Colours from the photo</span>' +
    '<div class="chips" role="group" aria-label="What are you tapping?">' + ROLES.map(function (r) {
      return '<button type="button" class="chip" data-role="' + r[0] + '" aria-pressed="' + (r[0] === role) + '">' + r[1] + '</button>';
    }).join('') + '</div></div>' +
    '<div class="ct-wrap"><canvas class="ct-canvas" aria-label="Photo. Tap the flower to pick a colour."></canvas></div>' +
    '<p class="hint">Choose Petal, Edge or Centre, then tap that part of the flower. The main colours are already suggested.</p>' +
    '<div class="ct-picked" aria-live="polite"></div></div>';
  var canvas = $('.ct-canvas', box);
  function info() {
    var o = { main: [], edge: [], centre: [] };
    picked.forEach(function (p) { o[p.role].push(p); });
    return o;
  }
  function draw() {
    $('.ct-picked', box).innerHTML = picked.map(function (p, i) {
      var r = ROLES.filter(function (x) { return x[0] === p.role; })[0][1];
      return '<span class="ct-chip"><span class="sw-dot" style="background:' + p.hex + '"></span><span><strong>' + esc(p.name) + '</strong> ' +
        '<span class="muted sm">' + esc(r) + ' · ' + p.hex + (p.auto ? ' · suggested' : '') + '</span></span>' +
        (p.isNew ? '<button type="button" class="btn sm" data-addc="' + i + '">Add "' + esc(p.name) + '" to master</button>' : '') +
        '<button type="button" class="icon-btn" data-rmc="' + i + '" aria-label="Remove ' + esc(p.name) + '">' + icon('close', 16) + '</button></span>';
    }).join('') || '<span class="muted sm">No colours yet.</span>';
    if (onChange) onChange(info());
  }
  function add(hex, auto) {
    var n = nameColour(hex);
    if (picked.some(function (p) { return p.role === role && p.name === n.name; })) return;
    picked.push({ role: auto ? 'main' : role, name: n.name, hex: hex, isNew: n.isNew, auto: !!auto });
    draw();
  }
  box.addEventListener('click', function (e) {
    var r = e.target.closest('[data-role]');
    if (r) { role = r.dataset.role; $$('[data-role]', box).forEach(function (b) { b.setAttribute('aria-pressed', String(b === r)); }); return; }
    var rm = e.target.closest('[data-rmc]');
    if (rm) { picked.splice(+rm.dataset.rmc, 1); draw(); return; }
    var ad = e.target.closest('[data-addc]');
    if (ad) {
      var p = picked[+ad.dataset.addc]; ad.disabled = true;
      api('addColour', S.pin, p.name, p.hex).then(function () {
        S.boot.lists['Colours'] = (S.boot.lists['Colours'] || []).concat([p.name]);
        S.boot.meta.swatches = S.boot.meta.swatches || {}; S.boot.meta.swatches[p.name] = p.hex; saveBoot(S.boot);
        picked.forEach(function (q) { if (q.name === p.name) q.isNew = false; });
        toast(p.name + ' added to the colour master with code ' + p.hex + '.'); draw();
      }).catch(function (err) { ad.disabled = false; toast(err.message, 'err'); });
    }
  });
  canvas.addEventListener('click', function (e) {
    if (!ctx) return;
    var rect = canvas.getBoundingClientRect(), x = Math.round((e.clientX - rect.left) * cw / (rect.width || cw)), y = Math.round((e.clientY - rect.top) * ch / (rect.height || ch));
    var sz = 7, x0 = Math.max(0, Math.min(cw - sz, x - 3)), y0 = Math.max(0, Math.min(ch - sz, y - 3));
    var d = ctx.getImageData(x0, y0, sz, sz).data, r = 0, g = 0, b = 0, n = d.length / 4;
    for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    add(rgbToHex(r / n, g / n, b / n), false);
  });
  var url = URL.createObjectURL(file), img = new Image();
  img.onload = function () {
    var s2 = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    cw = canvas.width = Math.max(1, Math.round(img.naturalWidth * s2)); ch = canvas.height = Math.max(1, Math.round(img.naturalHeight * s2));
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, cw, ch);
    URL.revokeObjectURL(url);
    try { dominantColours(ctx, cw, ch).forEach(function (h) { add(h, true); }); } catch (e) { /* picking still works */ }
  };
  img.onerror = function () { box.innerHTML = '<p class="hint">This photo cannot be shown for colour picking. Use the colour buttons instead.</p>'; };
  img.src = url;
  draw();
  return {
    get: info,
    setNames: function (names) { /* spoken colours become main colours when nothing was picked */
      names.forEach(function (nm) { if (!picked.some(function (p) { return p.name === nm; })) picked.push({ role: 'main', name: nm, hex: hexOf(nm), isNew: false, spoken: true }); });
      draw();
    }
  };
}

/* ================= voice: speech to fields ================= */
var NUMW = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
var TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
var ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7 };
var LETTERS = { a: 'a|ay|eh', b: 'b|bee|be|bi', c: 'c|see|sea|si', d: 'd|dee|di', e: 'e|ee', f: 'f|ef|eff', g: 'g|gee|ji|jee', h: 'h|aitch|etch',
  i: 'i|eye', j: 'j|jay', k: 'k|kay|ke', l: 'l|el|ell', m: 'm|em', n: 'n|en', o: 'o|oh', p: 'p|pee|pe|pi', q: 'q|queue|cue', r: 'r|are|ar',
  s: 's|ess|es', t: 't|tee|tea|ti', u: 'u|you', v: 'v|vee|we', w: 'w|double u', x: 'x|ex', y: 'y|why', z: 'z|zed|zee' };
function normText(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function numberWords(t) {
  var tk = t.split(' '), out = [];
  for (var i = 0; i < tk.length; i++) {
    var w = tk[i];
    if (TENS[w] !== undefined) { var n = TENS[w]; if (NUMW[tk[i + 1]] !== undefined && NUMW[tk[i + 1]] < 10 && tk[i + 1] !== 'oh') { n += NUMW[tk[i + 1]]; i++; } out.push(String(n)); }
    else if (NUMW[w] !== undefined && (w !== 'oh' || /^\d$/.test(out[out.length - 1] || '') || NUMW[tk[i + 1]] !== undefined)) out.push(String(NUMW[w]));
    else out.push(w);
  }
  // "zero three six" -> "036"
  var joined = [];
  out.forEach(function (w) { if (/^\d$/.test(w) && /^\d+$/.test(joined[joined.length - 1] || '') && joined[joined.length - 1].length < 4 && joined._lastSingle) joined[joined.length - 1] += w; else joined.push(w); joined._lastSingle = /^\d$/.test(w); });
  return joined.join(' ');
}
function lev(a, b) {
  if (a === b) return 0;
  var m = a.length, n = b.length, d = [], i, j;
  for (i = 0; i <= m; i++) d[i] = [i];
  for (j = 0; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function close(a, b) { if (a === b) return true; if (Math.min(a.length, b.length) < 5) return false; return lev(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1); }
/** Find the best phrase match in text. cands: [{phrase, value}] */
function findPhrase(words, cands) {
  var best = null;
  cands.forEach(function (c) {
    var pw = c.phrase.split(' '), L = pw.length;
    for (var i = 0; i + L <= words.length; i++) {
      var ok = true;
      for (var j = 0; j < L; j++) if (!close(words[i + j], pw[j])) { ok = false; break; }
      if (ok && (!best || c.phrase.length > best.phrase.length)) best = { phrase: c.phrase, value: c.value, at: i, len: L };
    }
  });
  return best;
}
function plantPhrases() {
  var out = [], al = (S.boot.aliases && S.boot.aliases.plant) || {};
  S.boot.plants.forEach(function (p) {
    [p.en, p.bot ? p.bot.split(' ')[0] : ''].concat(['ta', 'te', 'ml', 'kn', 'hi'].map(function (k) { var m = String(p[k] || '').match(/\(([^)]+)\)/); return m ? m[1] : ''; }))
      .forEach(function (x) { var n = normText(String(x).replace(/\(.*?\)/g, '')); if (n.length > 2) out.push({ phrase: n, value: p.id }); });
  });
  Object.keys(al).forEach(function (h) { out.push({ phrase: normText(h), value: al[h] }); });
  return out;
}
function varietyPhrases(plantId) {
  var out = [], al = (S.boot.aliases && S.boot.aliases.variety) || {};
  S.boot.varieties.forEach(function (v) {
    if (plantId && v.plantId !== plantId) return;
    [v.name, v.trade].forEach(function (x) { var n = normText(x); if (n.length > 2) out.push({ phrase: n, value: v.id }); });
  });
  Object.keys(al).forEach(function (h) { var v = S.vm[al[h]]; if (v && (!plantId || v.plantId === plantId)) out.push({ phrase: normText(h), value: v.id }); });
  return out;
}
function parseSpeech(text) {
  var t = numberWords(normText(text)), words = t.split(' ').filter(Boolean), r = { colours: [], edge: [], centre: [], score: 0 };
  // pot
  if (/\b(empty|no pot|not numbered|no number|ground)\b/.test(t)) r.noPot = true;
  else (S.boot.potCodes || []).some(function (c) {
    var pat = String(c.code).toLowerCase().split('').map(function (l) { return '(?:' + (LETTERS[l] || l) + ')'; }).join('\\s*');
    var m = t.match(new RegExp('(?:^|\\s)(?:pot\\s+|part\\s+|port\\s+|number\\s+)?' + pat + '\\s*(\\d{1,4})(?=\\s|$)'));
    if (m) { r.potRef = c.code + String(+m[1]).padStart(+c.digits || 3, '0'); r.pot = findPot(r.potRef); return true; }
    return false;
  });
  // stage
  var stages = ((S.boot.lists && S.boot.lists['Photo stages']) || FLOWER_STAGES);
  var dm = t.match(/\bday\s*(\d{1,2})\b/) || (function () { var o = t.match(/\b(first|second|third|fourth|fifth|sixth|seventh) day\b/); return o ? [o[0], String(ORD[o[1]])] : null; })();
  var stageMap = [[/\bbud open(ing)?\b|\bopening bud\b/, 'Bud opening'], [/\bbud\b/, 'Bud'], [/\bfull(y)? (bloom|open|flower)\b/, 'Full bloom'],
    [/\bfad(ing|ed)\b/, 'Fading'], [/\bseed pod\b/, 'Seed pod'], [/\bseeds?\b/, 'Seeds'], [/\bdr(ied|y)\b/, 'Dried'], [/\bnew lea(f|ves)\b/, 'New leaf'],
    [/\bnew shoot\b/, 'New shoot'], [/\bfruit set\b/, 'Fruit set'], [/\bripe\b/, 'Ripe fruit'], [/\bwhole plant\b/, 'Whole plant'], [/\b(pest|disease)\b/, 'Pest or disease']];
  if (dm) r.stage = 'Day ' + (+dm[1]);
  else stageMap.some(function (sm) { if (sm[0].test(t)) { r.stage = sm[1]; return true; } return false; });
  if (r.stage && stages.indexOf(r.stage) < 0 && !/^Day \d+$/.test(r.stage)) r.stage = '';
  r.archive = /\b(old photo|archive|old picture)\b/.test(t);
  // plant and variety
  var pm = findPhrase(words, plantPhrases());
  if (pm) r.plantId = pm.value;
  var vm = findPhrase(words, varietyPhrases(r.plantId));
  if (vm) { r.varietyId = vm.value; if (!r.plantId && S.vm[vm.value]) r.plantId = S.vm[vm.value].plantId; }
  if (r.pot && !r.plantId) { r.plantId = r.pot.plantId; r.varietyId = r.varietyId || r.pot.varietyId; }
  // colours: "white edge", "yellow centre"
  var cAl = (S.boot.aliases && S.boot.aliases.colour) || {};
  var cands = ((S.boot.lists && S.boot.lists['Colours']) || []).map(function (c) { return { phrase: normText(c), value: c }; })
    .concat(Object.keys(cAl).map(function (h) { return { phrase: normText(h), value: cAl[h] }; }))
    .sort(function (a, b) { return b.phrase.length - a.phrase.length; });
  var used = {};
  cands.forEach(function (c) {
    var pw = c.phrase.split(' ');
    for (var i = 0; i + pw.length <= words.length; i++) {
      if (used[i]) continue;
      if (pw.every(function (w, j) { return words[i + j] === w; })) {
        for (var j = 0; j < pw.length; j++) used[i + j] = 1;
        var after = words.slice(i + pw.length, i + pw.length + 2).join(' '), before = words.slice(Math.max(0, i - 2), i).join(' ');
        var list = /\b(edge|edges|edged|border|tip|tips|tipped|rim)\b/.test(after) || /\b(edged|tipped)\b/.test(before) ? r.edge
          : /\b(centre|center|eye|throat|middle|heart)\b/.test(after) ? r.centre : r.colours;
        if (list.indexOf(c.value) < 0) list.push(c.value);
      }
    }
  });
  r.score = (r.plantId ? 3 : 0) + (r.varietyId ? 3 : 0) + (r.pot || r.noPot ? 2 : 0) + (r.stage ? 1 : 0) + (r.colours.length + r.edge.length + r.centre.length) * 0.5;
  return r;
}
function startListening(onText, onDone) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  var rec = new SR();
  rec.lang = 'en-IN'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 3;
  rec.onresult = function (e) {
    var res = e.results[e.results.length - 1], alts = [];
    for (var a = 0; a < res.length; a++) alts.push(res[a].transcript);
    var full = '';
    for (var i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + ' ';
    onText(full.trim(), res.isFinal, alts);
  };
  rec.onerror = function (e) { onDone(e.error || 'error'); };
  rec.onend = function () { onDone(); };
  try { rec.start(); } catch (e) { return null; }
  return rec;
}

/* ================= offline queue (on the phone) ================= */
var Q = {
  db: function () {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('no storage')); return; }
      var r = indexedDB.open('g109a', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('queue', { keyPath: 'qid' }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  },
  run: function (mode, fn) { return Q.db().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction('queue', mode), st = tx.objectStore('queue'), out = fn(st); tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; tx.onerror = function () { rej(tx.error); }; }); }); },
  add: function (item) { return Q.run('readwrite', function (st) { st.put(item); }); },
  all: function () { return Q.run('readonly', function (st) { return st.getAll(); }); },
  del: function (qid) { return Q.run('readwrite', function (st) { st.delete(qid); }); }
};
var syncing = false, upErr = '';
/** One queued capture: make the clean + labelled copies (if not done) and upload. */
function processItem(it) {
  var prep = it.b64 ? Promise.resolve({ clean: it.b64, labelled: it.meta.labelB64 || null })
    : prepareImages(new Blob([it.raw], { type: it.rawType || 'image/jpeg' }), Object.assign({ shotBy: it.meta.who, gps: it.gps }, it.meta));
  return prep.then(function (imgs) {
    var meta = Object.assign({}, it.meta, { labelB64: imgs.labelled || '' });
    return api('saveCapture', S.pin, meta, imgs.clean);
  }).then(function (res) {
    if (!res.filed) S.boot.captureCount = (S.boot.captureCount || 0) + 1; // a duplicate means the first answer was lost, so it was not counted yet
    if (res.filed) S.calCache = {};
    return res;
  });
}
function flushQueue(silent) {
  if (syncing || !isOwner()) return Promise.resolve(0);
  if (!navigator.onLine) { updateWaiting(); return Promise.resolve(0); }
  syncing = true; upErr = '';
  var done = 0, filed = 0, tried = {};
  function next() {
    return Q.all().then(function (items) {
      items = items || [];
      var it = items.filter(function (x) { return !tried[x.qid]; })[0];
      if (!it) return null;
      tried[it.qid] = 1;
      updateWaiting(items.length);
      return processItem(it).then(function (res) {
        done++; if (res.filed) filed++;
        return Q.del(it.qid);
      }, function (err) {
        if (/reach|internet/i.test(err.message)) throw err;      // offline: stop, try again later
        upErr = err.message; it.err = err.message; return Q.add(it); // keep it, show the problem
      }).then(next);
    });
  }
  return next().catch(function () {}).then(function () {
    syncing = false;
    if (done) { renderChrome(); if (!silent || done > 1) toast(done === 1 ? (filed ? 'Photo uploaded and filed.' : 'Photo uploaded to Review.') : done + ' photos uploaded' + (filed ? ' (' + filed + ' filed)' : '') + '.'); }
    updateWaiting();
    return done;
  });
}
function updateWaiting(nNow) {
  var el = $('#qWait'); if (!el) return;
  Q.all().then(function (items) {
    var n = nNow || (items || []).length;
    if (!n) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = !navigator.onLine ? (n === 1 ? '1 photo is saved on this phone. It will upload' : n + ' photos are saved on this phone. They will upload') + ' when you are online.'
      : syncing ? 'Uploading ' + n + (n === 1 ? ' photo' : ' photos') + '… you can keep taking photos.'
      : upErr ? n + ' waiting. Last try failed: ' + upErr + ' It will try again.' : n + ' waiting to upload.';
  }).catch(function () { el.hidden = true; });
}
window.addEventListener('online', function () { flushQueue(false); });

/* ================= owner: quick capture ================= */
function whoAmI() { try { return localStorage.getItem('g109a_who') || ''; } catch (e) { return ''; } }
function viewCapture() {
  var stages = ((S.boot.lists && S.boot.lists['Photo stages']) || FLOWER_STAGES).filter(function (x) { return hiddenOf('Photo stages').indexOf(x) < 0; });
  var hasMic = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  var auto = false; try { auto = localStorage.getItem('g109a_autofile') === '1'; } catch (e) {}
  app.innerHTML = '<div class="page-h"><h1>Quick capture</h1><p class="muted">Take a photo, tap the flower for colours, and say the plant, variety, pot and stage. Check it later in Review.</p></div>' +
    '<p class="note" id="qWait" hidden></p>' +
    '<form id="cForm" class="form" novalidate>' +
      (whoAmI() ? '' : '<div class="field"><label for="cWho">Who is using this phone?</label><input id="cWho" autocomplete="name" placeholder="Your name"><p class="hint">Asked once. Each capture records who took it.</p></div>') +
      '<div class="pick"><label class="pick-btn"><input type="file" accept="image/*" capture="environment" id="cCam">' + icon('camera', 28) + '<span>Take photo</span></label>' +
      '<label class="pick-btn"><input type="file" accept="image/*" id="cGal">' + icon('image', 28) + '<span>Choose a photo</span></label></div>' +
      '<div id="cTool"></div>' +
      '<fieldset class="fs"><legend>Say it</legend>' +
        '<div class="row gap"><button type="button" class="btn btn-primary lg mic" id="cMic"' + (hasMic ? '' : ' hidden') + '>' + icon('mic', 22) + '<span>Tap and speak</span></button>' +
        '<span class="muted sm" id="cMicMsg">' + (hasMic ? 'Example: "Tuberose, Cherry, pot T 36, day two, pink with white edge". Say "empty" if the pot has no number.' : 'Voice is not available in this browser. Use the 🎤 on your keyboard to speak into the box.') + '</span></div>' +
        '<div class="field"><label for="cHeard">What you said (you can also type)</label><textarea id="cHeard" rows="2"></textarea></div>' +
        '<div class="chips" id="cChips" aria-live="polite"></div>' +
      '</fieldset>' +
      '<fieldset class="fs"><legend>Check the details</legend><div class="f2">' +
        '<div class="field"><label for="cPot">Pot ref</label><input id="cPot" list="potRefs" autocomplete="off" autocapitalize="characters" placeholder="e.g. T036, or leave empty">' + potDatalist('potRefs') + '<p class="hint" id="cPotMsg"></p></div>' +
        comboHtml('cPlant', 'Plant', 'Type: lotus, sampangi…') + comboHtml('cVar', 'Variety', 'Type a variety name') +
        '<div class="field"><label for="cStage">Stage</label><select id="cStage"><option value="">Not set</option>' + stages.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div></div>' +
        '<label class="sw"><input type="checkbox" id="cOld"><span>Old photo (archive)</span></label>' +
        '<label class="sw"><input type="checkbox" id="cAuto"' + (auto ? ' checked' : '') + '><span>File straight away when everything is clear (skip Review)</span></label>' +
      '</fieldset>' +
      '<div class="actions"><button class="btn btn-primary lg" type="submit" id="cSave">Save capture</button></div></form>';
  var file = null, when = null, tool = null, potState = { pot: null, none: false }, rec = null, lastParse = null;
  var plantC = Combo('cPlant', plantComboOpts(), ''), varC = Combo('cVar', varietyComboOpts('', false), '');
  plantC.onChange(function () { varC.setOptions(varietyComboOpts(plantC.value, false), ''); if (potState.pot && potState.pot.plantId !== plantC.value) setPot(null, false); });
  function setPot(p, none, ref) {
    potState = { pot: p, none: !!none };
    var m = $('#cPotMsg');
    if (none) { $('#cPot').value = ''; m.textContent = 'No pot number.'; m.className = 'hint good'; return; }
    if (p) { $('#cPot').value = p.ref; m.textContent = p.plant + (p.variety ? ', ' + p.variety : ''); m.className = 'hint good'; return; }
    if (ref) { $('#cPot').value = ref; m.textContent = ref + ' is not an active pot. Add it from Add photo or Pots, or leave empty.'; m.className = 'hint bad'; return; }
    m.textContent = ''; m.className = 'hint';
  }
  $('#cPot').addEventListener('change', function () {
    var v = $('#cPot').value.trim(); if (!v) { setPot(null, false); return; }
    var p = findPot(v); setPot(p, false, p ? '' : v.toUpperCase());
    if (p) { plantC.value = p.plantId; varC.setOptions(varietyComboOpts(p.plantId, false), p.varietyId); }
  });
  function applyParse(r) {
    lastParse = r;
    if (r.noPot) setPot(null, true);
    else if (r.pot) setPot(r.pot);
    else if (r.potRef) setPot(null, false, r.potRef);
    if (r.plantId) { plantC.value = r.plantId; varC.setOptions(varietyComboOpts(r.plantId, false), r.varietyId || ''); }
    if (r.stage) $('#cStage').value = r.stage;
    if (r.archive) $('#cOld').checked = true;
    var names = r.colours.concat(r.edge.map(function (c) { return c; })).concat(r.centre);
    if (tool && r.colours.length && !tool.get().main.some(function (p) { return !p.auto; })) tool.setNames(r.colours);
    var chips = [];
    if (r.plantId) chips.push(plantName(r.plantId)); if (r.varietyId) chips.push(varLabel(S.vm[r.varietyId]));
    if (r.noPot) chips.push('No pot'); else if (r.potRef) chips.push(r.potRef + (r.pot ? '' : ' (not found)'));
    if (r.stage) chips.push(r.stage); if (r.archive) chips.push('Old photo');
    r.colours.forEach(function (c) { chips.push(c); }); r.edge.forEach(function (c) { chips.push(c + ' edge'); }); r.centre.forEach(function (c) { chips.push(c + ' centre'); });
    $('#cChips').innerHTML = chips.length ? chips.map(function (c) { return '<span class="badge b-leaf">' + esc(c) + '</span>'; }).join('') : '<span class="muted sm">Nothing matched yet. Speak again, or fill below.</span>';
    return names;
  }
  $('#cHeard').addEventListener('change', function () { applyParse(parseSpeech($('#cHeard').value)); });
  $('#cMic').addEventListener('click', function () {
    if (rec) { rec.stop(); return; }
    var btn = $('#cMic'); $('span', btn).textContent = 'Listening… tap to stop'; btn.classList.add('on');
    rec = startListening(function (txt, fin, alts) {
      $('#cHeard').value = txt;
      if (fin) {
        var best = (alts && alts.length ? alts : [txt]).map(parseSpeech).sort(function (a, b) { return b.score - a.score; })[0];
        applyParse(best);
      }
    }, function (err) {
      rec = null; $('span', btn).textContent = 'Tap and speak'; btn.classList.remove('on');
      if (err && err !== 'no-speech' && err !== 'aborted') $('#cMicMsg').textContent = err === 'not-allowed' ? 'Please allow the microphone for this app, then try again.' : 'Voice did not work (' + err + '). Use the 🎤 on your keyboard instead.';
    });
    if (!rec) { $('span', btn).textContent = 'Tap and speak'; btn.classList.remove('on'); $('#cMicMsg').textContent = 'Voice could not start. Use the 🎤 on your keyboard instead.'; }
  });
  function onPhoto(f, source) {
    if (!f) return;
    file = f; file._source = source;
    readExif(f).then(function (ex) { when = (ex && ex.date ? ex : null) || (source === 'camera' ? { date: today(), time: nowTime() } : fromTs(f.lastModified)) || { date: today(), time: nowTime() }; if (ex && ex.gps) when.gps = ex.gps; });
    tool = mountColourTool($('#cTool'), f, null);
  }
  $('#cCam').addEventListener('change', function (e) { onPhoto(e.target.files[0], 'camera'); e.target.value = ''; });
  $('#cGal').addEventListener('change', function (e) { onPhoto(e.target.files[0], 'gallery'); e.target.value = ''; });
  $('#cForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var whoIn = $('#cWho');
    if (whoIn) { if (!whoIn.value.trim()) { toast('Please type your name once.', 'err'); whoIn.focus(); return; } try { localStorage.setItem('g109a_who', whoIn.value.trim()); } catch (er) {} }
    if (!file) { toast('Take or choose a photo first.', 'err'); return; }
    var autoOn = $('#cAuto').checked; try { localStorage.setItem('g109a_autofile', autoOn ? '1' : '0'); } catch (er) {}
    var ci = tool ? tool.get() : { main: [], edge: [], centre: [] };
    var spokenEdge = lastParse ? lastParse.edge : [], spokenCentre = lastParse ? lastParse.centre : [];
    var uniq = function (a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); };
    var clear = !!plantC.value && !!$('#cStage').value && (potState.none || !!potState.pot);
    var meta = {
      date: (when || {}).date || today(), time: (when || {}).time || nowTime(), who: whoAmI(), heard: $('#cHeard').value.trim(),
      plantId: plantC.value, varietyId: varC.value, potUid: potState.pot ? potState.pot.uid : '', potNo: potState.pot ? potState.pot.ref : '',
      stage: $('#cStage').value, archive: $('#cOld').checked,
      colour: uniq(ci.main.map(function (p) { return p.name; })), colourCodes: uniq(ci.main.map(function (p) { return p.hex; })),
      edge: uniq(ci.edge.map(function (p) { return p.name; }).concat(spokenEdge)), centre: uniq(ci.centre.map(function (p) { return p.name; }).concat(spokenCentre)),
      autoFile: autoOn && clear
    };
    var btn = $('#cSave'); btn.disabled = true; btn.textContent = 'Saving…';
    var gps0 = (when || {}).gps;
    if (window.indexedDB) {
      var savedFile = file;
      readBytes(savedFile).then(function (buf) {
        var qid = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        meta.qid = qid;
        return Q.add({ qid: qid, v: 2, meta: meta, raw: buf, rawType: savedFile.type || 'image/jpeg', gps: gps0 });
      }).then(function () {
        file = null; tool = null; lastParse = null; $('#cTool').innerHTML = ''; $('#cHeard').value = ''; $('#cChips').innerHTML = '';
        $('#cStage').value = ''; $('#cOld').checked = false; setPot(null, false); plantC.value = ''; varC.setOptions(varietyComboOpts('', false), '');
        var w2 = $('#cWho'); if (w2) w2.closest('.field').remove();
        toast(navigator.onLine ? 'Saved. Uploading in the background. Take the next one!' : 'Saved on this phone. It will upload when you are online.');
        updateWaiting(); flushQueue(true);
      }).catch(function (err) { toast('Could not keep the photo on this phone: ' + err.message, 'err'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Save capture'; });
      return;
    }
    var reset = function (msg) {
      delete meta.labelB64;
      toast(msg); file = null; tool = null; lastParse = null; $('#cTool').innerHTML = ''; $('#cHeard').value = ''; $('#cChips').innerHTML = '';
      $('#cStage').value = ''; $('#cOld').checked = false; setPot(null, false); plantC.value = ''; varC.setOptions(varietyComboOpts('', false), '');
      var w2 = $('#cWho'); if (w2) w2.closest('.field').remove();
    };
    var queue = function (b64) {
      return Q.add({ qid: 'q' + Date.now(), meta: meta, b64: b64 }).then(function () { updateWaiting(); reset('No internet: saved on this phone. It will upload by itself later.'); });
    };
    var pot0 = potState.pot;
    prepareImages(file, { plantId: meta.plantId, varietyId: meta.varietyId, potNo: meta.potNo, stage: meta.stage, date: meta.date, time: meta.time,
      colour: meta.colour, colourCodes: meta.colourCodes, edge: meta.edge, centre: meta.centre, shotBy: meta.who, gps: (when || {}).gps }).then(function (imgs) {
      meta.labelB64 = imgs.labelled;
      var b64 = imgs.clean;
      if (!navigator.onLine && window.indexedDB) return queue(b64);
      return api('saveCapture', S.pin, meta, b64).then(function (res) {
        if (res.filed) reset('Saved and filed' + (res.filed.counted ? ' (Day 1 counted)' : '') + '. Next one!');
        else { S.boot.captureCount = (S.boot.captureCount || 0) + 1; renderChrome(); reset('Saved to Review. Next one!'); }
      }, function (err) {
        if (window.indexedDB && /reach|internet/i.test(err.message)) return queue(b64);
        throw err;
      });
    }).catch(function (err) { toast(err.message, 'err'); }).then(function () { btn.disabled = false; btn.textContent = 'Save capture'; });
  });
  updateWaiting();
}

/* ================= owner: review captures ================= */
function viewReview() {
  app.innerHTML = '<div class="page-h"><h1>Review</h1><p class="muted">Captures waiting to be filed. Check each one, fix anything, then tap File it.</p></div>' +
    '<div class="row gap" style="margin-bottom:12px"><button type="button" class="btn" id="rvAll">File all that have a plant</button><span class="muted sm" id="rvCount"></span></div>' +
    '<div id="rvList"><p class="muted">Loading…</p></div>';
  var stages = ((S.boot.lists && S.boot.lists['Photo stages']) || FLOWER_STAGES);
  var combos = {};
  function card(c) {
    var pot = c.potUid ? (S.boot.pots || []).filter(function (p) { return p.uid === c.potUid; })[0] : null;
    var cols = splitColours(c.colour).map(function (n, i) { var codes = splitColours(c.colourCodes); return '<span class="ct-chip"><span class="sw-dot" style="background:' + (codes[i] || hexOf(n)) + '"></span>' + esc(n) + '</span>'; })
      .concat(splitColours(c.edge).map(function (n) { return '<span class="ct-chip"><span class="sw-dot" style="background:' + hexOf(n) + '"></span>' + esc(n) + ' edge</span>'; }))
      .concat(splitColours(c.centre).map(function (n) { return '<span class="ct-chip"><span class="sw-dot" style="background:' + hexOf(n) + '"></span>' + esc(n) + ' centre</span>'; })).join('');
    return '<article class="card rv" data-id="' + esc(c.id) + '"><div class="rv-img"><img src="' + imgUrl(c.fileId, 600) + '" alt="Captured photo" loading="lazy"></div><div class="rv-body">' +
      '<p class="muted sm">' + esc([c.id, fmtDate(c.date), c.time, c.who ? 'by ' + c.who : ''].filter(Boolean).join(' · ')) + '</p>' +
      (c.heard ? '<p class="rv-heard">“' + esc(c.heard) + '”</p>' : '') +
      '<div class="f2">' +
        '<div class="field"><label for="rvPot_' + c.id + '">Pot ref</label><input id="rvPot_' + c.id + '" list="potRefs" autocomplete="off" autocapitalize="characters" value="' + esc(pot ? pot.ref : (c.potNo || '')) + '" placeholder="Empty = no pot"></div>' +
        comboHtml('rvP_' + c.id, 'Plant') + comboHtml('rvV_' + c.id, 'Variety') +
        '<div class="field"><label for="rvS_' + c.id + '">Stage</label><select id="rvS_' + c.id + '"><option value="">Not set</option>' + stages.map(function (x) { return '<option' + (x === c.stage ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div></div>' +
      (cols ? '<div class="chips">' + cols + '</div>' : '') +
      '<label class="sw"><input type="checkbox" id="rvO_' + c.id + '"' + (c.archive ? ' checked' : '') + '><span>Old photo (archive)</span></label>' +
      '<details class="rv-teach"><summary>Teach the app a word</summary><div class="f2"><div class="field"><label for="rvW_' + c.id + '">When I say</label><input id="rvW_' + c.id + '" placeholder="e.g. some bungee"></div>' +
        '<div class="field"><label for="rvK_' + c.id + '">I mean</label><select id="rvK_' + c.id + '"><option value="plant">the plant chosen above</option><option value="variety">the variety chosen above</option></select></div></div>' +
        '<button type="button" class="btn sm" data-rv="teach">Remember</button></details>' +
      '<div class="row gap"><button type="button" class="btn btn-primary" data-rv="file">File it</button><button type="button" class="btn" data-rv="skip">Skip</button><button type="button" class="btn pe-del" data-rv="del">Delete</button></div>' +
      '</div></article>';
  }
  function bind(c) {
    var pc = Combo('rvP_' + c.id, plantComboOpts(), c.plantId), vc = Combo('rvV_' + c.id, varietyComboOpts(c.plantId, false), c.varietyId);
    pc.onChange(function () { vc.setOptions(varietyComboOpts(pc.value, false), ''); });
    combos[c.id] = { p: pc, v: vc, c: c };
  }
  function count() { var n = $$('.rv', app).length; $('#rvCount').textContent = n + (n === 1 ? ' waiting' : ' waiting'); S.boot.captureCount = n; renderChrome(); if (!n) $('#rvList').innerHTML = '<div class="empty">All done. Nothing waiting.</div>'; }
  function fileOne(id) {
    var cb = combos[id], art = $('.rv[data-id="' + id + '"]'), potV = $('#rvPot_' + id).value.trim(), pot = potV ? findPot(potV) : null;
    if (potV && !pot) return Promise.reject(new Error(id + ': pot "' + potV + '" is not an active pot.'));
    if (!cb.p.value) return Promise.reject(new Error(id + ': pick the plant.'));
    var ch = { plantId: cb.p.value, varietyId: cb.v.value, potUid: pot ? pot.uid : '', potNo: pot ? pot.ref : '', stage: $('#rvS_' + id).value, archive: $('#rvO_' + id).checked };
    return api('fileCapture', S.pin, id, ch)
      .then(function (res) {
        if (art) art.remove();
        var ph = { date: cb.c.date, time: cb.c.time, plantId: ch.plantId, varietyId: ch.varietyId, stage: ch.stage, colour: cb.c.colour, colourCodes: cb.c.colourCodes,
          edge: cb.c.edge, centre: cb.c.centre, shotBy: cb.c.who, bloom: res.bloom, fileId: res.fileId, labelId: res.labelId, archive: ch.archive, gallery: true, potNo: ch.potNo };
        S.boot.photos.unshift(ph);
        if (res.needsLabel) relabel(ph).catch(function () {});
        return res;
      });
  }
  app.onclick = function (e) {
    var b = e.target.closest('[data-rv]'); if (!b) return;
    var art = b.closest('.rv'), id = art.dataset.id, act = b.dataset.rv;
    b.disabled = true;
    var p;
    if (act === 'file') p = fileOne(id).then(function (res) { toast(id + ' filed' + (res.counted ? ', Day 1 counted' : '') + (res.bloom ? ', flower ' + res.bloom : '') + '.'); count(); });
    else if (act === 'skip' || act === 'del') {
      if (act === 'del' && !window.confirm('Delete this capture? The photo goes to Drive trash.')) { b.disabled = false; return; }
      p = api('skipCapture', S.pin, id, act === 'del').then(function () { art.remove(); toast(id + (act === 'del' ? ' deleted.' : ' skipped.')); count(); });
    } else if (act === 'teach') {
      var word = $('#rvW_' + id).value.trim(), kind = $('#rvK_' + id).value, val = kind === 'plant' ? combos[id].p.value : combos[id].v.value;
      if (!word || !val) { b.disabled = false; toast('Type the word and choose the ' + kind + ' above first.', 'err'); return; }
      p = api('saveAlias', S.pin, kind, word, val).then(function (al) {
        S.boot.aliases = al; saveBoot(S.boot); b.disabled = false;
        toast('Remembered: "' + word + '" = ' + (kind === 'plant' ? plantName(val) : varLabel(S.vm[val])) + '.');
      });
    }
    if (p) p.catch(function (err) { b.disabled = false; toast(err.message, 'err'); });
  };
  $('#rvAll').addEventListener('click', function () {
    var ids = Object.keys(combos).filter(function (id) { return $('.rv[data-id="' + id + '"]') && combos[id].p.value; });
    if (!ids.length) { toast('No capture has a plant chosen yet.', 'err'); return; }
    var btn = $('#rvAll'); btn.disabled = true; var ok = 0, errs = [];
    ids.reduce(function (ch, id) { return ch.then(function () { return fileOne(id).then(function () { ok++; }, function (er) { errs.push(er.message); }); }); }, Promise.resolve())
      .then(function () { btn.disabled = false; count(); toast(ok + ' filed.' + (errs.length ? ' Not filed: ' + errs.join(' ') : ''), errs.length ? 'err' : ''); });
  });
  api('getCaptures', S.pin, 'New').then(function (list) {
    if (route().page !== 'review') return;
    $('#rvList').innerHTML = list.length ? list.map(card).join('') + potDatalist('potRefs') : '';
    list.forEach(bind); count();
  }).catch(function (err) { $('#rvList').innerHTML = '<p class="hint bad">' + esc(err.message) + '</p>'; });
}

/* ================= flower calendar ================= */
var WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function viewCalendar(arg) {
  var a = parseArgs(arg);
  var F = S.calF = S.calF || { view: 'month', ym: today().slice(0, 7), year: +today().slice(0, 4), group: '', plant: '', variety: '', pot: '', colour: '', stage: '', kind: '', day: '' };
  if (a.view) F.view = a.view;
  if (a.m) { F.ym = a.m; F.year = +a.m.slice(0, 4); F.day = ''; }
  if (a.plant) { F.plant = decodeURIComponent(a.plant); F.group = ''; F.variety = ''; }
  var groups = [];
  S.boot.plants.forEach(function (p) { if (p.group && groups.indexOf(p.group) < 0) groups.push(p.group); });
  var stages = ((S.boot.lists && S.boot.lists['Photo stages']) || FLOWER_STAGES);
  app.innerHTML = '<div class="page-h"><h1>Flower calendar</h1><p class="muted">Every day you took photos. Filter by plant, variety, pot or colour.</p></div>' +
    '<div class="tabs" role="tablist" aria-label="Calendar view" style="max-width:420px"><button type="button" role="tab" data-cv="month">Month</button><button type="button" role="tab" data-cv="year">Year</button></div>' +
    '<details class="addbox cal-f" id="calF"' + (window.innerWidth > 760 || F.plant || F.colour || F.pot ? ' open' : '') + '><summary>Filters <span class="muted sm" id="calFN"></span></summary><div class="form" style="max-width:none"><div class="f2">' +
      '<div class="field"><label for="cfG">Group</label><select id="cfG"><option value="">All groups</option>' + groups.map(function (g) { return '<option' + (g === F.group ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="cfP">Plant</label><select id="cfP"></select></div>' +
      '<div class="field"><label for="cfV">Variety</label><select id="cfV"></select></div>' +
      '<div class="field"><label for="cfPot">Pot ref</label><input id="cfPot" autocomplete="off" autocapitalize="characters" placeholder="e.g. T036" value="' + esc(F.pot) + '"></div>' +
      '<div class="field"><label for="cfC">Colour</label><select id="cfC"><option value="">Any colour</option>' + colourNames().map(function (c) { return '<option' + (c === F.colour ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="cfS">Stage</label><select id="cfS"><option value="">Any stage</option>' + stages.map(function (x) { return '<option' + (x === F.stage ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="cfK">Show</label><select id="cfK"><option value="">All photos</option><option value="new"' + (F.kind === 'new' ? ' selected' : '') + '>New photos</option><option value="old"' + (F.kind === 'old' ? ' selected' : '') + '>Old photos (archive)</option></select></div>' +
      '</div><div><button type="button" class="btn sm" id="cfClear">Clear filters</button></div></div></details>' +
    '<div id="calBody"><p class="muted">Loading…</p></div>';
  function fillPlants() {
    var ps = S.boot.plants.filter(function (p) { return !F.group || p.group === F.group; });
    if (F.plant && !ps.some(function (p) { return p.id === F.plant; })) F.plant = '';
    $('#cfP').innerHTML = '<option value="">All plants</option>' + ps.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === F.plant ? ' selected' : '') + '>' + esc(p.en) + '</option>'; }).join('');
    var vs = F.plant ? S.boot.varieties.filter(function (v) { return v.plantId === F.plant; }) : [];
    if (F.variety && !vs.some(function (v) { return v.id === F.variety; })) F.variety = '';
    $('#cfV').innerHTML = '<option value="">' + (F.plant ? 'All varieties' : 'Pick a plant first') + '</option>' + vs.map(function (v) { return '<option value="' + esc(v.id) + '"' + (v.id === F.variety ? ' selected' : '') + '>' + esc(varLabel(v)) + '</option>'; }).join('');
    $('#cfV').disabled = !F.plant;
  }
  function match(p) {
    var pl = S.pm[p.plantId] || {};
    if (F.group && pl.group !== F.group) return false;
    if (F.plant && p.plantId !== F.plant) return false;
    if (F.variety && p.varietyId !== F.variety) return false;
    if (F.pot) { var a1 = parseRef(F.pot), b1 = parseRef(p.potNo); if (String(p.potNo || '').toUpperCase() !== F.pot.toUpperCase() && !(a1 && b1 && a1.code === b1.code && a1.num === b1.num)) return false; }
    if (F.colour && splitColours(p.colour).concat(splitColours(p.edge), splitColours(p.centre)).indexOf(F.colour) < 0) return false;
    if (F.stage && p.stage !== F.stage) return false;
    if (F.kind === 'new' && p.archive) return false;
    if (F.kind === 'old' && !p.archive) return false;
    return true;
  }
  function nFilters() { var n = ['group', 'plant', 'variety', 'pot', 'colour', 'stage', 'kind'].filter(function (k) { return F[k]; }).length; $('#calFN').textContent = n ? '(' + n + ' on)' : ''; }
  function monthData(ym) {
    S.calCache = S.calCache || {};
    var key = ym + (S.preview ? 'f' : '');
    if (S.calCache[key]) return Promise.resolve(S.calCache[key]);
    return api('getCalendar', S.pin, ym + '-01', ym + '-31', S.preview).then(function (list) { S.calCache[key] = list; return list; });
  }
  function drawMonth() {
    var ym = F.ym, y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
    $('#calBody').innerHTML = '<div class="cal-nav"><button type="button" class="icon-btn" data-cm="-1" aria-label="Previous month">' + icon('back') + '</button>' +
      '<h2 aria-live="polite">' + MONTH_FULL[m] + ' ' + y + '</h2><button type="button" class="icon-btn" data-cm="1" aria-label="Next month">' + icon('next') + '</button>' +
      '<button type="button" class="btn sm" data-cm="0">This month</button></div><div id="calGrid"><p class="muted">Loading…</p></div><div id="calDay"></div>';
    monthData(ym).then(function (list) {
      if (route().page !== 'calendar' || F.ym !== ym || F.view !== 'month') return;
      var rows = list.filter(match), byDay = {};
      rows.forEach(function (p) { (byDay[p.date] = byDay[p.date] || []).push(p); });
      var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), t = today(), cells = '';
      for (var i = 0; i < first; i++) cells += '<div class="cal-c cal-blank" aria-hidden="true"></div>';
      for (var d = 1; d <= days; d++) {
        var ds = ym + '-' + pad(d), ph = byDay[ds] || [];
        cells += '<button type="button" class="cal-c' + (ph.length ? ' has' : '') + (ds === t ? ' today' : '') + (ds === F.day ? ' sel' : '') + '" data-day="' + ds + '"' + (ph.length ? '' : ' disabled') +
          ' aria-label="' + d + ' ' + MONTH_FULL[m] + ': ' + ph.length + (ph.length === 1 ? ' photo' : ' photos') + '"><span class="cal-d">' + d + '</span>' +
          (ph.length ? '<span class="cal-th">' + ph.slice(0, 3).map(function (x) { return '<img src="' + imgUrl(x.fileId, 120) + '" alt="" loading="lazy">'; }).join('') + '</span>' +
            '<span class="cal-n">' + ph.length + '</span>' : '') + '</button>';
      }
      var plantsShot = {}; rows.forEach(function (p) { plantsShot[p.plantId] = 1; });
      $('#calGrid').innerHTML = '<p class="muted sm">' + rows.length + (rows.length === 1 ? ' photo' : ' photos') + ' on ' + Object.keys(byDay).length + ' days · ' + Object.keys(plantsShot).length + ' plants</p>' +
        '<div class="cal-w" aria-hidden="true">' + WEEK.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div><div class="cal-g">' + cells + '</div>';
      S.calByDay = byDay;
      if (F.day && byDay[F.day]) showDay(F.day);
    }).catch(function (err) { $('#calGrid').innerHTML = '<p class="hint bad">' + esc(err.message) + '</p>'; });
  }
  function showDay(ds) {
    F.day = ds;
    $$('.cal-c[data-day]', app).forEach(function (b) { b.classList.toggle('sel', b.dataset.day === ds); });
    var list = (S.calByDay || {})[ds] || [];
    $('#calDay').innerHTML = '<section class="sec" style="margin-top:20px"><h2>' + esc(fmtDate(ds)) + ' · ' + list.length + (list.length === 1 ? ' photo' : ' photos') + '</h2>' + photoGrid('calday', list) + '</section>';
  }
  function drawYear() {
    var y = F.year, nowM = +today().slice(5, 7) - 1, thisYear = +today().slice(0, 4) === y;
    var cam = '<svg class="cam" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
    $('#calBody').innerHTML = '<div class="cal-nav"><button type="button" class="icon-btn" data-cy="-1" aria-label="Previous year">' + icon('back') + '</button><h2>' + y + '</h2>' +
      '<button type="button" class="icon-btn" data-cy="1" aria-label="Next year">' + icon('next') + '</button></div>' +
      '<div class="ylg" aria-label="How to read this">' +
        '<span><span class="bar"></span>Flowering season (care guide)</span>' +
        '<span><span class="fb s1">2</span><span class="fb s2">4</span><span class="fb s3">7</span>Flowers you photographed: bigger circle, more flowers</span>' +
        '<span>' + cam + 'Photos without a flower stage</span></div>' +
      '<div id="yearT"><p class="muted">Loading…</p></div>' +
      '<p class="muted sm" style="margin-top:8px">Counts new photos with a flower stage (Bud, Day 1 …, Full bloom, Fading, Dried, Seeds). Old photos (archive) are left out. Tap any month to see its photos.</p>';
    api('getYearStats', S.pin, y, S.preview).then(function (st) {
      if (route().page !== 'calendar' || F.view !== 'year' || F.year !== y) return;
      var total = function (id) { return st[id] ? st[id].flowers.reduce(function (s1, n) { return s1 + n; }, 0) : 0; };
      var plants = S.boot.plants.filter(function (p) { return (!F.group || p.group === F.group) && (!F.plant || p.id === F.plant) && (st[p.id] || isFlowering(p)); });
      plants.sort(function (a1, b1) { return total(b1.id) - total(a1.id) || a1.en.localeCompare(b1.en); });
      $('#yearT').innerHTML = '<div class="tbl-wrap ytw"><table class="yt2"><thead><tr><th class="pn">Plant</th>' + MONTHS.map(function (m2, i) {
          return '<th' + (thisYear && i === nowM ? ' class="now"' : '') + '><span>' + m2 + '</span></th>';
        }).join('') + '</tr></thead><tbody>' +
        plants.map(function (p) {
          var se = seasonOf(p), row = st[p.id] || { flowers: new Array(12).fill(0), photos: new Array(12).fill(0) }, t = total(p.id);
          var exp = MONTHS.map(function (_, i) { return !!(se.flower[i] && !se.rest[i]); });
          return '<tr><th scope="row" class="pn"><a href="#/plant/' + esc(p.id) + '">' + esc(p.en) + '</a><small>' + (t ? t + (t === 1 ? ' flower' : ' flowers') : 'No flowers yet') + '</small></th>' + MONTHS.map(function (m2, i) {
            var n = row.flowers[i], ph = row.photos[i];
            var cls = 'ym' + (exp[i] ? ' exp' + (i === 0 || !exp[i - 1] ? ' s' : '') + (i === 11 || !exp[i + 1] ? ' e' : '') : '') + (thisYear && i === nowM ? ' now' : '');
            var inner = '<span class="fz">' + (n ? '<span class="fb ' + (n >= 6 ? 's3' : n >= 3 ? 's2' : 's1') + '">' + n + '</span>' : ph ? cam : '') + '</span><span class="band"></span>';
            return '<td class="' + cls + '"><button type="button" data-ym="' + y + '-' + pad(i + 1) + '" data-p="' + esc(p.id) + '"' +
              ' aria-label="' + esc(p.en) + ', ' + MONTH_FULL[i] + ': ' + n + (n === 1 ? ' flower' : ' flowers') + ', ' + ph + (ph === 1 ? ' photo' : ' photos') + (exp[i] ? ', in flowering season' : '') + '">' + inner + '</button></td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' + (plants.length ? '' : '<p class="muted">No plants match the filters.</p>');
    }).catch(function (err) { $('#yearT').innerHTML = '<p class="hint bad">' + esc(err.message) + '</p>'; });
  }
  function draw() {
    nFilters();
    $$('[data-cv]', app).forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.cv === F.view)); });
    if (F.view === 'year') drawYear(); else drawMonth();
  }
  function shiftMonth(d) {
    if (d === 0) F.ym = today().slice(0, 7);
    else { var y = +F.ym.slice(0, 4), m = +F.ym.slice(5, 7) - 1 + d; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; F.ym = y + '-' + pad(m + 1); }
    F.year = +F.ym.slice(0, 4); F.day = ''; drawMonth();
  }
  app.onclick = function (e) {
    var b = e.target.closest('[data-cv],[data-cm],[data-cy],[data-day],[data-ym]'); if (!b) return;
    if (b.dataset.cv) { F.view = b.dataset.cv; draw(); }
    else if (b.dataset.cm !== undefined) shiftMonth(+b.dataset.cm);
    else if (b.dataset.cy) { F.year += +b.dataset.cy; drawYear(); }
    else if (b.dataset.day) showDay(b.dataset.day);
    else if (b.dataset.ym) { F.view = 'month'; F.ym = b.dataset.ym; F.plant = b.dataset.p; F.group = ''; F.variety = ''; F.day = ''; fillPlants(); draw(); }
  };
  function onFilter() {
    F.group = $('#cfG').value; F.plant = $('#cfP').value; F.variety = $('#cfV').value; F.pot = $('#cfPot').value.trim(); F.colour = $('#cfC').value; F.stage = $('#cfS').value; F.kind = $('#cfK').value;
    fillPlants(); F.day = ''; draw();
  }
  ['cfG', 'cfP', 'cfV', 'cfC', 'cfS', 'cfK'].forEach(function (id) { $('#' + id).addEventListener('change', onFilter); });
  $('#cfPot').addEventListener('change', onFilter);
  $('#cfClear').addEventListener('click', function () {
    ['group', 'plant', 'variety', 'pot', 'colour', 'stage', 'kind'].forEach(function (k) { F[k] = ''; });
    $('#cfG').value = ''; $('#cfPot').value = ''; $('#cfC').value = ''; $('#cfS').value = ''; $('#cfK').value = ''; fillPlants(); draw();
  });
  fillPlants(); draw();
}

/* ================= start ================= */
load();
})();
