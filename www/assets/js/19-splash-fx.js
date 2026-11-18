/* ── Splash vektor ──
   1) titik-titik melayang pelan
   2) kata "Exambre" muncul huruf demi huruf (CSS); titik-titik menabrak kata itu
   3) setiap tabrakan membuat huruf di bawahnya "penyok" sebentar, titik memantul ke atas
   4) titik-titik menata diri (fisika pegas) mengikuti bentuk "e" logo
   5) jalur vektor "e" tergambar, titik-titik memudar masuk ke dalamnya
   Tanpa gerak (prefers-reduced-motion): tampil statis, canvas tidak dijalankan. */
(function () {
  'use strict';
  const N = 140;             // jumlah titik
  const LAUNCH_AT = 900;     // ms: mulai menabrak kata
  const DRAW_AT = 2150;      // ms: jalur "e" mulai tergambar
  const FADE_DUR = 520;      // ms: titik memudar

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  window.startSplashFx = function startSplashFx() {
    const sp = document.getElementById('exambre-splash');
    const cv = document.getElementById('splash-fx');
    const svg = document.getElementById('splash-mark');
    const word = sp && sp.querySelector('.splash-wordmark');
    const pm = document.getElementById('spm-main'), pt = document.getElementById('spm-tail');
    if (!sp || !cv || !svg || !word || !pm || !pt || !cv.getContext) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { sp.classList.add('fx'); return; }

    sp.classList.add('fx');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    /* target: titik-titik sepanjang jalur "e" dengan sedikit sebaran menyamping (mengisi tebal goresan) */
    const STROKE = 37;
    const lenM = pm.getTotalLength(), lenT = pt.getTotalLength(), total = lenM + lenT;
    const rect = svg.getBoundingClientRect(), k = rect.width / 320;
    const P = [];
    for (let i = 0; i < N; i++) {
      const s = (i + 0.5) / N * total;
      const onTail = s > lenM, path = onTail ? pt : pm, l = onTail ? s - lenM : s;
      const a = path.getPointAtLength(Math.max(0, l - 0.6)), b = path.getPointAtLength(Math.min(path.getTotalLength(), l + 0.6));
      const c = path.getPointAtLength(l);
      let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const off = rnd(-0.5, 0.5) * STROKE * 0.82;
      const gx = c.x - ty * off, gy = c.y + tx * off;
      const f = Math.max(0, Math.min(1, (s / total - 0.78) / 0.22));       // ekor memucat ke biru muda
      const col = [Math.round(lerp(255, 134, f)), Math.round(lerp(255, 176, f)), 255];
      P.push({
        x: rnd(0, W), y: rnd(0, H * 0.92), vx: rnd(-26, 26), vy: rnd(-22, 22), ph: rnd(0, 6.28),
        r: rnd(1.7, 3.3), col: 'rgb(' + col.join(',') + ')',
        tx: rect.left + gx * k, ty: rect.top + gy * k,
        t0: LAUNCH_AT + (i / N) * 320 + rnd(0, 160), fd: rnd(380, 560), sw: rnd(-1, 1),
        st: 0, ix: 0, iy: 0, sx: 0, sy: 0, kk: rnd(46, 70), cc: rnd(7.5, 10.5), a: 0
      });
    }

    let letters = null, wr = null; const lastHit = [];
    function prepareImpact() {
      wr = word.getBoundingClientRect();
      letters = Array.prototype.map.call(word.children, function (el) { return { el: el, r: el.getBoundingClientRect() }; });
    }
    function hit(x, now) {
      if (!letters) return;
      let idx = 0, best = 1e9;
      for (let i = 0; i < letters.length; i++) {
        const r = letters[i].r, d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
        if (d < best) { best = d; idx = i; }
      }
      if (now - (lastHit[idx] || -1e9) < 150) return;
      lastHit[idx] = now;
      const el = letters[idx].el; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    }

    let drawn = false;
    function drawMark() {
      drawn = true;
      pm.style.opacity = pt.style.opacity = '1';
      const opt = function (d, delay) { return { duration: d, delay: delay, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' }; };
      pm.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], opt(520, 0));
      pt.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], opt(300, 360));
      svg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.6 }, { transform: 'scale(1)' }],
        { duration: 520, delay: 520, easing: 'cubic-bezier(.34,1.4,.64,1)' });
    }

    const start = performance.now(); let prev = start, impactReady = false;
    function frame(now) {
      if (!document.body.contains(sp) || sp.classList.contains('hide')) return;
      const t = now - start, dt = Math.min(0.034, (now - prev) / 1000); prev = now;
      if (!impactReady && t >= LAUNCH_AT - 60) { prepareImpact(); impactReady = true; }
      if (!drawn && t >= DRAW_AT) drawMark();
      const fade = t < DRAW_AT ? 1 : Math.max(0, 1 - (t - DRAW_AT) / FADE_DUR);
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        p.a = Math.min(1, t / 420);
        if (p.st === 0) {                                    // melayang
          p.x += (p.vx + Math.sin(now * 0.0011 + p.ph) * 14) * dt;
          p.y += (p.vy + Math.cos(now * 0.0009 + p.ph) * 12) * dt;
          if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;
          if (p.y < -8) p.y = H + 8; else if (p.y > H + 8) p.y = -8;
          if (impactReady && t >= p.t0) {
            p.st = 1; p.sx = p.x; p.sy = p.y;
            p.ix = lerp(wr.left + 4, wr.right - 4, Math.random());
            p.iy = wr.top + wr.height * 0.28 + rnd(0, 8);
          }
        }
        if (p.st === 1) {                                    // melesat ke kata (makin cepat), sedikit memutar
          const u = Math.min(1, (t - p.t0) / p.fd), e = Math.pow(u, 2.4);
          const sw = (1 - u) * Math.sin(u * 3.4) * 34 * p.sw;
          p.x = lerp(p.sx, p.ix, e) + sw; p.y = lerp(p.sy, p.iy, e) - sw * 0.4;
          if (u >= 1) {                                      // tabrak!
            p.st = 2; hit(p.ix, now);
            p.vx = rnd(-110, 110); p.vy = -rnd(260, 480);
          }
        } else if (p.st === 2) {                             // memantul ke atas, lalu pegas menarik ke bentuk "e"
          const ax = (p.tx - p.x) * p.kk - p.vx * p.cc, ay = (p.ty - p.y) * p.kk - p.vy * p.cc;
          p.vx += ax * dt; p.vy += ay * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        }
        const al = p.a * fade; if (al <= 0.01) continue;
        ctx.fillStyle = p.col;
        ctx.globalAlpha = al * 0.22; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.3, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (t < DRAW_AT + FADE_DUR + 80) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  };
})();
