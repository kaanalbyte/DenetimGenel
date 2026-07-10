import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { loadFromFirestore, saveToFirestore } from "./firebase";

dotenv.config();

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: "50mb" }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- DATABASE PATH AND SCHEMA ---
const DB_PATH = process.env.VERCEL
  ? "/tmp/db.json"
  : path.join(process.cwd(), "db.json");

interface Office {
  id: string; // Office code, e.g., OF1001
  name: string;
  ownerName: string;
  ownerEmail: string;
  groupId: string | null; // Belongs to a group office
  status?: string; // Durum
  responsibleUser?: string; // Sorumlu Sistem Kullanıcısı
  brand?: string; // Marka
}

interface Group {
  id: string; // Group code, e.g., G1
  name: string;
  ownerName: string;
  ownerEmail: string;
}

interface EmailLog {
  id: string;
  timestamp: string;
  auditName: string;
  stage: "Tespit" | "Kontrol" | "Ceza";
  type: "Danışman" | "İlan";
  officeId: string;
  officeName: string;
  recipient: string;
  subject: string;
  bodyHtml: string;
  status: "Gönderildi" | "Simüle Edildi" | "Hata";
  errorDetails?: string;
}

interface AuditPeriod {
  id: string;
  name: string;
  status: "Aktif" | "Tamamlandı";
  currentPhase: "Tespit" | "Kontrol" | "Ceza" | "Kapatıldı";
  createdAt: string;
  updatedAt: string;
  
  // Phase 1: Tespit Data
  phase1Uploaded: boolean;
  phase1DanismanRaw: any[];
  phase1IlanPanelRaw: any[];
  phase1IlanSahibindenRaw: any[];
  phase1KacakDanismanRaw?: any[];
  phase1ProblematicOffices: string[]; // List of problematic office/group IDs
  phase1ApprovedOffices: string[]; // List of offices/groups user approved to send mails
  
  // Phase 2: Kontrol Data
  phase2Uploaded: boolean;
  phase2DanismanRaw: any[];
  phase2IlanPanelRaw: any[];
  phase2IlanSahibindenRaw: any[];
  phase2KacakDanismanRaw?: any[];
  phase2ProblematicOffices: string[]; // Problematic in control
  phase2ApprovedOffices: string[]; // List of offices/groups user approved in Phase 2
  
  // Phase 3: Ceza Data
  phase3ProblematicOffices: string[]; // Core non-compliant offices
  phase3ApprovedOffices: string[]; // Final penalized offices
}

interface AppConfig {
  resendApiKey: string;
  brevoApiKey: string;
  senderEmail: string;
  smtpEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
}

interface Database {
  offices: Office[];
  groups: Group[];
  audits: AuditPeriod[];
  emails: EmailLog[];
  config: AppConfig;
}

// --- SEED/DEFAULT DATA ---
const DEFAULT_OFFICES: Office[] = [
  { id: "OF1001", name: "Master İstanbul Merkez", ownerName: "Ahmet Yılmaz", ownerEmail: "ahmet@masteristanbul.com", groupId: "G1" },
  { id: "OF1002", name: "Master İstanbul Beşiktaş", ownerName: "Ahmet Yılmaz", ownerEmail: "ahmet@masteristanbul.com", groupId: "G1" },
  { id: "OF1003", name: "Master Ankara Çankaya", ownerName: "Mehmet Kaya", ownerEmail: "mehmet@masterankara.com", groupId: "G2" },
  { id: "OF1004", name: "Master Ankara Ümitköy", ownerName: "Mehmet Kaya", ownerEmail: "mehmet@masterankara.com", groupId: "G2" },
  { id: "OF1005", name: "Master İzmir Bornova", ownerName: "Can Demir", ownerEmail: "can@masterizmir.com", groupId: "G3" },
  { id: "OF1006", name: "Master İzmir Karşıyaka", ownerName: "Can Demir", ownerEmail: "can@masterizmir.com", groupId: "G3" },
  { id: "OF1007", name: "Master Antalya Konyaaltı", ownerName: "Elif Şahin", ownerEmail: "elif@masterantalya.com", groupId: null },
  { id: "OF1008", name: "Master Bursa Nilüfer", ownerName: "Mustafa Yıldız", ownerEmail: "mustafa@masterbursa.com", groupId: null }
];

const DEFAULT_GROUPS: Group[] = [
  { id: "G1", name: "İstanbul Kuzey Grubu", ownerName: "Ahmet Yılmaz", ownerEmail: "ahmet@masteristanbul.com" },
  { id: "G2", name: "Ankara Çankaya Grubu", ownerName: "Mehmet Kaya", ownerEmail: "mehmet@masterankara.com" },
  { id: "G3", name: "İzmir Körfez Grubu", ownerName: "Can Demir", ownerEmail: "can@masterizmir.com" }
];

const DEFAULT_DB: Database = {
  offices: DEFAULT_OFFICES,
  groups: DEFAULT_GROUPS,
  audits: [],
  emails: [],
  config: {
    resendApiKey: "",
    brevoApiKey: "",
    senderEmail: "denetim@masterturk.com.tr",
    smtpEnabled: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "denetim@masterturk.com.tr",
    smtpPass: "fucaupikpfrrhzzs"
  }
};

// --- DB MEMORY CACHE & FIRESTORE SYNC ---
let cachedDB: Database | null = null;
let isSyncingFromFirestore = false;

function getMatchedKey(row: any, searchKeys: string[]): string | null {
  if (!row || typeof row !== "object") return null;
  const normSearchKeys = searchKeys.map(k => 
    k.toLowerCase()
     .replace(/[\s\-_]+/g, "")
     .replace(/ı/g, "i")
     .replace(/ğ/g, "g")
     .replace(/ü/g, "u")
     .replace(/ş/g, "s")
     .replace(/ö/g, "o")
     .replace(/ç/g, "c")
  );

  for (const rowKey of Object.keys(row)) {
    const normRowKey = rowKey.trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, "")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

    if (normSearchKeys.includes(normRowKey)) {
      return rowKey;
    }
  }
  return null;
}

