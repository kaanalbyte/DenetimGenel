import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dynamically determine the backend API URL (fallback, not strictly needed since Vercel serves on same origin)
const getApiBaseUrl = (): string => {
  const hostname = window.location.hostname;
  // If running locally, or on our container preview, keep relative path
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".run.app")) {
    return "";
  }
  
  // By default, Vercel supports serverless functions, so use relative path unless explicitly set
  const savedUrl = localStorage.getItem("BACKEND_API_URL");
  if (savedUrl) {
    return savedUrl.replace(/\/$/, ""); // strip trailing slash if any
  }
  
  return ""; // default to relative path so it hits the Vercel serverless function
};

// --- Local Storage Database Sync Helpers ---
const getLocalOffices = () => {
  const data = localStorage.getItem("db_offices");
  if (!data) {
    const def = [
      { id: "OF1001", name: "Master İstanbul Merkez", ownerName: "Ahmet Yılmaz", ownerEmail: "ahmet@masteristanbul.com", groupId: "G1" },
      { id: "OF1002", name: "Master İstanbul Beşiktaş", ownerName: "Ahmet Yılmaz", ownerEmail: "ahmet@masteristanbul.com", groupId: "G1" },
      { id: "OF1003", name: "Master Ankara Çankaya", ownerName: "Mehmet Kaya", ownerEmail: "mehmet@masterankara.com", groupId: "G2" },
      { id: "OF1004", name: "Master Ankara Ümitköy", ownerName: "Mehmet Kaya", ownerEmail: "mehmet@masterankara.com", groupId: "G2" },
      { id: "OF1005", name: "Master İzmir Bornova", ownerName: "Can Demir", ownerEmail: "can@masterizmir.com", groupId: "G3" },
      { id: "OF1006", name: "Master İzmir Karşıyaka", ownerName: "Can Demir", ownerEmail: "can@masterizmir.com", groupId: "G3" },
      { id: "OF1007", name: "Master Antalya Konyaaltı", ownerName: "Elif Şahin", ownerEmail: "elif@masterantalya.com", groupId: null },
      { id: "OF1008", name: "Master Bursa Nilüfer", ownerName: "Mustafa Yıldız", ownerEmail: "mustafa@masterbursa.com", groupId: null }
    ];
    localStorage.setItem("db_offices", JSON.stringify(def));
    return def;
  }
  return JSON.parse(data);
};

const getLocalGroups = () => {
  const data = localStorage.getItem("db_groups");
  if (!data) {
    const def = [
      { id: "G1", name: "İstanbul Kuzey Grubu", ownerName: "Ahmet Yılmaz", ownerEmail: "ahmet@masteristanbul.com" },
      { id: "G2", name: "Ankara Çankaya Grubu", ownerName: "Mehmet Kaya", ownerEmail: "mehmet@masterankara.com" },
      { id: "G3", name: "İzmir Körfez Grubu", ownerName: "Can Demir", ownerEmail: "can@masterizmir.com" }
    ];
    localStorage.setItem("db_groups", JSON.stringify(def));
    return def;
  }
  return JSON.parse(data);
};

const getLocalConfig = () => {
  const def = {
    resendApiKey: "",
    brevoApiKey: "",
    senderEmail: "denetim@masterturk.com.tr",
    smtpEnabled: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "denetim@masterturk.com.tr",
    smtpPass: "fucaupikpfrrhzzs"
  };
  localStorage.setItem("db_config", JSON.stringify(def));
  return def;
};

const getLocalAudits = () => {
  const data = localStorage.getItem("db_audits");
  if (!data) {
    localStorage.setItem("db_audits", JSON.stringify([]));
    return [];
  }
  return JSON.parse(data);
};

const getLocalEmails = () => {
  const data = localStorage.getItem("db_emails");
  if (!data) {
    localStorage.setItem("db_emails", JSON.stringify([]));
    return [];
  }
  return JSON.parse(data);
};

