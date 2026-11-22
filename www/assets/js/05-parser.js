/* ── Pembaca soal (tanpa DOM, bisa diuji di Node) ──
   parseQuestions(teks) -> [{ q, opts[], correct, wrong, cat, exp, warn }]
   - satu tempelan boleh berisi beberapa soal (dipisah nomor "9.", "10)", "Soal 11:")
   - opsi: "A. teks", "A) teks", "(A) teks", "a. teks", atau satu baris "A. x B. y C. z"
   - kunci hanya diambil dari baris "Jawaban: C" / "Kunci: C"; kalau tidak ada, correct = ''
     (tidak pernah ditebak). Nomor soal dibuang dari teks pertanyaan. */
(function (root) {
  'use strict';
  var LET = 'ABCDE';
  var RE_NUM = /^\s*(?:(?:soal|no)\.?\s*)?(\d{1,3})\s*[.):]\s+(?=\S)/i;
  var RE_OPT = /^\s*\(?([A-Ea-e])(?:[.:]\s+|\)\s*)(\S.*)$/;
  var RE_KEY = /^\s*(?:jawaban(?:\s+(?:yang\s+)?benar)?|kunci(?:\s+jawaban)?|answer|ans\.?)\s*[:=\-–]?\s*\(?([A-Ea-e])\)?(?:[.)\s].*)?$/i;
  var RE_KEY_TAIL = /\s*(?:jawaban|kunci|answer)\s*[:=]\s*\(?([A-Ea-e])\)?\s*$/i;
  var RE_WRONG = /^\s*(?:jawaban saya|pilihan saya|saya memilih)\s*[:=]?\s*\(?([A-Ea-e])\)?/i;
  var RE_EXP = /^\s*(?:pembahasan|penjelasan|explanation)\s*[:\-]?\s*(.*)$/i;
  var RE_CAT = /\b(TIU|TWK|TKP|TBI|TPA)\b/;
  var RE_INLINE = /(?:^|\s)\(?([A-Ea-e])(?:[.:]\s+|\)\s*)(?=\S)/g;

  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/[\u200b\u200c\u200d\ufeff]/g, '')
      .replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  }

  /* "A. x B. y C. z" dalam satu baris -> { stem, parts[] } atau null */
  function splitInline(line, start) {
    start = start || 0;
    var marks = [], m;
    RE_INLINE.lastIndex = 0;
    while ((m = RE_INLINE.exec(line))) marks.push({ i: m.index + m[0].length - m[0].replace(/^\s/, '').length, end: RE_INLINE.lastIndex, l: m[1].toUpperCase() });
    if (marks.length < 2 || marks[0].l !== LET[start]) return null;
    for (var k = 0; k < marks.length; k++) if (marks[k].l !== LET[start + k]) return null;
    var parts = [];
    for (var j = 0; j < marks.length; j++) parts.push(line.slice(marks[j].end, j + 1 < marks.length ? marks[j + 1].i : line.length).trim());
    return { stem: line.slice(0, marks[0].i).trim(), parts: parts };
  }

  function newBlock() { return { q: [], opts: [], key: '', wrong: '', exp: [], inOpts: false, inExp: false }; }

  function finish(b) {
    var q = b.q.join(' ').replace(/\s+/g, ' ').trim();
    var opts = b.opts.map(function (o) { return o.replace(/\s+/g, ' ').trim(); });
    var key = b.key;
    if (opts.length) {                                         // "D. Rp100.000 Jawaban: C"
      var last = opts[opts.length - 1], t = RE_KEY_TAIL.exec(last);
      if (t) { opts[opts.length - 1] = last.slice(0, t.index).trim(); if (!key) key = t[1].toUpperCase(); }
    }
    var cat = '', cm = RE_CAT.exec(q);
    if (cm) cat = cm[1];
    q = q.replace(/^\[(TIU|TWK|TKP|TBI|TPA)\]\s*/i, '').trim();
    var warn = '';
    if (!q && !opts.length) return null;
    if (opts.length < 2) warn = 'Pilihan jawaban tidak terbaca.';
    if (opts.length > 5) opts = opts.slice(0, 5);
    var correct = key && LET.indexOf(key) > -1 && LET.indexOf(key) < opts.length ? key : '';
    var wrong = b.wrong && LET.indexOf(b.wrong) < opts.length ? b.wrong : '';
    return { q: q, opts: opts, correct: correct, wrong: wrong, cat: cat, exp: b.exp.join(' ').trim(), warn: warn };
  }

  function parseQuestions(raw) {
    var src = clean(raw);
    if (!src.trim()) return [];
    var rows = src.split('\n'), out = [], cur = newBlock(), blank = false;
    for (var r = 0; r < rows.length; r++) {
      var line = rows[r].replace(/ {2,}/g, ' ').trim();
      if (!line) { blank = true; continue; }
      var km = RE_KEY.exec(line);
      if (km && (cur.opts.length || cur.q.length)) { cur.key = km[1].toUpperCase(); cur.inExp = false; blank = false; continue; }
      var wm = RE_WRONG.exec(line);
      if (wm) { cur.wrong = wm[1].toUpperCase(); blank = false; continue; }
      var em = RE_EXP.exec(line);
      if (em) { cur.exp.push(em[1]); cur.inExp = true; blank = false; continue; }
      var nm = RE_NUM.exec(line);
      if (nm && cur.opts.length >= 2) {                        // nomor baru setelah opsi = soal baru
        var done = finish(cur); if (done) out.push(done);
        cur = newBlock(); line = line.slice(nm[0].length); nm = null;
      } else if (cur.inExp && !nm) { cur.exp.push(line); blank = false; continue; }
      else if (cur.opts.length >= 2 && blank && !RE_OPT.test(line)) {   // soal baru tanpa nomor, didahului baris kosong
        var done2 = finish(cur); if (done2) out.push(done2); cur = newBlock();
      }
      if (nm && !cur.q.length && !cur.opts.length) line = line.slice(nm[0].length);   // buang nomor soal pertama
      cur.inExp = false;
      var om = RE_OPT.exec(line);
      if (om && om[1].toUpperCase() === LET[cur.opts.length]) {
        var inl0 = splitInline(line, cur.opts.length);          // "A. x B. y C. z" dalam satu baris
        if (inl0 && !inl0.stem) cur.opts = cur.opts.concat(inl0.parts); else cur.opts.push(om[2]);
        cur.inOpts = true;
      } else if (cur.opts.length === 0) {
        var inl = splitInline(line);
        if (inl) { if (inl.stem) cur.q.push(inl.stem); cur.opts = inl.parts; cur.inOpts = true; }
        else cur.q.push(line);
      } else if (cur.inOpts) {
        cur.opts[cur.opts.length - 1] += ' ' + line;           // opsi yang melipat ke baris berikutnya
      } else cur.q.push(line);
      blank = false;
    }
    var last = finish(cur); if (last) out.push(last);
    return out;
  }

  root.parseQuestions = parseQuestions;
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseQuestions: parseQuestions };
})(typeof window !== 'undefined' ? window : globalThis);