function pruneRow(row: any, type: "danisman" | "ilan_panel" | "ilan_sahibinden" | "kacak_danisman") {
  if (!row || typeof row !== "object") return row;
  const pruned: any = {};
  
  const officeCodeKey = getMatchedKey(row, ["ofiskodu", "ofis kodu", "id", "kod"]);
  if (officeCodeKey) {
    pruned[officeCodeKey] = String(row[officeCodeKey]).trim();
  }

  if (type === "danisman") {
    const ownerKey = getMatchedKey(row, ["owner", "sahip", "ofissahibi"]);
    if (ownerKey) pruned[ownerKey] = Number(row[ownerKey] || 0);
    const brokerKey = getMatchedKey(row, ["broker"]);
    if (brokerKey) pruned[brokerKey] = Number(row[brokerKey] || 0);
    const danismanKey = getMatchedKey(row, ["danisman", "danismanlar", "danismantoplami", "advisor", "agent"]);
    if (danismanKey) pruned[danismanKey] = Number(row[danismanKey] || 0);
  } else if (type === "ilan_panel") {
    const satilikKey = getMatchedKey(row, ["satilik", "satilikilan", "sales", "sale"]);
    if (satilikKey) pruned[satilikKey] = Number(row[satilikKey] || 0);
    const kiralikKey = getMatchedKey(row, ["kiralik", "kiralikilan", "rentals", "rent"]);
    if (kiralikKey) pruned[kiralikKey] = Number(row[kiralikKey] || 0);
  } else if (type === "ilan_sahibinden") {
    const countKey = getMatchedKey(row, ["portfoy", "portfoysayisi", "portfoy sayisi", "ilan", "ilansayisi", "ilan sayisi", "count", "sahibinden"]);
    if (countKey) pruned[countKey] = Number(row[countKey] || 0);
  } else if (type === "kacak_danisman") {
    const nameKey = getMatchedKey(row, ["danismanadi", "danisman adi", "danisman adisoyadi", "danisman adi soyadi", "adsoyad", "ad soyad", "name", "danisman"]);
    if (nameKey) pruned[nameKey] = String(row[nameKey]).trim();
    const countKey = getMatchedKey(row, ["portfoy", "portfoysayisi", "portfoy sayisi", "ilan", "ilansayisi", "ilan sayisi", "count", "sahibinden"]);
    if (countKey) pruned[countKey] = Number(row[countKey] || 0);
  }

  if (row._sourceFile) {
    pruned._sourceFile = row._sourceFile;
  }

  return pruned;
}

// Async background fetch to sync local db with cloud Firestore
async function syncFromFirestoreAsync() {
  if (isSyncingFromFirestore) return;
  isSyncingFromFirestore = true;
  try {
    console.log("[Firebase] Arka planda Firestore veritabanı eşitlemesi başlatılıyor...");
    const cloudData = await loadFromFirestore();
    
    // Create robust merge to protect from empty objects or missing fields in Firestore
    const current = cachedDB || DEFAULT_DB;
    
    // Robustly merge audits to avoid losing newer locally-uploaded data
    const mergedAudits = [...(current.audits || [])];
    const cloudAudits = (cloudData && Array.isArray(cloudData.audits)) ? cloudData.audits : [];

    cloudAudits.forEach((cloudAudit: any) => {
      const localIdx = mergedAudits.findIndex(a => a.id === cloudAudit.id);
      if (localIdx === -1) {
        mergedAudits.push(cloudAudit);
      } else {
        const localAudit = mergedAudits[localIdx];
        const localTime = new Date(localAudit.updatedAt || localAudit.createdAt || 0).getTime();
        const cloudTime = new Date(cloudAudit.updatedAt || cloudAudit.createdAt || 0).getTime();

        const localDataPoints = 
          (localAudit.phase1DanismanRaw?.length || 0) +
          (localAudit.phase1IlanPanelRaw?.length || 0) +
          (localAudit.phase1IlanSahibindenRaw?.length || 0) +
          (localAudit.phase2DanismanRaw?.length || 0) +
          (localAudit.phase2IlanPanelRaw?.length || 0) +
          (localAudit.phase2IlanSahibindenRaw?.length || 0);

        const cloudDataPoints = 
          (cloudAudit.phase1DanismanRaw?.length || 0) +
          (cloudAudit.phase1IlanPanelRaw?.length || 0) +
          (cloudAudit.phase1IlanSahibindenRaw?.length || 0) +
          (cloudAudit.phase2DanismanRaw?.length || 0) +
          (cloudAudit.phase2IlanPanelRaw?.length || 0) +
          (cloudAudit.phase2IlanSahibindenRaw?.length || 0);

        if (localDataPoints > cloudDataPoints || (localDataPoints === cloudDataPoints && localTime >= cloudTime)) {
          // Keep local version (has more data or is newer)
        } else {
          // Keep cloud version
          mergedAudits[localIdx] = cloudAudit;
        }
      }
    });
    
    const mergedDB: Database = {
      offices: (cloudData && Array.isArray(cloudData.offices)) ? cloudData.offices : current.offices || DEFAULT_DB.offices,
      groups: (cloudData && Array.isArray(cloudData.groups)) ? cloudData.groups : current.groups || DEFAULT_DB.groups,
      audits: mergedAudits,
      emails: (cloudData && Array.isArray(cloudData.emails)) ? cloudData.emails : current.emails || [],
      config: {
        ...DEFAULT_DB.config,
        ...(cloudData && cloudData.config ? cloudData.config : {}),
        resendApiKey: "",
        brevoApiKey: "",
        senderEmail: "denetim@masterturk.com.tr",
        smtpEnabled: true,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "denetim@masterturk.com.tr",
        smtpPass: "fucaupikpfrrhzzs"
      }
    };

    cachedDB = mergedDB;
    // Write to local fallback file
    fs.writeFileSync(DB_PATH, JSON.stringify(cachedDB, null, 2), "utf8");
    console.log("[Firebase] Arka planda eşitleme başarılı. Veriler Firestore'dan güvenli bir şekilde güncellendi.");

    // If cloud was empty, push local seed back to Firestore
    if (!cloudData || !Array.isArray(cloudData.offices) || cloudData.offices.length === 0) {
      console.log("[Firebase] Firestore boş veya eksik. Başlangıç verileri buluta yükleniyor...");
      await saveToFirestore(mergedDB);
    }
  } catch (err) {
    console.error("[Firebase] Arka planda eşitleme başarısız oldu:", err);
  } finally {
    isSyncingFromFirestore = false;
  }
}

