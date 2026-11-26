// Periksa isi www/data/belajar.json. Jalankan: node scripts/validate-belajar.mjs
// Gagal (exit 1) hanya untuk kesalahan struktur; peringatan (mis. belum diverifikasi) tidak menggagalkan.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { belajarValidate } = createRequire(import.meta.url)('../www/assets/js/20-belajar.js');
const path = new URL('../www/data/belajar.json', import.meta.url);
let data;
try { data = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { console.error('belajar.json tidak bisa dibaca: ' + e.message); process.exit(1); }
const { errors, warnings } = belajarValidate(data);
const n = (data.topics || []).reduce((a, t) => a + ((t.playlists || []).length), 0);
console.log(`belajar.json: ${(data.topics || []).length} topik, ${n} playlist`);
warnings.forEach(w => console.log('  peringatan: ' + w));
errors.forEach(e => console.error('  KESALAHAN: ' + e));
if (errors.length) { console.error(`\n${errors.length} kesalahan. Perbaiki sebelum push.`); process.exit(1); }
console.log('Struktur valid.' + (warnings.length ? ` (${warnings.length} peringatan)` : ''));