// Global Fetch Interceptor to handle offline/Vercel serverless database operations
const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  writable: true,
  configurable: true,
  value: function (input: RequestInfo | URL, init?: RequestInit) {
  const hostname = window.location.hostname;
  const isLocalMode = hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.endsWith(".run.app");

  if (isLocalMode && typeof input === "string" && input.startsWith("/api/") && input !== "/api/db/sync-from-client") {
    const url = input;
    const method = (init?.method || "GET").toUpperCase();

    // Helper to create Promise-wrapped Response object
    const makeResponse = (data: any, status = 200) => {
      return Promise.resolve(new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
      }));
    };

    try {
      // --- 1. GET /api/offices ---
      if (url === "/api/offices" && method === "GET") {
        return makeResponse(getLocalOffices());
      }

      // --- 2. POST /api/offices ---
      if (url === "/api/offices" && method === "POST") {
        const office = JSON.parse(init?.body as string);
        const offices = getLocalOffices();
        const existingIdx = offices.findIndex((o: any) => o.id === office.id && o.brand === office.brand);
        if (existingIdx > -1) {
          offices[existingIdx] = office;
        } else {
          offices.push(office);
        }
        localStorage.setItem("db_offices", JSON.stringify(offices));
        return makeResponse(office);
      }

      // --- 2c. POST /api/offices/bulk-assign ---
      if (url === "/api/offices/bulk-assign" && method === "POST") {
        const { compoundKeys, groupId } = JSON.parse(init?.body as string);
        if (!Array.isArray(compoundKeys)) {
          return makeResponse({ error: "Geçersiz veri formatı." }, 400);
        }
        const offices = getLocalOffices();
        const updatedOffices = offices.map((o: any) => {
          const key = `${o.id}:::${o.brand}`;
          if (compoundKeys.includes(key)) {
            return { ...o, groupId: groupId || null };
          }
          return o;
        });
        localStorage.setItem("db_offices", JSON.stringify(updatedOffices));
        return makeResponse({ success: true });
      }

      // --- 2b. POST /api/offices/upload ---
      if (url === "/api/offices/upload" && method === "POST") {
        const { offices, defaultBrand } = JSON.parse(init?.body as string);
        if (!Array.isArray(offices)) {
          return makeResponse({ error: "Geçersiz veri formatı." }, 400);
        }

        const localOffices = getLocalOffices();
        const addedList: { id: string; name: string; brand: string }[] = [];
        const updatedList: { id: string; name: string; brand: string }[] = [];
        let added = 0;
        let updated = 0;

        const getNormVal = (row: any, searchKeys: string[]): string => {
          if (!row || typeof row !== "object") return "";
          const normSearchKeys = searchKeys.map(k =>
            k.toLowerCase().replace(/[\s\-_]+/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
          );
          for (const rowKey of Object.keys(row)) {
            const normRowKey = rowKey.toLowerCase().replace(/[\s\-_]+/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
            if (normSearchKeys.includes(normRowKey)) {
              return String(row[rowKey] ?? "").trim();
            }
          }
          return "";
        };

        for (const row of offices) {
          const rawId = getNormVal(row, ["ofiskodu", "ofis kodu", "id", "kod"]);
          const rawStatus = getNormVal(row, ["durum", "status", "ofisdurumu"]);
          const rawName = getNormVal(row, ["ad", "adi", "ofisadi", "ofis adi", "name"]);
          const rawOwnerEmail = getNormVal(row, ["e-posta", "eposta", "email", "mail"]);
          const rawResponsible = getNormVal(row, ["sorumlu sistem kullanicisi", "sorumlusistemkullanicisi"]);
          const rawBrand = getNormVal(row, ["marka", "brand"]);

          const id = String(rawId).toUpperCase().trim();
          if (!id) continue;

          const name = String(rawName).trim() || "İsimsiz Ofis";
          const ownerEmail = String(rawOwnerEmail).trim();
          const status = String(rawStatus).trim();
          const responsibleUser = String(rawResponsible).trim();
          const ownerName = responsibleUser || "Bilinmiyor";

          let brand = String(rawBrand).trim();
          if (!brand && defaultBrand) {
            brand = defaultBrand;
          }

          if (!brand) {
            if (id.startsWith("CB")) brand = "Coldwell Banker";
            else if (id.startsWith("C21") || id.startsWith("CENTURY") || id.startsWith("CE")) brand = "Century 21";
            else if (id.startsWith("ERA")) brand = "ERA";
            else brand = "Diğer";
          }

          if (brand.toLowerCase().includes("cb") || brand.toLowerCase().includes("coldwell")) brand = "Coldwell Banker";
          else if (brand.toLowerCase().includes("c21") || brand.toLowerCase().includes("century")) brand = "Century 21";
          else if (brand.toLowerCase().includes("era")) brand = "ERA";

          const existingIdx = localOffices.findIndex((o: any) => o.id === id && o.brand === brand);
          if (existingIdx > -1) {
            localOffices[existingIdx] = {
              ...localOffices[existingIdx],
              name: name || localOffices[existingIdx].name,
              ownerName: ownerName || localOffices[existingIdx].ownerName,
              ownerEmail: ownerEmail || localOffices[existingIdx].ownerEmail,
              status: status || localOffices[existingIdx].status,
              responsibleUser: responsibleUser || localOffices[existingIdx].responsibleUser,
              brand: brand || localOffices[existingIdx].brand,
            };
            updatedList.push({ id, name, brand });
            updated++;
          } else {
            localOffices.push({
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

        localStorage.setItem("db_offices", JSON.stringify(localOffices));
        return makeResponse({ success: true, added, updated, addedList, updatedList });
      }

      // --- 3. DELETE /api/offices/:id ---
      if (url.startsWith("/api/offices/") && method === "DELETE") {
        const id = url.split("/").pop();
        const offices = getLocalOffices();
        const updated = offices.filter((o: any) => o.id !== id);
        localStorage.setItem("db_offices", JSON.stringify(updated));
        return makeResponse({ success: true });
      }

      // --- 4. GET /api/groups ---
      if (url === "/api/groups" && method === "GET") {
        return makeResponse(getLocalGroups());
      }

      // --- 5. POST /api/groups ---
      if (url === "/api/groups" && method === "POST") {
        const { group, officeIds } = JSON.parse(init?.body as string);
        const groups = getLocalGroups();
        const offices = getLocalOffices();

        const existingIdx = groups.findIndex((g: any) => g.id === group.id);
        if (existingIdx > -1) {
          groups[existingIdx] = group;
        } else {
          groups.push(group);
        }
        localStorage.setItem("db_groups", JSON.stringify(groups));

        const updatedOffices = offices.map((o: any) => {
          const compoundKey = `${o.id}:::${o.brand}`;
          if (officeIds.includes(o.id) || officeIds.includes(compoundKey)) {
            return { ...o, groupId: group.id };
          } else if (o.groupId === group.id) {
            return { ...o, groupId: null };
          }
          return o;
        });
        localStorage.setItem("db_offices", JSON.stringify(updatedOffices));
        return makeResponse({ success: true, group });
      }

      // --- 6. DELETE /api/groups/:id ---
      if (url.startsWith("/api/groups/") && method === "DELETE") {
        const id = url.split("/").pop();
        const groups = getLocalGroups();
        const offices = getLocalOffices();

        const updatedGroups = groups.filter((g: any) => g.id !== id);
        localStorage.setItem("db_groups", JSON.stringify(updatedGroups));

        const updatedOffices = offices.map((o: any) => {
          if (o.groupId === id) return { ...o, groupId: null };
          return o;
        });
        localStorage.setItem("db_offices", JSON.stringify(updatedOffices));
        return makeResponse({ success: true });
      }

      // --- 7. GET /api/config ---
      if (url === "/api/config" && method === "GET") {
        return makeResponse(getLocalConfig());
      }

      // --- 8. POST /api/config ---
      if (url === "/api/config" && method === "POST") {
        const newCfg = JSON.parse(init?.body as string);
        localStorage.setItem("db_config", JSON.stringify(newCfg));
        return makeResponse(newCfg);
      }

      // --- 9. GET /api/audits ---
      if (url === "/api/audits" && method === "GET") {
        return makeResponse(getLocalAudits());
      }

      // --- 10. GET /api/audits/active ---
      if (url === "/api/audits/active" && method === "GET") {
        const audits = getLocalAudits();
        const active = audits.find((a: any) => a.status === "Aktif") || null;
        return makeResponse(active);
      }

      // --- 11. POST /api/audits ---
      if (url === "/api/audits" && method === "POST") {
        const { name } = JSON.parse(init?.body as string);
        const audits = getLocalAudits();
        const offices = getLocalOffices();

        const newAudit = {
          id: "AUD_" + Math.random().toString(36).substr(2, 9),
          name: name,
          status: "Aktif",
          currentPhase: "Tespit",
          totalOfficesCount: offices.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          phase1DanismanRaw: [],
          phase1IlanPanelRaw: [],
          phase1IlanSahibindenRaw: [],
          phase1ProblematicOffices: [],
          phase1ApprovedOffices: [],
          phase2DanismanRaw: [],
          phase2IlanPanelRaw: [],
          phase2IlanSahibindenRaw: [],
          phase2ProblematicOffices: [],
          phase2ApprovedOffices: [],
          phase3ProblematicOffices: [],
          phase3ApprovedOffices: []
        };

        audits.push(newAudit);
        localStorage.setItem("db_audits", JSON.stringify(audits));
        return makeResponse(newAudit);
      }

      // --- 12. POST /api/audits/active/upload ---
      if (url === "/api/audits/active/upload" && method === "POST") {
        const parsed = JSON.parse(init?.body as string);
        const type = parsed.type;
        const incoming = parsed.data || parsed.rows || [];
        const secondary = parsed.secondaryData || [];

        const audits = getLocalAudits();
        const activeIdx = audits.findIndex((a: any) => a.status === "Aktif");
        if (activeIdx === -1) {
          return makeResponse({ error: "Aktif denetim yok" }, 404);
        }
        const active = audits[activeIdx];
        const phase = active.currentPhase;

        const getNormValLocal = (row: any, searchKeys: string[]): string => {
          if (!row || typeof row !== "object") return "";
          const normSearchKeys = searchKeys.map(k =>
            k.toLowerCase().replace(/[\s\-_]+/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
          );
          for (const rowKey of Object.keys(row)) {
            const normRowKey = rowKey.toLowerCase().replace(/[\s\-_]+/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
            if (normSearchKeys.includes(normRowKey)) {
              return String(row[rowKey] ?? "").trim();
            }
          }
          return "";
        };

        const getBrandFromRowLocal = (row: any): string => {
          const officeName = getNormValLocal(row, ["ofisadi", "ofis adi", "name", "office name", "ad", "unvan"]).trim();
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
          
          const src = String(row._sourceFile || "").toLowerCase();
          if (src.includes("cb")) return "Coldwell Banker";
          if (src.includes("c21") || src.includes("century")) return "Century 21";
          if (src.includes("era")) return "ERA";
          
          return "";
        };

        const mergeByOfficeCodeLocal = (existing: any[], incomingRows: any[]) => {
          const ex = Array.isArray(existing) ? existing : [];
          const inc = Array.isArray(incomingRows) ? incomingRows : [];
          const map = new Map<string, any>();
          ex.forEach(row => {
            const officeId = getNormValLocal(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
            if (officeId) {
              const brand = getBrandFromRowLocal(row);
              const key = brand ? `${officeId}:::${brand}` : officeId;
              map.set(key, row);
            }
          });
          inc.forEach(row => {
            const officeId = getNormValLocal(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
            if (officeId) {
              const brand = getBrandFromRowLocal(row);
              const key = brand ? `${officeId}:::${brand}` : officeId;
              map.set(key, row);
            }
          });
          return Array.from(map.values());
        };

        const mergeKacakDanismanLocal = (existing: any[], incomingRows: any[]) => {
          const ex = Array.isArray(existing) ? existing : [];
          const inc = Array.isArray(incomingRows) ? incomingRows : [];
          const map = new Map<string, any>();
          ex.forEach(row => {
            const offId = getNormValLocal(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
            const name = getNormValLocal(row, ["danismanadi", "danisman adi", "danisman adisoyadi", "danisman adi soyadi", "adsoyad", "ad soyad", "danismanadisoyadi"]).toUpperCase().trim();
            const key = `${offId}:::${name}`;
            if (offId && name) map.set(key, row);
          });
          inc.forEach(row => {
            const offId = getNormValLocal(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
            const name = getNormValLocal(row, ["danismanadi", "danisman adi", "danisman adisoyadi", "danisman adi soyadi", "adsoyad", "ad soyad", "danismanadisoyadi"]).toUpperCase().trim();
            const key = `${offId}:::${name}`;
            if (offId && name) map.set(key, row);
          });
          return Array.from(map.values());
        };

        if (phase === "Tespit") {
          if (type === "danisman") {
            active.phase1DanismanRaw = mergeByOfficeCodeLocal(active.phase1DanismanRaw, incoming);
          }
          if (type === "ilan_panel") {
            active.phase1IlanPanelRaw = mergeByOfficeCodeLocal(active.phase1IlanPanelRaw, incoming);
          }
          if (type === "ilan_sahibinden") {
            active.phase1IlanSahibindenRaw = mergeByOfficeCodeLocal(active.phase1IlanSahibindenRaw, incoming);
            if (Array.isArray(secondary) && secondary.length > 0) {
              active.phase1KacakDanismanRaw = mergeKacakDanismanLocal(active.phase1KacakDanismanRaw || [], secondary);
            }
          }
          active.phase1Uploaded = true;
        } else if (phase === "Kontrol") {
          if (type === "danisman") {
            active.phase2DanismanRaw = mergeByOfficeCodeLocal(active.phase2DanismanRaw, incoming);
          }
          if (type === "ilan_panel") {
            active.phase2IlanPanelRaw = mergeByOfficeCodeLocal(active.phase2IlanPanelRaw, incoming);
          }
          if (type === "ilan_sahibinden") {
            active.phase2IlanSahibindenRaw = mergeByOfficeCodeLocal(active.phase2IlanSahibindenRaw, incoming);
            if (Array.isArray(secondary) && secondary.length > 0) {
              active.phase2KacakDanismanRaw = mergeKacakDanismanLocal(active.phase2KacakDanismanRaw || [], secondary);
            }
          }
          active.phase2Uploaded = true;
        }
        active.updatedAt = new Date().toISOString();
        audits[activeIdx] = active;
        localStorage.setItem("db_audits", JSON.stringify(audits));
        return makeResponse(active);
      }

      // --- 12b. POST /api/audits/active/reset ---
      if (url === "/api/audits/active/reset" && method === "POST") {
        const audits = getLocalAudits();
        const activeIdx = audits.findIndex((a: any) => a.status === "Aktif");
        if (activeIdx === -1) {
          return makeResponse({ error: "Aktif denetim yok" }, 404);
        }
        const active = audits[activeIdx];
        const phase = active.currentPhase;

        if (phase === "Tespit") {
          active.phase1DanismanRaw = [];
          active.phase1IlanPanelRaw = [];
          active.phase1IlanSahibindenRaw = [];
          active.phase1KacakDanismanRaw = [];
          active.phase1Uploaded = false;
          active.phase1ProblematicOffices = [];
          active.phase1ApprovedOffices = [];
        } else if (phase === "Kontrol") {
          active.phase2DanismanRaw = [];
          active.phase2IlanPanelRaw = [];
          active.phase2IlanSahibindenRaw = [];
          active.phase2KacakDanismanRaw = [];
          active.phase2Uploaded = false;
          active.phase2ProblematicOffices = [];
          active.phase2ApprovedOffices = [];
        }
        active.updatedAt = new Date().toISOString();
        audits[activeIdx] = active;
        localStorage.setItem("db_audits", JSON.stringify(audits));
        return makeResponse(active);
      }

      // --- 13. POST /api/audits/active/problematic ---
      if (url === "/api/audits/active/problematic" && method === "POST") {
        const { problematicIds, approvedIds } = JSON.parse(init?.body as string);
        const audits = getLocalAudits();
        const activeIdx = audits.findIndex((a: any) => a.status === "Aktif");
        if (activeIdx === -1) {
          return makeResponse({ error: "Aktif denetim yok" }, 404);
        }
        const active = audits[activeIdx];
        const phase = active.currentPhase;

        if (phase === "Tespit") {
          active.phase1ProblematicOffices = problematicIds;
          active.phase1ApprovedOffices = approvedIds;
        } else if (phase === "Kontrol") {
          active.phase2ProblematicOffices = problematicIds;
          active.phase2ApprovedOffices = approvedIds;
        } else if (phase === "Ceza") {
          active.phase3ProblematicOffices = problematicIds;
          active.phase3ApprovedOffices = approvedIds;
        }
        active.updatedAt = new Date().toISOString();
        audits[activeIdx] = active;
        localStorage.setItem("db_audits", JSON.stringify(audits));
        return makeResponse(active);
      }

      // --- 14. POST /api/audits/active/close ---
      if (url === "/api/audits/active/close" && method === "POST") {
        const audits = getLocalAudits();
        const activeIdx = audits.findIndex((a: any) => a.status === "Aktif");
        if (activeIdx === -1) {
          return makeResponse({ error: "Aktif denetim yok" }, 404);
        }
        const active = audits[activeIdx];
        active.status = "Tamamlandı";
        active.currentPhase = "Kapatıldı";
        active.updatedAt = new Date().toISOString();
        audits[activeIdx] = active;
        localStorage.setItem("db_audits", JSON.stringify(audits));
        return makeResponse(active);
      }

      // --- 15. GET /api/emails ---
      if (url === "/api/emails" && method === "GET") {
        return makeResponse(getLocalEmails());
      }

      // --- 15b. POST /api/db/reset ---
      if (url === "/api/db/reset" && method === "POST") {
        localStorage.setItem("db_offices", JSON.stringify([]));
        localStorage.setItem("db_groups", JSON.stringify([]));
        localStorage.setItem("db_audits", JSON.stringify([]));
        localStorage.setItem("db_emails", JSON.stringify([]));
        localStorage.setItem("db_config", JSON.stringify({
          resendApiKey: "",
          brevoApiKey: "",
          senderEmail: "denetim@masterturk.com.tr",
          smtpEnabled: true,
          smtpHost: "smtp.gmail.com",
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: "denetim@masterturk.com.tr",
          smtpPass: "fucaupikpfrrhzzs"
        }));

        // Async forward to external backend if configured to sync Cloud/Firestore state
        const apiBase = getApiBaseUrl();
        if (apiBase) {
          const targetUrl = `${apiBase}${url}`;
          originalFetch(targetUrl, init).catch((e) => {
            console.warn("Arka plan veritabanı sıfırlama yönlendirmesi başarısız oldu:", e);
          });
        }

        return makeResponse({ success: true, message: "Tüm veritabanı başarıyla temizlendi." });
      }

      // --- 16. Stateless Passthrough for config/test-email ---
      if (url === "/api/config/test-email" && method === "POST") {
        const origBody = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const payload = {
          to: origBody.to,
          config: getLocalConfig()
        };
        
        const apiBase = getApiBaseUrl();
        const targetUrl = apiBase ? `${apiBase}${url}` : url;
        return originalFetch(targetUrl, {
          ...init,
          body: JSON.stringify(payload)
        }).then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone();
            clonedResponse.json().then((data) => {
              if (data.success && data.newLog) {
                const emails = getLocalEmails();
                emails.unshift(data.newLog);
                localStorage.setItem("db_emails", JSON.stringify(emails));
              }
            }).catch((e) => {
              console.error("Error logging test email locally:", e);
            });
          }
          return response;
        });
      }

      // --- 17. Stateless Passthrough for active/advance ---
      if (url === "/api/audits/active/advance" && method === "POST") {
        const origBody = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const audits = getLocalAudits();
        const activeAudit = audits.find((a: any) => a.status === "Aktif");

        const payload = {
          ...origBody,
          config: getLocalConfig(),
          offices: getLocalOffices(),
          groups: getLocalGroups(),
          activeAudit: activeAudit
        };

        const apiBase = getApiBaseUrl();
        const targetUrl = apiBase ? `${apiBase}${url}` : url;
        return originalFetch(targetUrl, {
          ...init,
          body: JSON.stringify(payload)
        }).then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone();
            clonedResponse.json().then((data) => {
              if (data.active) {
                const updatedAudits = getLocalAudits().map((a: any) => {
                  if (a.id === data.active.id) return data.active;
                  return a;
                });
                localStorage.setItem("db_audits", JSON.stringify(updatedAudits));
                
                if (data.sentEmails && data.sentEmails.length > 0) {
                  const emails = getLocalEmails();
                  localStorage.setItem("db_emails", JSON.stringify([...data.sentEmails, ...emails]));
                }
              }
            }).catch((e) => {
              console.error("Error updating local active audit after advance:", e);
            });
          }
          return response;
        });
      }
    } catch (err) {
      console.error("Fetch interceptor failed:", err);
    }
  }

  // Default Relative/Fallback Routing (Cloud Run Container / Localhost)
  let finalInput = input;
  if (typeof input === "string" && input.startsWith("/api/")) {
    const apiBaseUrl = getApiBaseUrl();
    if (apiBaseUrl) {
      finalInput = `${apiBaseUrl}${input}`;
    }
  }
  return originalFetch(finalInput, init);
}});

window.addEventListener('error', (e) => { document.body.innerHTML += '<div style="color:red;padding:20px;z-index:9999;position:relative;background:white"><h3>Error:</h3><pre>' + e.error?.message + '\n' + e.error?.stack + '</pre></div>'; }); window.addEventListener('unhandledrejection', (e) => { document.body.innerHTML += '<div style="color:red;padding:20px;z-index:9999;position:relative;background:white"><h3>Unhandled Promise:</h3><pre>' + e.reason + '</pre></div>'; });
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
