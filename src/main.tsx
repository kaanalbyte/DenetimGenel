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
  const data = localStorage.getItem("db_config");
  if (!data) {
    const def = {
      resendApiKey: "",
      brevoApiKey: "",
      senderEmail: "denetim@masterturk.com",
      smtpEnabled: false,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "",
      smtpPass: ""
    };
    localStorage.setItem("db_config", JSON.stringify(def));
    return def;
  }
  return JSON.parse(data);
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
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  const hostname = window.location.hostname;
  const isLocalMode = hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.endsWith(".run.app");

  if (isLocalMode && typeof input === "string" && input.startsWith("/api/")) {
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
        const existingIdx = offices.findIndex((o: any) => o.id === office.id);
        if (existingIdx > -1) {
          offices[existingIdx] = office;
        } else {
          offices.push(office);
        }
        localStorage.setItem("db_offices", JSON.stringify(offices));
        return makeResponse(office);
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
          if (officeIds.includes(o.id)) {
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
        const { type, rows } = JSON.parse(init?.body as string);
        const audits = getLocalAudits();
        const activeIdx = audits.findIndex((a: any) => a.status === "Aktif");
        if (activeIdx === -1) {
          return makeResponse({ error: "Aktif denetim yok" }, 404);
        }
        const active = audits[activeIdx];
        const phase = active.currentPhase;

        if (phase === "Tespit") {
          if (type === "danisman") active.phase1DanismanRaw = rows;
          if (type === "ilan_panel") active.phase1IlanPanelRaw = rows;
          if (type === "ilan_sahibinden") active.phase1IlanSahibindenRaw = rows;
        } else if (phase === "Kontrol") {
          if (type === "danisman") active.phase2DanismanRaw = rows;
          if (type === "ilan_panel") active.phase2IlanPanelRaw = rows;
          if (type === "ilan_sahibinden") active.phase2IlanSahibindenRaw = rows;
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
        }).then(async (response) => {
          if (response.ok) {
            try {
              const data = await response.clone().json();
              if (data.success && data.newLog) {
                const emails = getLocalEmails();
                emails.unshift(data.newLog);
                localStorage.setItem("db_emails", JSON.stringify(emails));
              }
            } catch (e) {
              console.error("Error logging test email locally:", e);
            }
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
        }).then(async (response) => {
          if (response.ok) {
            try {
              const data = await response.clone().json();
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
            } catch (e) {
              console.error("Error updating local active audit after advance:", e);
            }
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
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