// Trigger initial async sync on load
syncFromFirestoreAsync();

// --- DB READ/WRITE HELPERS ---
function readDB(): Database {
  if (cachedDB && Array.isArray(cachedDB.offices) && Array.isArray(cachedDB.groups)) {
    return cachedDB;
  }

  try {
    let db: Database;
    if (process.env.VERCEL && !fs.existsSync(DB_PATH)) {
      const packagedDbPath = path.join(process.cwd(), "db.json");
      if (fs.existsSync(packagedDbPath)) {
        try {
          const content = fs.readFileSync(packagedDbPath, "utf8");
          fs.writeFileSync(DB_PATH, content, "utf8");
        } catch (copyErr) {
          console.error("Failed to copy packaged db.json to /tmp:", copyErr);
          fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
        }
      } else {
        fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
      }
    } else if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
      cachedDB = DEFAULT_DB;
      // Trigger upload of default db to Firestore
      saveToFirestore(DEFAULT_DB);
      return DEFAULT_DB;
    }

    const data = fs.readFileSync(DB_PATH, "utf8");
    db = JSON.parse(data);
    
    // Merge database read from file with defaults to ensure robustness
    const robustDB: Database = {
      offices: Array.isArray(db.offices) ? db.offices : DEFAULT_DB.offices,
      groups: Array.isArray(db.groups) ? db.groups : DEFAULT_DB.groups,
      audits: Array.isArray(db.audits) ? db.audits : [],
      emails: Array.isArray(db.emails) ? db.emails : [],
      config: {
        ...DEFAULT_DB.config,
        ...(db.config || {}),
        resendApiKey: "",
        brevoApiKey: "",
        senderEmail: "denetim@masterturk.com.tr",
        smtpEnabled: true,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "denetim@masterturk.com.tr",
        smtpPass: "fucaupikpfrrhzzs"
      }
    };

    cachedDB = robustDB;
    // Trigger background sync from Firestore to get the most up-to-date cloud state
    syncFromFirestoreAsync();

    return robustDB;
  } catch (err) {
    console.error("Error reading database, falling back to default db:", err);
    return DEFAULT_DB;
  }
}

function writeDB(data: Database) {
  try {
    // Save to memory cache immediately
    cachedDB = data;
    // Write to local fallback file synchronously
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    // Write to Cloud Firestore asynchronously in the background
    saveToFirestore(data).then((success) => {
      if (success) {
        console.log("[Firebase] Arka plan Firestore kaydı başarılı.");
      } else {
        console.warn("[Firebase] Arka plan Firestore kaydı başarısız oldu, yerel dosya güncel.");
      }
    });
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// Ensure database is initialized
readDB();

// --- EMAIL DISPATCH COMPONENT (REAL AND SIMULATED) ---
async function dispatchEmail(
  config: AppConfig,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<{ status: "Gönderildi" | "Simüle Edildi" | "Hata"; errorDetails?: string }> {
  try {
    // FORCE/HARDCODE the requested credentials directly in the mail dispatch logic
    const smtpHost = "smtp.gmail.com";
    const smtpUser = "denetim@masterturk.com.tr";
    const smtpPass = "fucaupikpfrrhzzs"; // stripped and clean app password
    const senderEmail = "denetim@masterturk.com.tr";

    console.log(`Attempting SMTP delivery to: ${to} via Port 587 (STARTTLS)...`);
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 6000, // 6 seconds
        greetingTimeout: 6000,   // 6 seconds
        socketTimeout: 8000,     // 8 seconds
      });

      const info = await transporter.sendMail({
        from: `MasterTurk Franchise Denetimi <${senderEmail}>`,
        to: to,
        subject: subject,
        html: bodyHtml,
      });

      console.log("Email successfully sent via SMTP Port 587 to: %s, Message ID: %s", to, info.messageId);
      return { status: "Gönderildi" };
    } catch (err: any) {
      console.warn("SMTP Port 587 failed, retrying via Port 465 (SSL/TLS)... Error was:", err.message);
      
      try {
        const transporter465 = nodemailer.createTransport({
          host: smtpHost,
          port: 465,
          secure: true, // SSL/TLS
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 6000,
          greetingTimeout: 6000,
          socketTimeout: 8000,
        });

        const info465 = await transporter465.sendMail({
          from: `MasterTurk Franchise Denetimi <${senderEmail}>`,
          to: to,
          subject: subject,
          html: bodyHtml,
        });

        console.log("Email successfully sent via fallback SMTP Port 465 to: %s, Message ID: %s", to, info465.messageId);
        return { status: "Gönderildi" };
      } catch (err465: any) {
        console.error("All SMTP attempts (Port 587 and 465) failed:", err465);
        return { status: "Hata", errorDetails: `SMTP Hatası (Port 587 & 465): ${err465.message}` };
      }
    }
  } catch (globalErr: any) {
    console.error("Global dispatchEmail exception:", globalErr);
    return { status: "Hata", errorDetails: `Sistem Hatası: ${globalErr.message}` };
  }
}

// --- API ENDPOINTS ---

// 1. Office Management API
app.get("/api/offices", (req, res) => {
  const db = readDB();
  res.json(db.offices);
});

app.post("/api/offices", (req, res) => {
  const db = readDB();
  const office: Office = req.body;
  if (!office.id || !office.name) {
    return res.status(400).json({ error: "Ofis kodu ve adı zorunludur." });
  }

  // Ensure brand exists and is clean
  let brand = office.brand || "";
  if (!brand) {
    if (office.id.startsWith("CB")) brand = "Coldwell Banker";
    else if (office.id.startsWith("C21") || office.id.startsWith("CENTURY") || office.id.startsWith("CE")) brand = "Century 21";
    else if (office.id.startsWith("ERA")) brand = "ERA";
    else brand = "Diğer";
  }
  office.brand = brand;

  const existingIdx = db.offices.findIndex((o) => o.id === office.id && o.brand === office.brand);
  if (existingIdx > -1) {
    db.offices[existingIdx] = {
      ...db.offices[existingIdx],
      ...office
    };
  } else {
    db.offices.push(office);
  }
  writeDB(db);
  res.json(office);
});

