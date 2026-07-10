const fs = require("fs");
const db = JSON.parse(fs.readFileSync("./db.json", "utf8"));
console.log("Total audits in local db.json:", (db.audits || []).length);
(db.audits || []).forEach((a, i) => {
  console.log(`[Audit ${i}] Name: "${a.name}", Status: "${a.status}", Phase: "${a.currentPhase}"`);
  console.log(`  - phase1DanismanRaw: ${(a.phase1DanismanRaw || []).length} rows`);
  console.log(`  - phase1IlanPanelRaw: ${(a.phase1IlanPanelRaw || []).length} rows`);
  console.log(`  - phase1IlanSahibindenRaw: ${(a.phase1IlanSahibindenRaw || []).length} rows`);
  console.log(`  - phase1KacakDanismanRaw: ${(a.phase1KacakDanismanRaw || []).length} rows`);
  if ((a.phase1DanismanRaw || []).length > 0) {
    console.log(`  All danisman rows:`, JSON.stringify(a.phase1DanismanRaw));
  }
});
