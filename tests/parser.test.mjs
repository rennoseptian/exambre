// Jalankan: node tests/parser.test.mjs   (tanpa dependensi)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { parseQuestions } = createRequire(import.meta.url)('../www/assets/js/05-parser.js');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  GAGAL ' + name + '\n        ' + String(e.message).split('\n').slice(0, 4).join('\n        ')); } }
const one = s => { const r = parseQuestions(s); assert.equal(r.length, 1, 'harus 1 soal, dapat ' + r.length); return r[0]; };

const SAMPLE = `9. Harga 5 buku sama dengan Rp60.000. Jika Rina membeli 8 buku, berapa uang yang harus dibayar?

A. Rp84.000

B. Rp90.000

C. Rp96.000

D. Rp 100.000`;

console.log('Format dari pengguna');
t('contoh asli: nomor dibuang, 4 opsi, kunci TIDAK ditebak', () => {
  const r = one(SAMPLE);
  assert.equal(r.q, 'Harga 5 buku sama dengan Rp60.000. Jika Rina membeli 8 buku, berapa uang yang harus dibayar?');
  assert.deepEqual(r.opts, ['Rp84.000', 'Rp90.000', 'Rp96.000', 'Rp 100.000']);
  assert.equal(r.correct, '');
  assert.equal(r.warn, '');
});
t('tanpa kunci tidak pernah jadi "A"', () => assert.notEqual(one(SAMPLE).correct, 'A'));

console.log('Kunci jawaban');
t('baris "Jawaban: C" dibaca dan tidak masuk teks', () => { const r = one(SAMPLE + '\n\nJawaban: C'); assert.equal(r.correct, 'C'); assert.ok(!/Jawaban/i.test(r.opts[3])); });
t('"Kunci jawaban: b" huruf kecil', () => assert.equal(one(SAMPLE + '\nKunci jawaban: b').correct, 'B'));
t('kunci di ujung opsi terakhir', () => { const r = one('1. 2+2?\nA. 3\nB. 4 Jawaban: B'); assert.equal(r.correct, 'B'); assert.equal(r.opts[1], '4'); });
t('kunci di luar jumlah opsi diabaikan', () => assert.equal(one('1. 2+2?\nA. 3\nB. 4\nJawaban: E').correct, ''));

console.log('Beberapa soal sekaligus');
t('dua soal dipisah nomor', () => {
  const r = parseQuestions(SAMPLE + '\n\n10. Berapa hasil 15 x 4?\nA. 45\nB. 60\nC. 75\nD. 80');
  assert.equal(r.length, 2); assert.equal(r[0].opts.length, 4); assert.deepEqual(r[1].opts, ['45', '60', '75', '80']);
  assert.equal(r[1].q, 'Berapa hasil 15 x 4?');
});
t('kunci per soal tidak tertukar', () => {
  const r = parseQuestions('1. a?\nA. x\nB. y\nJawaban: B\n2. b?\nA. p\nB. q\nJawaban: A');
  assert.deepEqual(r.map(x => x.correct), ['B', 'A']);
});
t('tiga soal dengan 5 opsi', () => {
  const blk = n => `${n}. Soal ${n}?\nA. a\nB. b\nC. c\nD. d\nE. e`;
  const r = parseQuestions([blk(1), blk(2), blk(3)].join('\n'));
  assert.equal(r.length, 3); r.forEach(x => assert.equal(x.opts.length, 5));
});
t('soal baru tanpa nomor, didahului baris kosong', () => {
  const r = parseQuestions('Siapa presiden pertama?\nA. Soekarno\nB. Hatta\n\nIbu kota Jawa Barat?\nA. Bandung\nB. Bogor');
  assert.equal(r.length, 2); assert.equal(r[1].q, 'Ibu kota Jawa Barat?');
});