function getNormalizedValue(row: any, searchKeys: string[]): string {
  if (!row || typeof row !== "object") return "";
  
  const normSearchKeys = searchKeys.map(k => 
    k.toLowerCase()
     .replace(/[\s\-_]+/g, "")
     .replace(/ı/g, "i")
     .replace(/ğ/g, "g")
     .replace(/ü/g, "u")
     .replace(/ş/g, "s")
     .replace(/ö/g, "o")
     .replace(/ç/g, "c")
  );

  for (const rowKey of Object.keys(row)) {
    const normRowKey = rowKey.trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, "")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

    if (normSearchKeys.includes(normRowKey)) {
      return String(row[rowKey] ?? "").trim();
    }
  }
  return "";
}

app.post("/api/offices/upload", (req, res) => {
  const db = readDB();
  const { offices, defaultBrand } = req.body;
  
  if (!Array.isArray(offices)) {
    return res.status(400).json({ error: "Geçersiz veri formatı." });
  }

  const addedList: { id: string; name: string; brand: string }[] = [];
  const updatedList: { id: string; name: string; brand: string }[] = [];
  let added = 0;
  let updated = 0;

  for (const row of offices) {
    // Map Excel row fields resiliently using normalized key search
    const rawId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]);
    const rawStatus = getNormalizedValue(row, ["durum", "status", "ofisdurumu"]);
    const rawName = getNormalizedValue(row, ["ad", "adi", "ofisadi", "ofis adi", "name"]);
    const rawOwnerEmail = getNormalizedValue(row, ["e-posta", "eposta", "email", "mail"]);
    const rawResponsible = getNormalizedValue(row, ["sorumlu sistem kullanicisi", "sorumlusistemkullanicisi"]);
    const rawBrand = getNormalizedValue(row, ["marka", "brand"]);

    const id = String(rawId).toUpperCase().trim();
    if (!id) continue; // Skip invalid rows
    
    const name = String(rawName).trim() || "İsimsiz Ofis";
    const ownerEmail = String(rawOwnerEmail).trim();
    const status = String(rawStatus).trim();
    const responsibleUser = String(rawResponsible).trim();
    const ownerName = responsibleUser || "Bilinmiyor"; // Default ownerName to responsible user

    let brand = String(rawBrand).trim();
    if (!brand && defaultBrand) {
      brand = defaultBrand;
    }

    // Default brand guess from office ID code prefix if still not present
    if (!brand) {
      if (id.startsWith("CB")) brand = "Coldwell Banker";
      else if (id.startsWith("C21") || id.startsWith("CENTURY") || id.startsWith("CE")) brand = "Century 21";
      else if (id.startsWith("ERA")) brand = "ERA";
      else brand = "Diğer";
    }

    // Normalize final brand names
    if (brand.toLowerCase().includes("cb") || brand.toLowerCase().includes("coldwell")) brand = "Coldwell Banker";
    else if (brand.toLowerCase().includes("c21") || brand.toLowerCase().includes("century")) brand = "Century 21";
    else if (brand.toLowerCase().includes("era")) brand = "ERA";

    const existingIdx = db.offices.findIndex((o) => o.id === id && o.brand === brand);
    if (existingIdx > -1) {
      // Update fields but preserve group ID so relationships aren't broken!
      db.offices[existingIdx] = {
        ...db.offices[existingIdx],
        name: name || db.offices[existingIdx].name,
        ownerName: ownerName || db.offices[existingIdx].ownerName,
        ownerEmail: ownerEmail || db.offices[existingIdx].ownerEmail,
        status: status || db.offices[existingIdx].status,
        responsibleUser: responsibleUser || db.offices[existingIdx].responsibleUser,
        brand: brand || db.offices[existingIdx].brand,
      };
      updatedList.push({ id, name, brand });
      updated++;
    } else {
      db.offices.push({
        id,
        name,
        ownerName,
        ownerEmail,
        status,
        responsibleUser,
        brand,
        groupId: null
      });
      addedList.push({ id, name, brand });
      added++;
    }
  }

  writeDB(db);
  res.json({ success: true, added, updated, addedList, updatedList });
});

app.delete("/api/offices/:id", (req, res) => {
  const db = readDB();
  const id = req.params.id;
  const brand = req.query.brand as string;
  if (brand) {
    db.offices = db.offices.filter((o) => !(o.id === id && o.brand === brand));
  } else {
    db.offices = db.offices.filter((o) => o.id !== id);
  }
  writeDB(db);
  res.json({ success: true });
});

// 2. Group Management API
app.get("/api/groups", (req, res) => {
  const db = readDB();
  res.json(db.groups);
});

app.post("/api/groups", (req, res) => {
  const db = readDB();
  const { group, officeIds } = req.body; // { group: { id, name, ownerName, ownerEmail }, officeIds: string[] }
  
  if (!group || !group.id || !group.name) {
    return res.status(400).json({ error: "Grup kodu ve adı zorunludur." });
  }

  const existingIdx = db.groups.findIndex((g) => g.id === group.id);
  if (existingIdx > -1) {
    db.groups[existingIdx] = group;
  } else {
    db.groups.push(group);
  }

  // Reset groupId for previously bound offices
  db.offices = db.offices.map((off) => {
    if (off.groupId === group.id) {
      return { ...off, groupId: null };
    }
    return off;
  });

  // Assign new officeIds (supports compound key "id:::brand")
  db.offices = db.offices.map((off) => {
    const compoundKey = `${off.id}:::${off.brand}`;
    if (officeIds.includes(off.id) || officeIds.includes(compoundKey)) {
      return { ...off, groupId: group.id };
    }
    return off;
  });

  writeDB(db);
  res.json({ group, officeIds });
});

