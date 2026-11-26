// Jalankan: node tests/belajar.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { belajarValidate } = createRequire(import.meta.url)('../www/assets/js/20-belajar.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  GAGAL ' + name + '\n        ' + String(e.message).split('\n').slice(0, 3).join('\n        ')); } }
const pl = (o) => Object.assign({ id: 'PLPtbHTXes2LPJDunxjBOU0knXcBhbvJ1G', judul: 'Judul', channel: 'Channel', level: 'dasar' }, o);
const doc = (o, p) => Object.assign({ version: 1, updated: '2026-11-22', topics: [{ id: 'mtk', judul: 'Matematika', playlists: [pl(p)] }] }, o);
const bad = (d, re) => { const r = belajarValidate(d); assert.ok(r.errors.length, 'harus ada kesalahan'); if (re) assert.match(r.errors.join(' | '), re); };

console.log('Data valid');
t('dokumen minimal valid', () => assert.deepEqual(belajarValidate(doc()).errors, []));
t('berkas yang sebenarnya valid', async () => {
  const { readFileSync } = await import('node:fs');
  const real = JSON.parse(readFileSync(new URL('../www/data/belajar.json', import.meta.url), 'utf8'));
  assert.deepEqual(belajarValidate(real).errors, []);
});
t('perlu_verifikasi menghasilkan peringatan, bukan kesalahan', () => { const r = belajarValidate(doc({}, { perlu_verifikasi: true })); assert.equal(r.errors.length, 0); assert.ok(r.warnings.length); });
t('jumlah_video null dan angka diterima', () => { assert.deepEqual(belajarValidate(doc({}, { jumlah_video: null })).errors, []); assert.deepEqual(belajarValidate(doc({}, { jumlah_video: 25 })).errors, []); });

console.log('Struktur rusak');
t('input bukan objek / null', () => { bad(null); bad('x'); bad(42); });
t('tanpa topik', () => bad(doc({ topics: [] }), /topics/));
t('version dan updated salah', () => { bad(doc({ version: 0 }), /version/); bad(doc({ updated: '22-11-2026' }), /updated/); });
t('topik tanpa playlist', () => bad(doc({ topics: [{ id: 'mtk', judul: 'M', playlists: [] }] }), /playlists/));
t('id topik dobel', () => bad(doc({ topics: [{ id: 'a', judul: 'A', playlists: [pl()] }, { id: 'a', judul: 'B', playlists: [pl({ id: 'PLabcdefghijk1234' })] }] }), /dobel/));
t('id topik bukan slug', () => bad(doc({ topics: [{ id: 'Matematika Dasar', judul: 'M', playlists: [pl()] }] }), /id harus/));

console.log('Playlist rusak');
t('id playlist dobel di topik berbeda', () => bad(doc({ topics: [{ id: 'a', judul: 'A', playlists: [pl()] }, { id: 'b', judul: 'B', playlists: [pl()] }] }), /dobel/));
t('id playlist berisi sisa tautan (&si=...)', () => bad(doc({}, { id: 'PLPtbHTXes2LPJDunxjBOU0knXcBhbvJ1G&si=abc' }), /id playlist/));
t('id playlist terlalu pendek / mengandung spasi atau tanda kutip', () => { bad(doc({}, { id: 'PL123' })); bad(doc({}, { id: 'PLabcdefghij" onclick="x' })); });
t('level tidak dikenal', () => bad(doc({}, { level: 'pemula' }), /level/));
t('judul / channel kosong atau kosong spasi', () => { bad(doc({}, { judul: '   ' })); bad(doc({}, { channel: '' })); });
t('judul terlalu panjang', () => bad(doc({}, { judul: 'x'.repeat(101) }), /judul/));
t('jumlah_video negatif / pecahan / terlalu besar', () => { bad(doc({}, { jumlah_video: -1 })); bad(doc({}, { jumlah_video: 2.5 })); bad(doc({}, { jumlah_video: 99999 })); });
t('catatan terlalu panjang', () => bad(doc({}, { catatan: 'x'.repeat(241) }), /catatan/));
t('elemen playlist bukan objek', () => bad(doc({ topics: [{ id: 'a', judul: 'A', playlists: [null] }] }), /bukan objek/));

console.log(`\n${pass} lolos, ${fail} gagal`);
process.exit(fail ? 1 : 0);
