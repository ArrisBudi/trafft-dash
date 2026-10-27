function initializeOseeDashboard() {
  if (window.__oseeDash) return;
  window.__oseeDash = true;

  var API = '/api/v1/public';
  var TZ = 'Asia/Jakarta';
  var DOW = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var cache = {};
  var current = null;
  var busy = false;

  function get(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return cache[url];
  }

  function todayISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  function addDays(iso, n) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }

  function fmtDate(iso) {
    var p = iso.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return DOW[d.getUTCDay()] + ', ' + p[2] + ' ' + MON[p[1] - 1];
  }

  function rp(n) {
    return n == null ? '' : 'Rp' + Number(n).toLocaleString('id-ID');
  }

  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function isOffline(loc) {
    return !/online|zoom|home/i.test(loc.name || '');
  }

  function eduOf(html) {
    if (!html) return '';
    var box = document.createElement('div');
    box.innerHTML = html;
    var strongs = box.querySelectorAll('strong');
    for (var i = 0; i < strongs.length; i++) {
      if (/pendidikan/i.test(strongs[i].textContent || '')) {
        var anchor = strongs[i].closest('p') || strongs[i];
        var sib = anchor.nextElementSibling;
        if (sib) {
          var li = sib.tagName === 'UL' ? sib.querySelector('li') : null;
          return (li ? li.textContent : sib.textContent).trim();
        }
      }
    }
    var first = box.querySelector('li') || box.querySelector('p');
    return first ? first.textContent.trim() : '';
  }

  function availability(empId, svcId, locId, days) {
    var start = todayISO();
    var end = addDays(start, days);
    var url = API + '/booking/steps/date-time?service=' + svcId + '&location=' + locId + '&employee=' + empId +
      '&userTimezone=' + encodeURIComponent(TZ) + '&calendarStartDate=' + start + '&calendarEndDate=' + end +
      '&strictDateRange=false&showAllAvailableTimes=false';
    return get(url);
  }

  function firstOpen(map) {
    if (!map) return null;
    var dates = Object.keys(map).sort();
    for (var i = 0; i < dates.length; i++) {
      var times = Object.keys(map[dates[i]] || {}).sort();
      if (times.length) return { date: dates[i], times: times };
    }
    return null;
  }

  function schedBlock(slots) {
    var wrap = h('div', 'osee-sched');
    wrap.appendChild(h('div', 'osee-sched__label', 'Jadwal tersedia'));
    var open = firstOpen(slots);
    if (!open) {
      wrap.appendChild(h('div', 'osee-none', 'Belum ada slot dalam 14 hari ke depan.'));
      return wrap;
    }
    wrap.appendChild(h('div', 'osee-slot-day', fmtDate(open.date)));
    var row = h('div', 'osee-slots');
    open.times.slice(0, 4).forEach(function (t) { row.appendChild(h('span', 'osee-slot', t)); });
    if (open.times.length > 4) {
      row.appendChild(h('span', 'osee-slot osee-slot--more', '+' + (open.times.length - 4) + ' lagi'));
    }
    wrap.appendChild(row);
    return wrap;
  }

  function buildCard(item) {
    var emp = item.emp;
    var detail = item.detail;
    var c = h('div', 'osee-card');
    c.setAttribute('data-mode', item.offline ? 'offline' : 'online');

    var top = h('div', 'osee-card__top');
    var av = h('div', 'osee-avatar');
    if (emp.mediaUrl) {
      var img = document.createElement('img');
      img.src = emp.mediaUrl;
      img.alt = emp.firstName + ' ' + emp.lastName;
      av.appendChild(img);
    } else {
      av.textContent = ((emp.firstName || ' ').charAt(0) + (emp.lastName || ' ').charAt(0)).toUpperCase();
    }
    top.appendChild(av);

    var info = h('div');
    if (emp.badge && emp.badge.label) {
      var b = h('span', 'osee-badge', emp.badge.label);
      b.style.background = emp.badge.bgColor || '#0136ad';
      info.appendChild(b);
    }
    info.appendChild(h('h3', 'osee-name', emp.firstName + ' ' + emp.lastName));
    info.appendChild(h('div', 'osee-price', rp(emp.minPrice) + ' - ' + rp(emp.maxPrice)));
    top.appendChild(info);
    c.appendChild(top);

    var edu = eduOf(detail && detail.description);
    if (edu) c.appendChild(h('div', 'osee-edu', 'Pendidikan: ' + edu));

    var chips = h('div', 'osee-chips');
    (emp.locations || []).forEach(function (l) {
      var off = isOffline(l);
      chips.appendChild(h('span', 'osee-chip' + (off ? ' osee-chip--offline' : ''), (off ? 'Offline: ' : 'Online: ') + l.name));
    });
    if (chips.children.length) c.appendChild(chips);

    c.appendChild(schedBlock(item.slots));

    var acts = h('div', 'osee-actions');
    var prof = h('a', 'osee-btn', 'Lihat Profil');
    prof.href = '/employees/' + emp.slug;
    acts.appendChild(prof);

    var svc = detail && detail.services && detail.services[0];
    if (svc) {
      var book = h('a', 'osee-btn osee-btn--primary', 'Book');
      book.href = '/booking?employee=' + emp.id + '&service=' + svc.id + (item.locId ? '&location=' + item.locId : '');
      acts.appendChild(book);
    }
    c.appendChild(acts);
    return c;
  }

  function buildShell(title, subtitle, withFilters) {
    var panel = h('section', 'osee-dash');
    panel.id = 'osee-dash';
    var head = h('div', 'osee-dash__head');
    var left = h('div');
    left.appendChild(h('h2', 'osee-dash__title', title));
    left.appendChild(h('p', 'osee-dash__sub', subtitle));
    head.appendChild(left);

    if (withFilters) {
      var filters = h('div', 'osee-dash__filters');
      var defs = [['all', 'Semua'], ['offline', 'Offline (Solo)'], ['online', 'Online']];
      defs.forEach(function (f, i) {
        var btn = h('button', 'osee-pill' + (i === 0 ? ' is-active' : ''), f[1]);
        btn.type = 'button';
        btn.addEventListener('click', function () {
          var pills = filters.querySelectorAll('.osee-pill');
          for (var k = 0; k < pills.length; k++) pills[k].classList.remove('is-active');
          btn.classList.add('is-active');
          var cards = panel.querySelectorAll('.osee-card');
          for (var j = 0; j < cards.length; j++) {
            cards[j].style.display = (f[0] === 'all' || cards[j].getAttribute('data-mode') === f[0]) ? '' : 'none';
          }
        });
        filters.appendChild(btn);
      });
      head.appendChild(filters);
    }
    panel.appendChild(head);
    return panel;
  }

  function mount(panel, mode) {
    if (mode === 'list') {
      var wrap = document.querySelector('.employees__wrapper');
      if (!wrap || !wrap.parentNode) return false;
      wrap.parentNode.insertBefore(panel, wrap);
    } else {
      var emp = document.querySelector('.employee');
      if (!emp) return false;
      emp.appendChild(panel);
    }
    current = { node: panel, path: location.pathname, mode: mode };
    return true;
  }

  async function renderList() {
    var panel = buildShell(
      'Teacher Dashboard',
      'Profil pengajar, lokasi belajar (online & offline), dan jadwal yang masih tersedia.',
      true
    );
    var loading = h('div', 'osee-loading', 'Memuat data pengajar...');
    panel.appendChild(loading);
    if (!mount(panel, 'list')) return;

    var data = await get(API + '/employees');
    if (!data || !data.employees) {
      loading.textContent = 'Gagal memuat data pengajar.';
      return;
    }

    var items = await Promise.all(data.employees.map(async function (emp) {
      var detail = (await get(API + '/employees/' + emp.slug) || {}).employee || null;
      var locs = (detail && detail.locations) || emp.locations || [];
      var offlineLoc = locs.filter(isOffline)[0];
      var loc = offlineLoc || locs[0];
      var svc = detail && detail.services && detail.services[0];
      var slots = (svc && loc) ? await availability(emp.id, svc.id, loc.id, 14) : null;
      return { emp: emp, detail: detail, slots: slots, offline: !!offlineLoc, locId: loc ? loc.id : null };
    }));

    loading.remove();
    var grid = h('div', 'osee-grid');
    items.forEach(function (it) { grid.appendChild(buildCard(it)); });
    panel.appendChild(grid);
  }

  async function renderDetail() {
    var slug = location.pathname.split('/').filter(Boolean).pop();
    var panel = buildShell('Jadwal 14 Hari ke Depan', 'Slot yang masih bisa dibooking, dikelompokkan per tanggal.', false);
    var loading = h('div', 'osee-loading', 'Memuat jadwal...');
    panel.appendChild(loading);
    if (!mount(panel, 'detail')) return;

    var detail = (await get(API + '/employees/' + slug) || {}).employee || null;
    if (!detail) {
      loading.textContent = 'Data pengajar tidak ditemukan.';
      return;
    }
    var svc = (detail.services || [])[0];
    if (!svc) {
      loading.textContent = 'Belum ada layanan yang terhubung ke pengajar ini.';
      return;
    }

    var perLoc = await Promise.all((detail.locations || []).map(async function (l) {
      return { loc: l, slots: await availability(detail.id, svc.id, l.id, 14) };
    }));

    var merged = {};
    perLoc.forEach(function (m) {
      var slots = m.slots || {};
      Object.keys(slots).forEach(function (d) {
        merged[d] = merged[d] || {};
        Object.keys(slots[d] || {}).forEach(function (t) {
          merged[d][t] = merged[d][t] || [];
          if (merged[d][t].indexOf(m.loc.name) === -1) merged[d][t].push(m.loc.name);
        });
      });
    });

    loading.remove();
    var days = Object.keys(merged).sort();
    if (!days.length) {
      panel.appendChild(h('div', 'osee-none', 'Belum ada slot tersedia dalam 14 hari ke depan.'));
      return;
    }

    var wrap = h('div', 'osee-days');
    days.forEach(function (d) {
      var day = h('div', 'osee-day');
      day.appendChild(h('div', 'osee-day__t', fmtDate(d)));
      var row = h('div', 'osee-slots');
      Object.keys(merged[d]).sort().forEach(function (t) {
        var s = h('span', 'osee-slot', t);
        s.title = merged[d][t].join(' / ');
        s.style.cursor = 'pointer';
        s.addEventListener('click', function () {
          var locName = merged[d][t][0];
          var match = (detail.locations || []).filter(function (x) { return x.name === locName; })[0];
          var loc = match || (detail.locations || [])[0];
          window.location.href = '/booking?employee=' + detail.id + '&service=' + svc.id + (loc ? '&location=' + loc.id : '');
        });
        row.appendChild(s);
      });
      day.appendChild(row);
      var meta = h('div', 'osee-none', Object.keys(merged[d]).length + ' slot tersedia');
      meta.style.marginTop = '8px';
      day.appendChild(meta);
      wrap.appendChild(day);
    });
    panel.appendChild(wrap);
  }

  async function tick() {
    if (busy) return;
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var mode = path === '/employees' ? 'list' : (/^\/employees\/[^/]+$/.test(path) ? 'detail' : null);
    if (!mode) return;
    if (current && current.path === path && current.node && document.contains(current.node)) return;

    busy = true;
    try {
      var stale = document.getElementById('osee-dash');
      if (stale) stale.remove();
      current = null;
      if (mode === 'list') await renderList();
      else await renderDetail();
    } finally {
      busy = false;
    }
  }

  setInterval(tick, 1200);
  window.addEventListener('popstate', function () { current = null; tick(); });
  tick();
}

initializeOseeDashboard();