app.delete("/api/groups/:id", (req, res) => {
  const db = readDB();
  const id = req.params.id;
  db.groups = db.groups.filter((g) => g.id !== id);
  db.offices = db.offices.map((off) => {
    if (off.groupId === id) {
      return { ...off, groupId: null };
    }
    return off;
  });
  writeDB(db);
  res.json({ success: true });
});

// Sync from Client (for offline/Vercel localStorage mode syncing to Firebase Firestore)
app.post("/api/db/sync-from-client", (req, res) => {
  try {
    const { offices, groups, audits, emails, config } = req.body;
    
    const db: Database = {
      offices: Array.isArray(offices) ? offices : [],
      groups: Array.isArray(groups) ? groups : [],
      audits: Array.isArray(audits) ? audits : [],
      emails: Array.isArray(emails) ? emails : [],
      config: config || {
        resendApiKey: "",
        brevoApiKey: "",
        senderEmail: "denetim@masterturk.com.tr",
        smtpEnabled: true,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "denetim@masterturk.com.tr",
        smtpPass: "fucaupikpfrrhzzs"
      }
    };

    writeDB(db);
    res.json({ success: true, message: "Veriler bulut veritabanına başarıyla senkronize edildi." });
  } catch (err: any) {
    console.error("Failed to sync from client:", err);
    res.status(500).json({ error: `Senkronizasyon hatası: ${err.message}` });
  }
});

// Reset Database API
app.post("/api/db/reset", (req, res) => {
  const emptyDb: Database = {
    offices: [],
    groups: [],
    audits: [],
    emails: [],
    config: {
      resendApiKey: "",
      brevoApiKey: "",
      senderEmail: "denetim@masterturk.com.tr",
      smtpEnabled: true,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "denetim@masterturk.com.tr",
      smtpPass: "fucaupikpfrrhzzs"
    }
  };
  writeDB(emptyDb);
  res.json({ success: true, message: "Tüm veritabanı başarıyla temizlendi." });
});

// 3. Configuration API
app.get("/api/config", (req, res) => {
  const db = readDB();
  res.json(db.config);
});

app.post("/api/config", (req, res) => {
  const db = readDB();
  db.config = { ...db.config, ...req.body };
  writeDB(db);
  res.json(db.config);
});

