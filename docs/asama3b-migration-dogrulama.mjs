// İzole bellek-içi PostgreSQL (PGlite) üzerinde taslak migration'ı doğrular. Canlı veritabanına bağlanmaz.
// Çalıştırma: cd /tmp/pg && bun add @electric-sql/pglite && bun /dev-server/docs/asama3b-migration-dogrulama.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
await db.exec(`CREATE TABLE public.contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_no text NOT NULL, total_amount numeric NOT NULL DEFAULT 0, payment_plan jsonb);
CREATE TABLE public.hakedisler (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hakedis_no text NOT NULL, total_amount numeric NOT NULL DEFAULT 0);
INSERT INTO contracts (contract_no, total_amount) VALUES ('SZ-ESKI', 1000);
INSERT INTO hakedisler (hakedis_no) VALUES ('KH-ESKI');`);
const sql = readFileSync(new URL('./asama3b-migration-taslagi.sql', import.meta.url), 'utf8');
await db.exec(sql);
const r = await db.query(`SELECT price_basis, value_status FROM contracts WHERE contract_no='SZ-ESKI'`);
if (r.rows[0].price_basis !== null || r.rows[0].value_status !== null) throw new Error('eski kayıt NULL değil');
await db.exec(`INSERT INTO contracts (contract_no, price_basis, value_status) VALUES ('SZ-YENI','kdv_dahil','kesin');
INSERT INTO hakedisler (hakedis_no, plan_links) VALUES ('KH-YENI','[{"planItemId":"pi_1","amount":10}]');`);
for (const bad of [`INSERT INTO contracts (contract_no, price_basis) VALUES ('X','yanlis')`, `INSERT INTO contracts (contract_no, value_status) VALUES ('X','yanlis')`, `INSERT INTO hakedisler (hakedis_no, plan_links) VALUES ('X','{"a":1}')`]) {
  let failed = false; try { await db.exec(bad); } catch { failed = true; }
  if (!failed) throw new Error('kısıt çalışmadı: ' + bad);
}
console.log('OK: migration uygulandı, eski kayıtlar NULL, geçerli değerler kabul, geçersizler reddedildi');
