import fs from "fs";
let content = fs.readFileSync("src/components/ExcelUploader.tsx", "utf8");

content = content.replace(/} else if \(name\.includes\("kullanici"\) \|\| name\.includes\("kullanıcı"\) \|\| name\.includes\("kadro"\) \|\| name\.includes\("danisman"\) \|\| name\.includes\("personel"\) \|\| name\.includes\("user"\)\) {\n    return "ofis_kullanicilari";/, `} else if (name.includes("kullanici") || name.includes("kullanıcı") || name.includes("kadro") || name.includes("danisman") || name.includes("personel") || name.includes("user")) {\n    return "danisman";`);

content = content.replace(/return "ofis_kullanicilari"; \/\/ Default fallback/, `return "danisman"; // Default fallback`);

fs.writeFileSync("src/components/ExcelUploader.tsx", content);
