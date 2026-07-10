const fs = require("fs");
const db = JSON.parse(fs.readFileSync("./db.json", "utf8"));
const offices = db.offices;

const getOfficeBrand = (id, sourceFile) => {
  const src = String(sourceFile || "").toLowerCase();
  let preferredBrand = null;
  if (src.includes("cb")) preferredBrand = "Coldwell Banker";
  else if (src.includes("c21") || src.includes("century")) preferredBrand = "Century 21";
  else if (src.includes("era")) preferredBrand = "ERA";

  if (preferredBrand) {
    const office = offices.find(o => o.id === id && o.brand === preferredBrand && o.status !== "Silinmiş") ||
                   offices.find(o => o.id === id && o.brand === preferredBrand) ||
                   offices.find(o => o.id === id && o.status !== "Silinmiş") ||
                   offices.find(o => o.id === id);
    return office?.brand || preferredBrand;
  }

  const office = offices.find(o => o.id === id && o.status !== "Silinmiş") || offices.find(o => o.id === id);
  return office?.brand || null;
};

const codes = ["OF10615", "OF10620", "OF10621", "OF10622", "OF10623", "OF10624", "OF10625", "OF10626", "OF10627", "OF10628"];

console.log("Simulating C21 office code brand resolutions:");
codes.forEach(code => {
  const brand = getOfficeBrand(code, "c21_akullanici.xlsx");
  const officeInDB = offices.find(o => o.id === code && o.brand === "Century 21");
  console.log(`Code: ${code} | Resolved Brand: ${brand} | Office in DB: ${officeInDB ? `${officeInDB.name} (${officeInDB.status})` : "NOT FOUND"}`);
});
