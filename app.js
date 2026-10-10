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

var UPLOAD_FNS = { savePhoto: 1, savePurchase: 1 };
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
  warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>'
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
  var vals = (S.boot.lists && S.boot.lists[name]) || [];
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
function readExif(file) {
  return file.slice(0, 262144).arrayBuffer().then(function (buf) {
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
    var a = scan(t + u32(t + 4), { 34665: -1, 306: -1 });
    var ds = null;
    if (a[34665] > 0) { var b = scan(t + u32(a[34665] + 8), { 36867: -1 }); if (b[36867] > 0) ds = str(t + u32(b[36867] + 8), 19); }
    if (!ds && a[306] > 0) ds = str(t + u32(a[306] + 8), 19);
    var m = ds && ds.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/);
    return m && m[1] !== '0000' ? { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] + ':' + m[5] } : null;
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
      '<img src="' + imgUrl(p.fileId, 1200) + '" alt="' + esc(photoAlt(p)) + '" loading="' + (i < 2 ? 'eager' : 'lazy') + '"></button>' +
      '<figcaption>' + caption(p) + '</figcaption></figure>';
  }).join('');
  var ctl = list.length > 1 ?
    '<div class="gal-ctl"><button type="button" data-g="prev" aria-label="Previous photo">' + icon('back') + '</button>' +
    '<button type="button" data-g="pause" aria-label="Pause slideshow">' + icon('pause') + '</button>' +
    '<button type="button" data-g="next" aria-label="Next photo">' + icon('next') + '</button></div>' +
    '<div class="gal-dots">' + list.map(function (_, i) { return '<button type="button" data-g="dot" data-i="' + i + '" aria-label="Show photo ' + (i + 1) + '"></button>'; }).join('') + '</div>' : '';
  return '<div class="gal" data-gal="' + key + '" role="region" aria-roledescription="carousel" aria-label="Photo gallery, changes by itself"><div class="gal-track">' + slides + '</div>' + ctl + '</div>';
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
      '<div class="lb-cap">' + caption(p) + '</div><div class="lb-ctl">' +
      (list.length > 1 ? '<button type="button" data-l="prev" aria-label="Previous photo">' + icon('back') + '</button><button type="button" data-l="next" aria-label="Next photo">' + icon('next') + '</button>' : '') +
      '<button type="button" data-l="close" aria-label="Close">' + icon('close') + '</button></div></div>';
  }
  function close() { lb.hidden = true; lb.innerHTML = ''; document.removeEventListener('keydown', onKey); if (before && before.focus) before.focus(); }
  function step(d) { k = (k + d + list.length) % list.length; draw(); }
  function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); }
  lb.onclick = function (e) {
    var b = e.target.closest('[data-l]');
    if (!b) { if (e.target === lb) close(); return; }
    var a = b.dataset.l;
    if (a === 'close') { close(); return; }
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
    '<div class="meta">' + (v.colour ? '<span>' + esc(v.colour) + '</span>' : '') + (v.petal ? '<span>' + esc(v.petal) + ' petal</span>' : '') + '</div></div></a>';
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
  var pub = [['', 'Home', 'home'], ['plants', 'Plants', 'plants'], ['varieties', 'Varieties', 'varieties'], ['fish', 'Fish', 'fish']];
  var own = [['add', 'Add photo', 'add'], ['log', 'Log', 'log'], ['pots', 'Pots', 'pots'], ['buy', 'Buy', 'buy'], ['inputs', 'Inputs', 'inputs'], ['dash', 'Dashboard', 'dash']];
  function link(x) {
    var on = cur === x[2] || (x[2] === 'plants' && cur === 'plant') || (x[2] === 'varieties' && cur === 'variety') || (x[2] === 'pots' && cur === 'pot');
    return '<a class="nav-a' + (on ? ' on' : '') + '" href="#/' + x[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + x[1] + '</a>';
  }
  $('#nav').innerHTML = pub.map(link).join('') + (owner ? '<span class="nav-sep" aria-hidden="true"></span>' + own.map(link).join('') : '');
  $('#hdrRight').innerHTML = real ? '<button type="button" class="btn sm" data-act="preview" aria-pressed="' + S.preview + '">Family view: ' + (S.preview ? 'on' : 'off') + '</button>' : '';
  $('#banner').innerHTML = real && S.preview ? '<div class="wrap"><p class="note">You are seeing what relatives see. Costs, vendors and logs are hidden. Turn family view off to edit.</p></div>' : '';
  $('#fab').hidden = !owner || cur === 'add';
  $('#ftr').innerHTML = '<span>Garden@109A, Chennai. Rain from the terrace goes back to the well.</span>' +
    (real ? (S.pin ? '<button type="button" class="linkbtn" data-act="signout">Sign out as owner</button>' : '<span>Signed in as owner</span>')
      : '<a href="#/signin">Owner sign-in</a>');
}
function render() {
  if (!S.boot) return;
  clearInterval(S.timer); S.timer = null;
  var r = route(), owner = isOwner();
  var pub = { home: viewHome, plants: viewPlants, plant: viewPlant, varieties: viewVarieties, variety: viewVariety, fish: viewFish, signin: viewSignIn };
  var own = { add: viewAdd, log: viewLog, pots: viewPots, pot: viewPot, buy: viewBuy, inputs: viewInputs, dash: viewDash };
  renderChrome();
  var fn = pub[r.page] || (owner ? own[r.page] : null) || (own[r.page] ? viewNeedOwner : viewNotFound);
  try { fn(r.arg); } catch (err) {
    app.innerHTML = '<div class="empty"><h1>Something went wrong</h1><p>' + esc(err.message) + '</p><a class="btn" href="#/">Go home</a></div>';
    if (window.console) console.error(err);
  }
  window.scrollTo(0, 0);
}
var PASSIVE = { home: 1, plants: 1, varieties: 1, fish: 1, dash: 1, inputs: 1 };
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
  var r = route(), arg = '';
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
  vars.forEach(function (v) { if (v.colour && colours.indexOf(v.colour) < 0) colours.push(v.colour); if (v.petal && petals.indexOf(v.petal) < 0) petals.push(v.petal); });
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
      (colours.length > 1 ? chipRow('vcol', [['all', 'All colours']].concat(colours.map(function (c) { return [c, c, SWATCH[c]]; })), 'all', 'Colour') : '') +
      (petals.length > 1 ? chipRow('vpet', [['all', 'Any petal']].concat(petals.map(function (x) { return [x, x + ' petal']; })), 'all', 'Petal type') : '') +
      '<div class="grid g-cards" id="vgrid"></div>' +
      (owner ? '<details class="addbox" id="avBox"' + (vars.length ? '' : ' open') + '><summary>' + icon('plus') + '&nbsp;Add a variety</summary>' +
        '<form id="avForm" class="form"><div class="f2">' +
        '<div class="field"><label for="avName">Variety name</label><input id="avName" autocomplete="off" placeholder="e.g. White Rabbit"></div>' +
        '<div class="field"><label for="avTrade">Trade name (optional)</label><input id="avTrade" autocomplete="off"></div>' +
        '<div class="field"><label for="avColour">Main colour</label><select id="avColour">' + listOptions('Colours', '', 'Not set') + '</select></div>' +
        '<div class="field"><label for="avPetal">Petal type</label><select id="avPetal">' + listOptions('Petal types', '', 'Not set') + '</select></div></div>' +
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
    var list = vars.filter(function (v) { return (fc === 'all' || v.colour === fc) && (fp === 'all' || v.petal === fp); });
    var g = $('#vgrid'); if (!g) return;
    g.innerHTML = list.map(varietyCard).join('') || '<p class="muted">No variety matches these filters.</p>';
    var c = $('#vcount'); if (c) c.textContent = list.length + ' of ' + vars.length;
  }
  var avForm = $('#avForm');
  if (avForm) avForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#avName').value.trim();
    if (!name) { toast('Type the variety name.', 'err'); $('#avName').focus(); return; }
    var nv = { plantId: id, name: name, trade: $('#avTrade').value.trim(), colour: $('#avColour').value, petal: $('#avPetal').value, notes: $('#avNotes').value.trim() };
    var btn = $('button[type=submit]', avForm); btn.disabled = true;
    api('saveVariety', S.pin, nv).then(function (vid) {
      if (S.vm[vid]) { toast(name + ' is already in the list.'); return; }
      nv.id = vid; nv.photo = ''; S.boot.varieties.push(nv); S.vm[vid] = nv; vars.push(nv);
      toast(name + ' added.');
      $('#avName').value = ''; $('#avTrade').value = ''; $('#avNotes').value = ''; $('#avName').focus();
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
    if (v.colour && colours.indexOf(v.colour) < 0) colours.push(v.colour);
    if (v.petal && petals.indexOf(v.petal) < 0) petals.push(v.petal);
  });
  app.innerHTML = '<div class="page-h"><h1>Varieties</h1><p class="muted">' + vars.length + ' varieties. Filter by plant, colour or petal type.</p></div>' +
    '<div class="f2" style="max-width:760px"><div class="field"><label for="vp">Plant</label><select id="vp"><option value="">All plants</option>' +
      plantIds.map(function (id) { return '<option value="' + esc(id) + '">' + esc(plantName(id)) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label for="vq">Search</label><input id="vq" type="search" placeholder="Variety or trade name" autocomplete="off"></div></div>' +
    (colours.length ? '<div style="margin-top:14px">' + chipRow('vlc', [['all', 'All colours']].concat(colours.map(function (c) { return [c, c, SWATCH[c]]; })), 'all', 'Colour') + '</div>' : '') +
    (petals.length ? '<div style="margin-top:10px">' + chipRow('vlp', [['all', 'Any petal']].concat(petals.map(function (x) { return [x, x + ' petal']; })), 'all', 'Petal type') + '</div>' : '') +
    '<p class="muted sm" id="vlcount" role="status" style="margin:14px 0 10px"></p><div class="grid g-cards" id="vlgrid"></div>' +
    '<div style="margin-top:16px"><button type="button" class="btn" id="vmore" hidden>Show more</button></div>';
  var fc = 'all', fp = 'all', shown = 60;
  function draw() {
    var pid = $('#vp').value, q = $('#vq').value.trim().toLowerCase();
    var list = vars.filter(function (v) {
      return (!pid || v.plantId === pid) && (fc === 'all' || v.colour === fc) && (fp === 'all' || v.petal === fp) &&
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
  var facts = [['Colour', [v.colour, v.colour2].filter(Boolean).join(' and ')], ['Petal type', v.petal], ['Flower size', v.size], ['Fragrance', v.fragrance]];
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

function viewAdd(arg) {
  var b = S.boot, pre = parseArgs(arg);
  var pot = pre.pot ? (b.pots || []).filter(function (x) { return x.uid === pre.pot; })[0] : null;
  var stages = (b.lists && b.lists['Photo stages']) || FLOWER_STAGES;
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  S.add = { files: [], seq: 0 };
  app.innerHTML =
    '<div class="page-h"><h1>Add photos</h1><p class="muted">Take a photo, or pick from your phone or computer. Fill the details once for all the photos you pick.</p></div>' +
    '<form id="addForm" class="form" novalidate>' +
      '<div class="pick"><label class="pick-btn"><input type="file" accept="image/*" capture="environment" id="fCam">' + icon('camera', 28) + '<span>Take photo</span></label>' +
      '<label class="pick-btn"><input type="file" accept="image/*" multiple id="fGal">' + icon('image', 28) + '<span>' + (coarse ? 'Choose from phone' : 'Choose files') + '</span></label></div>' +
      (coarse ? '' : '<div class="drop" id="drop">Or drag photos here from your computer</div>') +
      '<ul class="flist" id="flist"></ul>' +
      '<fieldset class="fs"><legend>Plant</legend><div class="f2">' +
        '<div class="field"><label for="aPot">Pot ref</label><input id="aPot" list="potRefs" placeholder="e.g. T036" autocomplete="off" autocapitalize="characters" value="' + esc(pot ? pot.ref : '') + '">' + potDatalist('potRefs') +
          '<p class="hint" id="aPotMsg">Optional. Fills plant, variety and colour.</p></div>' +
        '<div class="field"><label for="aPlant">Plant</label><select id="aPlant">' + plantOptions(pre.plant || (pot && pot.plantId)) + '</select></div>' +
        '<div class="field"><label for="aVar">Variety</label><select id="aVar"></select></div>' +
        '<div class="field"><label for="aColour">Colour</label><select id="aColour">' + listOptions('Colours', '', 'Not set') + '</select></div></div>' +
        '<div class="newvar f2" id="newVar" hidden><div class="field"><label for="nvName">New variety name</label><input id="nvName" placeholder="e.g. Pink multi petal"></div>' +
          '<div class="field"><label for="nvTrade">Trade name (optional)</label><input id="nvTrade" placeholder="e.g. Cherry"></div>' +
          '<div class="field"><label for="nvPetal">Petal type</label><select id="nvPetal">' + listOptions('Petal types', '', 'Not set') + '</select></div></div>' +
      '</fieldset>' +
      '<fieldset class="fs"><legend>Stage</legend><div class="chips stage" role="radiogroup" aria-label="Stage">' + stages.map(function (s) {
        return '<label class="chip-r"><input type="radio" name="stage" value="' + esc(s) + '"><span>' + esc(s) + '</span></label>';
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
  var b = S.boot, A = S.add, curPot = pot || null, bloomToken = 0;
  var plantSel = $('#aPlant'), varSel = $('#aVar'), colSel = $('#aColour'), potIn = $('#aPot');
  function stage() { var r = $('input[name=stage]:checked'); return r ? r.value : ''; }
  function archive() { return $('#aArchive').checked; }
  function potMsg(t, kind) { var m = $('#aPotMsg'); m.textContent = t; m.className = 'hint' + (kind ? ' ' + kind : ''); }
  function fillVarieties(sel) { varSel.innerHTML = varietyOptions(plantSel.value, sel, true); onVar(); }
  function onVar() {
    var v = S.vm[varSel.value];
    $('#newVar').hidden = varSel.value !== '__new';
    if (v && v.colour) colSel.value = v.colour;
    refreshBloom();
  }
  function firstDate() { return A.files.length ? A.files[0].date : today(); }
  function refreshBloom() {
    var st = stage(), box = $('#bloomBox'), cnt = $('#countBox');
    var flowerStage = FLOWER_STAGES.indexOf(st) >= 0;
    cnt.hidden = archive() || !curPot || !flowerStage;
    if (!cnt.hidden) $('#aCount').checked = st === 'Day 1';
    if (archive() || !flowerStage || !plantSel.value) { box.hidden = true; return; }
    box.hidden = false;
    var sel = $('#aBloom'), token = ++bloomToken;
    sel.innerHTML = '<option value="new">New flower</option>';
    var q = { potUid: curPot ? curPot.uid : '', varietyId: varSel.value && varSel.value !== '__new' ? varSel.value : '', plantId: plantSel.value, date: firstDate() };
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
        '<span class="st ' + (f.status === 'done' ? 'done' : f.status === 'error' ? 'err' : '') + '" data-st>' + esc(f.msg || '') + '</span></div>' +
        '<button type="button" class="icon-btn" data-rm="' + f.k + '" aria-label="Remove this photo">' + icon('close') + '</button></li>';
    }).join('');
  }
  function addFiles(list, source) {
    var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name); });
    return Promise.all(files.map(function (file) {
      return readExif(file).then(function (ex) {
        var d = ex || (source === 'Mobile camera' ? { date: today(), time: nowTime() } : fromTs(file.lastModified)) || { date: today(), time: nowTime() };
        A.files.push({ k: A.seq++, file: file, url: URL.createObjectURL(file), date: d.date, time: d.time, source: source, status: '', msg: '' });
      });
    })).then(function () { drawFiles(); refreshBloom(); });
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
  potIn.addEventListener('change', function () {
    var v = potIn.value.trim();
    if (!v) { curPot = null; potMsg('Optional. Fills plant, variety and colour.'); refreshBloom(); return; }
    var p = findPot(v);
    if (!p) { curPot = null; potMsg('No active pot "' + v + '". Check the ref, or add the pot in Pots.', 'bad'); refreshBloom(); return; }
    curPot = p; potIn.value = p.ref; plantSel.value = p.plantId;
    fillVarieties(p.varietyId);
    potMsg(p.ref + ': ' + p.plant + (p.variety ? ', ' + p.variety : ''), 'good');
  });
  plantSel.addEventListener('change', function () {
    if (curPot && curPot.plantId !== plantSel.value) { curPot = null; potIn.value = ''; potMsg('Pot cleared because the plant changed.'); }
    fillVarieties('');
  });
  varSel.addEventListener('change', onVar);
  $$('input[name=stage]').forEach(function (r) { r.addEventListener('change', refreshBloom); });
  $('#aArchive').addEventListener('change', refreshBloom);

  fillVarieties(pre.variety || (pot && pot.varietyId) || '');
  if (pot) potMsg(pot.ref + ': ' + pot.plant + (pot.variety ? ', ' + pot.variety : ''), 'good');

  $('#addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var todo = A.files.filter(function (f) { return f.status !== 'done'; });
    if (!todo.length) { toast('Add at least one photo first.', 'err'); return; }
    if (!plantSel.value) { toast('Pick the plant.', 'err'); plantSel.focus(); return; }
    var btn = $('#aSave'); btn.disabled = true;
    var st = stage(), arch = archive();
    var bloom = !arch && !$('#bloomBox').hidden ? $('#aBloom').value : '';
    var count = !arch && !$('#countBox').hidden && $('#aCount').checked && !!curPot;
    var ok = 0, bad = 0;
    var start = Promise.resolve(varSel.value);
    if (varSel.value === '__new') {
      var name = $('#nvName').value.trim();
      if (!name) { btn.disabled = false; toast('Type the new variety name.', 'err'); $('#nvName').focus(); return; }
      btn.textContent = 'Saving variety…';
      var nv = { plantId: plantSel.value, name: name, trade: $('#nvTrade').value.trim(), colour: colSel.value, petal: $('#nvPetal').value };
      start = api('saveVariety', S.pin, nv).then(function (id) {
        nv.id = id; if (!S.vm[id]) { S.boot.varieties.push(nv); S.vm[id] = nv; }
        fillVarieties(id); return id;
      });
    }
    start.then(function (varietyId) {
      var chain = Promise.resolve();
      todo.forEach(function (f, idx) {
        chain = chain.then(function () {
          f.msg = 'Uploading ' + (idx + 1) + ' of ' + todo.length + '…'; f.status = ''; drawFiles();
          btn.textContent = 'Saving ' + (idx + 1) + ' of ' + todo.length + '…';
          return resizeToJpeg(f.file).then(function (b64) {
            return api('savePhoto', S.pin, {
              date: f.date, time: f.time, potUid: curPot ? curPot.uid : '', potNo: curPot ? curPot.ref : '',
              plantId: plantSel.value, varietyId: varietyId || '', stage: st, colour: colSel.value,
              remark: $('#aRemark').value.trim(), bloom: bloom, archive: arch, countFlower: count,
              family: $('#aFamily').checked, gallery: $('#aGallery').checked, source: f.source
            }, b64);
          }).then(function (res) {
            if (bloom === 'new' && res.bloom) {
              bloom = res.bloom;
              var sel = $('#aBloom'); if (sel) { sel.insertAdjacentHTML('beforeend', '<option value="' + esc(res.bloom) + '">' + esc(res.bloom + ': ' + (st || 'photo') + ' on ' + fmtDate(f.date)) + '</option>'); sel.value = res.bloom; }
            }
            count = false; f.status = 'done'; f.msg = 'Saved'; ok++;
            S.boot.photos.unshift({ date: f.date, time: f.time, potUid: curPot ? curPot.uid : '', potNo: curPot ? curPot.ref : '', plantId: plantSel.value,
              varietyId: varietyId || '', stage: st, colour: colSel.value, remark: $('#aRemark').value.trim(), bloom: res.bloom, fileId: res.fileId, archive: arch, gallery: $('#aGallery').checked });
          }).catch(function (err) { f.status = 'error'; f.msg = 'Not saved: ' + err.message; bad++; }).then(drawFiles);
        });
      });
      return chain;
    }).then(function () {
      if (bad) toast(ok + ' saved, ' + bad + ' not saved. Tap Save photos again to retry.', 'err');
      else {
        toast(ok + (ok === 1 ? ' photo saved.' : ' photos saved.'));
        A.files.forEach(function (f) { URL.revokeObjectURL(f.url); });
        A.files = []; drawFiles();
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
        '<div class="field"><label for="pPlant">Plant</label><select id="pPlant">' + plantOptions('') + '</select></div>' +
        '<div class="field"><label for="pVar">Variety</label><select id="pVar"><option value="">Pick a plant first</option></select></div>' +
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
  $('#pPlant').addEventListener('change', function () {
    $('#pVar').innerHTML = varietyOptions($('#pPlant').value, '', false);
    var pl = S.pm[$('#pPlant').value]; if (pl && !$('#pMix').value) $('#pMix').value = pl.mix || '';
  });
  suggest();
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('button[type=submit]', form); btn.disabled = true;
    var data = { ref: $('#pRef').value, plantId: $('#pPlant').value, varietyId: $('#pVar').value, area: $('#pArea').value, size: $('#pSize').value,
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

/* ================= start ================= */
load();
})();