console.log('Variasi format opsi');
t('opsi dalam satu baris (gaya PDF)', () => {
  const r = one('9. Harga 5 buku Rp60.000. Jika Rina membeli 8 buku, berapa?\nA. Rp84.000 B. Rp90.000 C. Rp96.000 D. Rp100.000');
  assert.deepEqual(r.opts, ['Rp84.000', 'Rp90.000', 'Rp96.000', 'Rp100.000']);
});
t('opsi satu baris setelah pertanyaan di baris yang sama', () => {
  const r = one('1. Hasil 2+3? A. 4 B. 5 C. 6'); assert.equal(r.q, 'Hasil 2+3?'); assert.deepEqual(r.opts, ['4', '5', '6']);
});
t('huruf kecil dan kurung: a) b) c)', () => assert.deepEqual(one('9. Soal?\na) satu\nb) dua\nc) tiga').opts, ['satu', 'dua', 'tiga']));
t('gaya (A) (B)', () => assert.deepEqual(one('Soal?\n(A) satu\n(B) dua').opts, ['satu', 'dua']));
t('opsi yang terlipat ke baris berikutnya', () => assert.equal(one('Soal?\nA. kalimat panjang yang\nterlipat\nB. pendek').opts[0], 'kalimat panjang yang terlipat'));
t('nomor gaya "9)" dan "Soal 9."', () => { assert.equal(one('9) Soal?\nA. x\nB. y').q, 'Soal?'); assert.equal(one('Soal 9. Soal?\nA. x\nB. y').q, 'Soal?'); });
t('tanpa nomor sama sekali', () => assert.equal(one('Soal tanpa nomor?\nA. x\nB. y').q, 'Soal tanpa nomor?'));

console.log('Jebakan');
t('pernyataan bernomor di dalam soal tidak memecah soal', () => {
  const r = one('5. Perhatikan pernyataan:\n1. Kucing hewan\n2. Batu benda\nPernyataan yang benar?\nA. 1 saja\nB. 2 saja');
  assert.equal(r.opts.length, 2); assert.match(r.q, /Kucing hewan/); assert.match(r.q, /Batu benda/);
});
t('"e.g." di awal baris bukan opsi E', () => assert.equal(parseQuestions('Soal?\ne.g. contoh kalimat\nA. x\nB. y')[0].opts.length, 2));
t('opsi B tanpa A tidak dianggap opsi', () => assert.equal(parseQuestions('Soal?\nB. nyasar')[0].opts.length, 0));
t('angka desimal di awal baris bukan nomor soal', () => assert.equal(parseQuestions('9.5 kg gula dibeli?\nA. x\nB. y').length, 1));
t('teks tanpa opsi memberi peringatan, tidak error', () => { const r = one('Hanya teks pertanyaan'); assert.ok(r.warn); assert.equal(r.opts.length, 0); });
t('input kosong / spasi / null', () => { assert.deepEqual(parseQuestions(''), []); assert.deepEqual(parseQuestions('  \n \n'), []); assert.deepEqual(parseQuestions(null), []); });
t('spasi tak terlihat (nbsp, zero-width) tidak merusak', () => assert.equal(one('9.\u00a0Soal?\nA.\u200b x\nB. y').opts.length, 2));
t('CRLF dan tab', () => assert.equal(one('1. Soal?\r\nA. x\r\nB.\ty').opts.length, 2));

console.log('Tambahan');
t('kategori dari tag', () => assert.equal(one('[TIU] 1. Soal?\nA. x\nB. y').cat, 'TIU'));
t('pembahasan ikut terbaca', () => { const r = one('1. Soal?\nA. x\nB. y\nJawaban: A\nPembahasan: karena x.\nlanjutan.'); assert.equal(r.exp, 'karena x. lanjutan.'); });
t('"jawaban saya" terbaca sebagai pilihan salah', () => assert.equal(one('1. Soal?\nA. x\nB. y\nJawaban saya: B\nJawaban: A').wrong, 'B'));
t('lebih dari 5 opsi dipotong jadi 5', () => assert.equal(one('1. Soal?\nA. a\nB. b\nC. c\nD. d\nE. e').opts.length, 5));

console.log(`\n${pass} lolos, ${fail} gagal`);
process.exit(fail ? 1 : 0);