app.post("/api/config/test-email", async (req, res) => {
  try {
    const db = readDB();
    const { to, config: clientConfig } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Alıcı e-posta adresi zorunludur." });
    }

    const subject = "MasterTurk Franchise Denetimi - SMTP Test E-postası";
    const bodyHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: sans-serif; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">Bağlantı Testi Başarılı!</h1>
          </div>
          <div style="padding: 25px; line-height: 1.6; color: #374151;">
            <p>Merhaba,</p>
            <p>Bu e-posta, MasterTurk Franchise Denetim Portalı üzerinden yaptığınız SMTP/Servis bağlantı testi amacıyla gönderilmiştir.</p>
            <p>Resend / Brevo API bağlantınız <strong>başarıyla kurulmuş</strong> ve sistem üzerinden gerçek e-posta gönderimi doğrulanmıştır.</p>
            <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; margin: 20px 0;">
              Tarih: ${new Date().toLocaleString("tr-TR")}
            </div>
            <p>Artık denetim hunisi üzerinden franchise bayilerinize gerçek uyarı bildirimlerini güvenle gönderebilirsiniz.</p>
          </div>
          <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #f3f4f6;">
            MasterTurk Franchise Denetim Direktörlüğü
          </div>
        </div>
      </body>
      </html>
    `;

    const configToUse = clientConfig || db.config;
    const result = await dispatchEmail(configToUse, to, subject, bodyHtml);
    if (result.status === "Gönderildi" || result.status === "Simüle Edildi") {
      const newLog = {
        id: "EML_" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        auditName: "Sistem Testi",
        stage: "Tespit" as const,
        type: "İlan" as const,
        officeId: "TEST",
        officeName: "SMTP Test Ofisi",
        recipient: to,
        subject: subject,
        bodyHtml: bodyHtml,
        status: result.status
      };
      
      // Only write to DB if we are using server state
      if (!clientConfig) {
        db.emails.unshift(newLog);
        writeDB(db);
      }
      res.json({ success: true, status: result.status, newLog });
    } else {
      res.json({ success: false, status: result.status, errorDetails: result.errorDetails || "Bilinmeyen bir hata oluştu." });
    }
  } catch (err: any) {
    console.error("Error in test-email handler:", err);
    res.status(500).json({ success: false, error: "Sunucu hatası: " + err.message });
  }
});

// 4. Audit Management API
app.get("/api/audits", (req, res) => {
  const db = readDB();
  res.json(db.audits);
});

// Get currently active audit period
app.get("/api/audits/active", (req, res) => {
  const db = readDB();
  const active = db.audits.find((a) => a.status === "Aktif");
  res.json(active || null);
});

// Create a new audit period
app.post("/api/audits", (req, res) => {
  const db = readDB();
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Denetim dönem adı gereklidir." });
  }

  // Auto complete any existing active audits
  db.audits = db.audits.map((a) => {
    if (a.status === "Aktif") {
      return { ...a, status: "Tamamlandı", updatedAt: new Date().toISOString() };
    }
    return a;
  });

  const newAudit: AuditPeriod = {
    id: "AUD_" + Date.now(),
    name,
    status: "Aktif",
    currentPhase: "Tespit",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phase1Uploaded: false,
    phase1DanismanRaw: [],
    phase1IlanPanelRaw: [],
    phase1IlanSahibindenRaw: [],
    phase1ProblematicOffices: [],
    phase1ApprovedOffices: [],
    phase2Uploaded: false,
    phase2DanismanRaw: [],
    phase2IlanPanelRaw: [],
    phase2IlanSahibindenRaw: [],
    phase2ProblematicOffices: [],
    phase2ApprovedOffices: [],
    phase3ProblematicOffices: [],
    phase3ApprovedOffices: []
  };

  db.audits.push(newAudit);
  writeDB(db);
  res.json(newAudit);
});

function getBrandFromRowBackend(row: any): string {
  const officeName = getNormalizedValue(row, ["ofisadi", "ofis adi", "name", "office name", "ad", "unvan"]).trim();
  const upperName = officeName.toUpperCase();
  if (upperName.startsWith("CB") || upperName.includes("COLDWELL")) {
    return "Coldwell Banker";
  }
  if (upperName.startsWith("C21") || upperName.includes("CENTURY")) {
    return "Century 21";
  }
  if (upperName.startsWith("ERA")) {
    return "ERA";
  }
  
  // Check source file name
  const src = String(row._sourceFile || "").toLowerCase();
  if (src.includes("cb")) return "Coldwell Banker";
  if (src.includes("c21") || src.includes("century")) return "Century 21";
  if (src.includes("era")) return "ERA";
  
  return "";
}

// Helper to merge incoming rows with existing ones based on office code resiliently
function mergeByOfficeCode(existing: any[], incoming: any[]) {
  if (!Array.isArray(existing)) existing = [];
  if (!Array.isArray(incoming)) incoming = [];

  const existingMap = new Map<string, any>();
  existing.forEach(row => {
    const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
    if (officeId) {
      const brand = getBrandFromRowBackend(row);
      const key = brand ? `${officeId}:::${brand}` : officeId;
      existingMap.set(key, row);
    }
  });

  incoming.forEach(row => {
    const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
    if (officeId) {
      const brand = getBrandFromRowBackend(row);
      const key = brand ? `${officeId}:::${brand}` : officeId;
      existingMap.set(key, row); // Overwrite existing or add new
    }
  });

  return Array.from(existingMap.values());
}

// Helper to merge Kacak Danisman rows based on compound key (Ofis Kodu + Danışman Adı Soyadı)
function mergeKacakDanisman(existing: any[], incoming: any[]) {
  if (!Array.isArray(existing)) existing = [];
  if (!Array.isArray(incoming)) incoming = [];

  const existingMap = new Map<string, any>();
  existing.forEach(row => {
    const offId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
    const name = getNormalizedValue(row, ["danismanadi", "danisman adi", "danisman adisoyadi", "danisman adi soyadi", "adsoyad", "ad soyad", "danismanadisoyadi"]).toUpperCase().trim();
    const key = `${offId}:::${name}`;
    if (offId && name) {
      existingMap.set(key, row);
    }
  });

  incoming.forEach(row => {
    const offId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
    const name = getNormalizedValue(row, ["danismanadi", "danisman adi", "danisman adisoyadi", "danisman adi soyadi", "adsoyad", "ad soyad", "danismanadisoyadi"]).toUpperCase().trim();
    const key = `${offId}:::${name}`;
    if (offId && name) {
      existingMap.set(key, row); // Overwrite or add
    }
  });

  return Array.from(existingMap.values());
}

// Upload CSV/Excel data for the active phase
app.post("/api/audits/active/upload", (req, res) => {
  const db = readDB();
  const activeIdx = db.audits.findIndex((a) => a.status === "Aktif");
  if (activeIdx === -1) {
    return res.status(404).json({ error: "Aktif bir denetim dönemi bulunamadı." });
  }

  const { type, data, secondaryData } = req.body; // type: 'danisman' | 'ilan_panel' | 'ilan_sahibinden'
  const active = db.audits[activeIdx];

  let processedData = data;
  let processedSecondary = secondaryData;

  if (Array.isArray(data)) {
    if (type === "danisman") {
      processedData = data.map(r => pruneRow(r, "danisman"));
    } else if (type === "ilan_panel") {
      processedData = data.map(r => pruneRow(r, "ilan_panel"));
    } else if (type === "ilan_sahibinden") {
      processedData = data.map(r => pruneRow(r, "ilan_sahibinden"));
    }
  }

  if (Array.isArray(secondaryData)) {
    processedSecondary = secondaryData.map(r => pruneRow(r, "kacak_danisman"));
  }

  if (active.currentPhase === "Tespit") {
    if (type === "danisman") {
      active.phase1DanismanRaw = mergeByOfficeCode(active.phase1DanismanRaw, processedData);
    }
    if (type === "ilan_panel") {
      active.phase1IlanPanelRaw = mergeByOfficeCode(active.phase1IlanPanelRaw, processedData);
    }
    if (type === "ilan_sahibinden") {
      active.phase1IlanSahibindenRaw = mergeByOfficeCode(active.phase1IlanSahibindenRaw, processedData);
      if (Array.isArray(processedSecondary)) {
        active.phase1KacakDanismanRaw = mergeKacakDanisman(active.phase1KacakDanismanRaw || [], processedSecondary);
      }
    }
    
    active.phase1Uploaded = true;
  } else if (active.currentPhase === "Kontrol") {
    if (type === "danisman") {
      active.phase2DanismanRaw = mergeByOfficeCode(active.phase2DanismanRaw, processedData);
    }
    if (type === "ilan_panel") {
      active.phase2IlanPanelRaw = mergeByOfficeCode(active.phase2IlanPanelRaw, processedData);
    }
    if (type === "ilan_sahibinden") {
      active.phase2IlanSahibindenRaw = mergeByOfficeCode(active.phase2IlanSahibindenRaw, processedData);
      if (Array.isArray(processedSecondary)) {
        active.phase2KacakDanismanRaw = mergeKacakDanisman(active.phase2KacakDanismanRaw || [], processedSecondary);
      }
    }
    
    active.phase2Uploaded = true;
  }

  active.updatedAt = new Date().toISOString();
  db.audits[activeIdx] = active;
  writeDB(db);
  res.json(active);
});

// Reset uploaded data for active audit period
app.post("/api/audits/active/reset", (req, res) => {
  const db = readDB();
  const activeIdx = db.audits.findIndex((a) => a.status === "Aktif");
  if (activeIdx === -1) {
    return res.status(404).json({ error: "Aktif bir denetim dönemi bulunamadı." });
  }

  const active = db.audits[activeIdx];
  if (active.currentPhase === "Tespit") {
    active.phase1DanismanRaw = [];
    active.phase1IlanPanelRaw = [];
    active.phase1IlanSahibindenRaw = [];
    active.phase1KacakDanismanRaw = [];
    active.phase1Uploaded = false;
    active.phase1ProblematicOffices = [];
    active.phase1ApprovedOffices = [];
  } else if (active.currentPhase === "Kontrol") {
    active.phase2DanismanRaw = [];
    active.phase2IlanPanelRaw = [];
    active.phase2IlanSahibindenRaw = [];
    active.phase2KacakDanismanRaw = [];
    active.phase2Uploaded = false;
    active.phase2ProblematicOffices = [];
    active.phase2ApprovedOffices = [];
  }

  active.updatedAt = new Date().toISOString();
  db.audits[activeIdx] = active;
  writeDB(db);
  res.json(active);
});

// Update problematic state of active audit phase without advancing
app.post("/api/audits/active/problematic", (req, res) => {
  const db = readDB();
  const activeIdx = db.audits.findIndex((a) => a.status === "Aktif");
  if (activeIdx === -1) {
    return res.status(404).json({ error: "Aktif bir denetim dönemi bulunamadı." });
  }

  const { problematicIds, approvedIds } = req.body;
  const active = db.audits[activeIdx];

  if (active.currentPhase === "Tespit") {
    active.phase1ProblematicOffices = problematicIds;
    active.phase1ApprovedOffices = approvedIds;
  } else if (active.currentPhase === "Kontrol") {
    active.phase2ProblematicOffices = problematicIds;
    active.phase2ApprovedOffices = approvedIds;
  } else if (active.currentPhase === "Ceza") {
    active.phase3ProblematicOffices = problematicIds;
    active.phase3ApprovedOffices = approvedIds;
  }

  active.updatedAt = new Date().toISOString();
  db.audits[activeIdx] = active;
  writeDB(db);
  res.json(active);
});

// Helper: Get Office or Group Name/Details
function getEntityInfo(id: string, offices: Office[], groups: Group[]) {
  if (id.startsWith("G")) {
    const group = groups.find(g => g.id === id);
    return {
      id: id,
      name: group ? `${group.name} (Grup Ofis)` : "Tanımsız Grup",
      ownerName: group ? group.ownerName : "Bilinmiyor",
      ownerEmail: group ? group.ownerEmail : ""
    };
  } else {
    const off = offices.find(o => o.id === id);
    return {
      id: id,
      name: off ? off.name : "Tanımsız Ofis",
      ownerName: off ? off.ownerName : "Bilinmiyor",
      ownerEmail: off ? off.ownerEmail : ""
    };
  }
}

// Generate Beautiful HTML Email Templates in Turkish
function generateHTMLTemplate(
  stage: "Tespit" | "Kontrol" | "Ceza",
  type: "Danışman" | "İlan",
  entityName: string,
  ownerName: string,
  details: string
): { subject: string, html: string } {
  let subject = "";
  let headerColor = "#0d9488"; // Teal-600
  let phaseTitle = "";

  if (stage === "Tespit") {
    subject = `[DÖNEM DENETİMİ] - 1. Aşama Tespit Bildirimi: ${entityName}`;
    phaseTitle = "Aşama 1: Tespit Fazı Bildirimi";
    headerColor = "#0f766e"; // Teal-700
  } else if (stage === "Kontrol") {
    subject = `[ÖNEMLİ] - 2. Aşama Kontrol Fazı Uyarı Bildirimi: ${entityName}`;
    phaseTitle = "Aşama 2: Kontrol ve Düzeltme Fazı";
    headerColor = "#b45309"; // Amber-700
  } else if (stage === "Ceza") {
    subject = `[CEZAİ İŞLEM] - Nihai Ceza Fazı Bildirimi: ${entityName}`;
    phaseTitle = "Aşama 3: Nihai Ceza Fazı";
    headerColor = "#be123c"; // Rose-700
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
        .header { background-color: ${headerColor}; padding: 25px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.025em; }
        .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; line-height: 1.6; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 15px; }
        .details-box { background-color: #f9fafb; border-left: 4px solid ${headerColor}; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0; }
        .details-title { font-weight: 600; margin-bottom: 5px; color: #374151; }
        .warning-text { color: #be123c; font-weight: 600; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #f3f4f6; }
        .cta-button { display: inline-block; background-color: ${headerColor}; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: 500; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${phaseTitle}</h1>
          <p>${type} Denetimi Kapsamında Uyumsuzluk Tespiti</p>
        </div>
        <div class="content">
          <div class="greeting">Sayın ${ownerName},</div>
          <p>Bağımsız franchise ofislerimizin standartlara uyum süreçlerini takip etmek amacıyla gerçekleştirdiğimiz rutin dönem denetimlerimizde, <strong>${entityName}</strong> bünyesinde birtakım uyumsuzluklar tespit edilmiştir.</p>
          
          <div class="details-box">
            <div class="details-title">🔍 Tespit Edilen Detaylar (${type} Denetimi):</div>
            <div style="font-size: 14px; white-space: pre-wrap;">${details}</div>
          </div>

          \${stage === "Tespit" ? \`
            <p><strong>Aksiyon Adımı:</strong> Lütfen en geç <strong class="warning-text">3 gün içerisinde</strong> ilgili verilerinizi (Panel ve İlan portalları) güncelleyerek uyumlu hale getiriniz. Kontrol fazında uyumluluk gösteren ofislerimiz süreçten elenecektir.</p>
          \` : stage === "Kontrol" ? \`
            <p class="warning-text">⚠️ ÖNEMLİ UYARI:</p>
            <p>Yapılan ilk tespit bildiriminin ardından geçen sürede gerekli düzeltmelerin yapılmadığı veya yetersiz kaldığı gözlemlenmiştir. Lütfen <strong class="warning-text">son 2 gün içerisinde</strong> uyumsuzlukları gideriniz. Aksi takdirde süreç <strong>Nihai Ceza Fazı'na</strong> aktarılacak ve cezai yaptırımlar devreye alınacaktır.</p>
          \` : \`
            <p class="warning-text">🚨 CEZAİ YAPTIRIM BİLDİRİMİ:</p>
            <p>Yapılan tüm uyarılara ve tanınan kontrol sürelerine rağmen uyumsuzluğun giderilmediği tespit edilmiştir. İlgili durum ceza havuzuna aktarılmış olup, sözleşme maddeleri uyarınca franchise ceza faturası/yaptırımı uygulanacaktır.</p>
          \`}

          <p>İş birliğiniz ve hassasiyetiniz için teşekkür eder, iyi çalışmalar dileriz.</p>
          <p style="margin-top: 25px; font-size: 13px; color: #9ca3af;">MasterTurk Franchise Denetim Direktörlüğü<br/><em>Bu e-posta otomatik olarak oluşturulmuştur.</em></p>
        </div>
        <div class="footer">
          &copy; 2026 MasterTurk Gayrimenkul A.Ş. Tüm Hakları Saklıdır.
        </div>
      </div>
    </body>
    </html>
  `;
  return { subject, html };
}

// 5. Advance Active Audit Period & Dispatch Mails
app.post("/api/audits/active/advance", async (req, res) => {
  try {
    const db = readDB();
    
    // Use passed in client state if present, otherwise read from server db
    let active: any = null;
    let activeIdx = -1;
    const isClientState = !!req.body.activeAudit;

    if (isClientState) {
      active = req.body.activeAudit;
    } else {
      activeIdx = db.audits.findIndex((a) => a.status === "Aktif");
      if (activeIdx !== -1) {
        active = db.audits[activeIdx];
      }
    }

    if (!active) {
      return res.status(404).json({ error: "Aktif bir denetim dönemi bulunamadı." });
    }

    const { approvedDanismanIds = [], approvedIlanIds = [], detailsMap = {} } = req.body;
    const offices = req.body.offices || db.offices;
    const groups = req.body.groups || db.groups;
    const config = req.body.config || db.config;
    
    // Combine all approved IDs to flag as problematic for this phase
    const allApprovedIds = Array.from(new Set([...approvedDanismanIds, ...approvedIlanIds])) as string[];

    const newEmails: EmailLog[] = [];

    // Send e-mails for Danışman
    for (const entityId of approvedDanismanIds) {
      const info = getEntityInfo(entityId, offices, groups);
      const detailText = detailsMap[entityId + "_danisman"] || "Yetkisiz / Kaçak Danışman tespiti yapılmıştır.";
      
      const mailTemplate = generateHTMLTemplate(
        active.currentPhase as any,
        "Danışman",
        info.name,
        info.ownerName,
        detailText
      );

      const dispatchResult = await dispatchEmail(
        config,
        info.ownerEmail || "destek@masterturk.com",
        mailTemplate.subject,
        mailTemplate.html
      );

      newEmails.push({
        id: "EML_" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        auditName: active.name,
        stage: active.currentPhase as any,
        type: "Danışman",
        officeId: entityId,
        officeName: info.name,
        recipient: info.ownerEmail || "destek@masterturk.com",
        subject: mailTemplate.subject,
        bodyHtml: mailTemplate.html,
        status: dispatchResult.status,
        errorDetails: dispatchResult.errorDetails
      });
    }

    // Send e-mails for İlan
    for (const entityId of approvedIlanIds) {
      const info = getEntityInfo(entityId, offices, groups);
      const detailText = detailsMap[entityId + "_ilan"] || "İlan portföy sayıları limit fark toleransını aşmaktadır.";

      const mailTemplate = generateHTMLTemplate(
        active.currentPhase as any,
        "İlan",
        info.name,
        info.ownerName,
        detailText
      );

      const dispatchResult = await dispatchEmail(
        config,
        info.ownerEmail || "destek@masterturk.com",
        mailTemplate.subject,
        mailTemplate.html
      );

      newEmails.push({
        id: "EML_" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        auditName: active.name,
        stage: active.currentPhase as any,
        type: "İlan",
        officeId: entityId,
        officeName: info.name,
        recipient: info.ownerEmail || "destek@masterturk.com",
        subject: mailTemplate.subject,
        bodyHtml: mailTemplate.html,
        status: dispatchResult.status,
        errorDetails: dispatchResult.errorDetails
      });
    }

    // Advance Phase on the active object
    if (active.currentPhase === "Tespit") {
      active.phase1ProblematicOffices = allApprovedIds;
      active.phase1ApprovedOffices = allApprovedIds;
      active.currentPhase = "Kontrol";
    } else if (active.currentPhase === "Kontrol") {
      active.phase2ProblematicOffices = allApprovedIds;
      active.phase2ApprovedOffices = allApprovedIds;
      active.currentPhase = "Ceza";
    } else if (active.currentPhase === "Ceza") {
      active.phase3ProblematicOffices = allApprovedIds;
      active.phase3ApprovedOffices = allApprovedIds;
    }
    active.updatedAt = new Date().toISOString();

    // If we are using server database state, write to db
    if (!isClientState && activeIdx !== -1) {
      db.emails = [...newEmails, ...db.emails];
      db.audits[activeIdx] = active;
      writeDB(db);
    }

    res.json({ active, sentEmails: newEmails });
  } catch (err: any) {
    console.error("Error in audits/active/advance handler:", err);
    res.status(500).json({ error: "Faz ilerletilirken sunucu hatası oluştu: " + err.message });
  }
});

// Close Active Audit Period
app.post("/api/audits/active/close", (req, res) => {
  const db = readDB();
  const activeIdx = db.audits.findIndex((a) => a.status === "Aktif");
  if (activeIdx === -1) {
    return res.status(404).json({ error: "Aktif bir denetim dönemi bulunamadı." });
  }

  const active = db.audits[activeIdx];
  active.status = "Tamamlandı";
  active.currentPhase = "Kapatıldı";
  active.updatedAt = new Date().toISOString();

  db.audits[activeIdx] = active;
  writeDB(db);
  res.json(active);
});

// 6. Sent Emails Log API
app.get("/api/emails", (req, res) => {
  const db = readDB();
  res.json(db.emails);
});


export default app;
