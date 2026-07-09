import React, { useState, useEffect } from "react";
import { Office, Group, AuditPeriod } from "../types";
import { ExcelUploader } from "./ExcelUploader";
import {
  ShieldAlert,
  Play,
  FileSpreadsheet,
  CheckCircle,
  AlertOctagon,
  ArrowRight,
  Upload,
  Sparkles,
  Mail,
  UserCheck,
  ChevronRight,
  History,
  XCircle,
  FileCheck2
} from "lucide-react";

interface AuditPanelProps {
  offices: Office[];
  groups: Group[];
  activeAudit: AuditPeriod | null;
  onRefresh: () => void;
  onStartAudit: (name: string) => Promise<void>;
}

export default function AuditPanel({ offices, groups, activeAudit, onRefresh, onStartAudit }: AuditPanelProps) {
  const [periodName, setPeriodName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // CSV Drag and drop / local states
  const [danismanFile, setDanismanFile] = useState<File | null>(null);
  const [panelIlanFile, setPanelIlanFile] = useState<File | null>(null);
  const [sahibindenFile, setSahibindenFile] = useState<File | null>(null);

  // Selection states for problematic entities to send mail to
  const [selectedDanismanIds, setSelectedDanismanIds] = useState<string[]>([]);
  const [selectedIlanIds, setSelectedIlanIds] = useState<string[]>([]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Pre-calculated tables state
  const [danismanReport, setDanismanReport] = useState<any[]>([]);
  const [ilanReport, setIlanReport] = useState<any[]>([]);

  // Calculate Reports whenever activeAudit data, groups, or offices change
  useEffect(() => {
    if (!activeAudit) {
      setDanismanReport([]);
      setIlanReport([]);
      return;
    }

    const currentPhase = activeAudit.currentPhase;
    const danismanRaw = (currentPhase === "Tespit" ? activeAudit.phase1DanismanRaw : activeAudit.phase2DanismanRaw) || [];
    const ilanPanelRaw = (currentPhase === "Tespit" ? activeAudit.phase1IlanPanelRaw : activeAudit.phase2IlanPanelRaw) || [];
    const ilanSahibindenRaw = (currentPhase === "Tespit" ? activeAudit.phase1IlanSahibindenRaw : activeAudit.phase2IlanSahibindenRaw) || [];

    // Determine target entities:
    // If in Phase 2 (Kontrol), we ONLY evaluate entities that were problematic in Phase 1 (activeAudit.phase1ProblematicOffices)
    const isPhase2 = currentPhase === "Kontrol";
    const phase1Problematic = activeAudit.phase1ProblematicOffices || [];

    // --- 1. DANİŞMAN DENETİMİ RAPORU HESAPLAMA ---
    const danismanMap: { [entityId: string]: { code: string; name: string; ownerName: string; countSahibinden: number; countPanel: number; names: string[]; status: "Sorunlu" | "Uyumlu" } } = {};

    // Initialize map with all offices/groups
    const initializeEntityInMap = (id: string, name: string, ownerName: string) => {
      if (!danismanMap[id]) {
        danismanMap[id] = {
          code: id,
          name,
          ownerName,
          countSahibinden: 0,
          countPanel: 0,
          names: [],
          status: "Uyumlu"
        };
      }
    };

    // Populate offices and groups
    offices.forEach(o => {
      if (isPhase2 && !phase1Problematic.includes(o.groupId || o.id)) return; // Only problematic ones in Phase 2
      
      if (o.groupId) {
        const group = groups.find(g => g.id === o.groupId);
        if (group) initializeEntityInMap(group.id, `${group.name} (Grup)`, group.ownerName);
      } else {
        initializeEntityInMap(o.id, o.name, o.ownerName);
      }
    });

    // Process raw Kaçak Danışman Upload rows
    // Schema of raw rows: { ofisKodu, danismanAdi, unvan, sahibindenSayisi, panelSayisi }
    danismanRaw.forEach(row => {
      const officeId = row.ofisKodu || row["Ofis Kodu"];
      if (!officeId) return;

      const rowBrand = String(row.marka || row["Marka"] || row.brand || row["Brand"] || "").trim().toLowerCase();
      let office = offices.find(o => o.id === officeId && (rowBrand ? o.brand.toLowerCase().includes(rowBrand) : true));
      if (!office) {
        office = offices.find(o => o.id === officeId);
      }
      if (!office) return;

      const entityId = office.groupId || office.id;
      // If phase 2, verify if it was problematic
      if (isPhase2 && !phase1Problematic.includes(entityId)) return;

      const entity = danismanMap[entityId];
      if (entity) {
        entity.countSahibinden += Number(row.sahibindenSayisi || row["Sahibinden Danışman Sayısı"] || 1);
        entity.countPanel += Number(row.panelSayisi || row["Panel Danışman Sayısı"] || 0);
        const name = row.danismanAdi || row["Ad Soyad"] || "Bilinmeyen Danışman";
        if (name && !entity.names.includes(name)) {
          entity.names.push(name);
        }
        entity.status = "Sorunlu";
      }
    });

    const danismanArr = Object.values(danismanMap);
    setDanismanReport(danismanArr);

    // --- 2. İLAN DENETİMİ RAPORU HESAPLAMA ---
    const ilanMap: { [entityId: string]: { code: string; name: string; ownerName: string; countSahibinden: number; countPanel: number; difference: number; status: "Sorunlu" | "Uyumlu" } } = {};

    offices.forEach(o => {
      const targetId = o.groupId || o.id;
      if (isPhase2 && !phase1Problematic.includes(targetId)) return;

      if (!ilanMap[targetId]) {
        if (o.groupId) {
          const group = groups.find(g => g.id === o.groupId);
          ilanMap[targetId] = {
            code: targetId,
            name: group ? `${group.name} (Grup)` : "Grup Ofis",
            ownerName: group ? group.ownerName : o.ownerName,
            countSahibinden: 0,
            countPanel: 0,
            difference: 0,
            status: "Uyumlu"
          };
        } else {
          ilanMap[targetId] = {
            code: targetId,
            name: o.name,
            ownerName: o.ownerName,
            countSahibinden: 0,
            countPanel: 0,
            difference: 0,
            status: "Uyumlu"
          };
        }
      }
    });

    // Populate Panel Counts
    ilanPanelRaw.forEach(row => {
      const officeId = row.ofisKodu || row["Ofis Kodu"];
      const count = Number(row.ilanSayisi || row["İlan Sayısı"] || 0);
      const rowBrand = String(row.marka || row["Marka"] || row.brand || row["Brand"] || "").trim().toLowerCase();
      let office = offices.find(o => o.id === officeId && (rowBrand ? o.brand.toLowerCase().includes(rowBrand) : true));
      if (!office) {
        office = offices.find(o => o.id === officeId);
      }
      if (!office) return;

      const targetId = office.groupId || office.id;
      if (ilanMap[targetId]) {
        ilanMap[targetId].countPanel += count;
      }
    });

    // Populate Sahibinden Counts
    ilanSahibindenRaw.forEach(row => {
      const officeId = row.ofisKodu || row["Ofis Kodu"];
      const count = Number(row.ilanSayisi || row["İlan Sayısı"] || 0);
      const rowBrand = String(row.marka || row["Marka"] || row.brand || row["Brand"] || "").trim().toLowerCase();
      let office = offices.find(o => o.id === officeId && (rowBrand ? o.brand.toLowerCase().includes(rowBrand) : true));
      if (!office) {
        office = offices.find(o => o.id === officeId);
      }
      if (!office) return;

      const targetId = office.groupId || office.id;
      if (ilanMap[targetId]) {
        ilanMap[targetId].countSahibinden += count;
      }
    });

    // Apply tolerances rules to consolidated totals
    Object.keys(ilanMap).forEach(key => {
      const item = ilanMap[key];
      const s = item.countSahibinden;
      const p = item.countPanel;
      const diff = s - p; // Excess on Sahibinden portal
      item.difference = diff;

      // Rule:
      // If Total Sahibinden Listings <= 100: Max 10 listings difference tolerance. (Problematic if diff > 10)
      // If Total Sahibinden Listings > 100: Max 10% excess tolerance. (Problematic if diff > p * 0.10)
      let isProblematic = false;
      if (s <= 100) {
        if (diff > 10) isProblematic = true;
      } else {
        if (diff > p * 0.10) isProblematic = true;
      }

      item.status = isProblematic ? "Sorunlu" : "Uyumlu";
    });

    const ilanArr = Object.values(ilanMap);
    setIlanReport(ilanArr);

    // Auto select problematic ones
    const badDanismanIds = danismanArr.filter(i => i.status === "Sorunlu").map(i => i.code);
    const badIlanIds = ilanArr.filter(i => i.status === "Sorunlu").map(i => i.code);

    setSelectedDanismanIds(badDanismanIds);
    setSelectedIlanIds(badIlanIds);

  }, [activeAudit, offices, groups]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodName.trim()) return;
    setLoading(true);
    try {
      await onStartAudit(periodName.trim());
      setPeriodName("");
      showMsg("success", "Denetim dönemi başarıyla başlatıldı!");
    } catch (err) {
      showMsg("error", "Dönem başlatılırken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleRealDataLoad = async (type: "danisman" | "ilan_panel" | "ilan_sahibinden", data: any[]) => {
    if (!activeAudit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data })
      });
      if (res.ok) {
        showMsg("success", "Gerçek veri başarıyla yüklendi!");
        onRefresh();
      } else {
        const err = await res.json();
        showMsg("error", "Hata: " + err.error);
      }
    } catch (err) {
      showMsg("error", "Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  // Client Side CSV mock loader
  const handleLoadMockData = async () => {
    if (!activeAudit) return;
    setLoading(true);

    let danismanMock: any[] = [];
    let panelIlanMock: any[] = [];
    let sahibindenIlanMock: any[] = [];

    if (activeAudit.currentPhase === "Tespit") {
      // PHASE 1 SAMPLE DATA
      // Let's create realistic discrepancies
      danismanMock = [
        { ofisKodu: "OF1001", danismanAdi: "Kaan Arslan", unvan: "Danışman", sahibindenSayisi: 1, panelSayisi: 0 },
        { ofisKodu: "OF1001", danismanAdi: "Zeynep Tekin", unvan: "Lüks Konut", sahibindenSayisi: 1, panelSayisi: 0 },
        { ofisKodu: "OF1003", danismanAdi: "Mert Demir", unvan: "Danışman", sahibindenSayisi: 1, panelSayisi: 0 },
        { ofisKodu: "OF1007", danismanAdi: "Selin Bakır", unvan: "Arsa Uzmanı", sahibindenSayisi: 1, panelSayisi: 0 }
      ];

      panelIlanMock = [
        { ofisKodu: "OF1001", ilanSayisi: 80 },
        { ofisKodu: "OF1002", ilanSayisi: 40 }, // Group G1 Panel Total = 120
        { ofisKodu: "OF1003", ilanSayisi: 45 },
        { ofisKodu: "OF1004", ilanSayisi: 50 }, // Group G2 Panel Total = 95
        { ofisKodu: "OF1005", ilanSayisi: 30 },
        { ofisKodu: "OF1006", ilanSayisi: 35 }, // Group G3 Panel Total = 65
        { ofisKodu: "OF1007", ilanSayisi: 25 },
        { ofisKodu: "OF1008", ilanSayisi: 50 }
      ];

      // G1 Sahibinden Total = 95 + 35 = 130. Panel Total = 120. Diff = 10 (S > 100, Tolerance 10% = 12. 10 <= 12 COMPLIANT!)
      // G2 Sahibinden Total = 60 + 55 = 115. Panel Total = 95. Diff = 20 (S > 100, Tolerance 10% = 9.5. 20 > 9.5 PROBLEMATIC!)
      // G3 Sahibinden Total = 40 + 38 = 78. Panel Total = 65. Diff = 13 (S <= 100, Tolerance = 10. 13 > 10 PROBLEMATIC!)
      // OF1007 (Independent) Sahibinden = 40. Panel = 25. Diff = 15 (S <= 100, Tolerance = 10. 15 > 10 PROBLEMATIC!)
      // OF1008 (Independent) Sahibinden = 55. Panel = 50. Diff = 5 (S <= 100, Tolerance = 10. 5 <= 10 COMPLIANT!)
      sahibindenIlanMock = [
        { ofisKodu: "OF1001", ilanSayisi: 95 },
        { ofisKodu: "OF1002", ilanSayisi: 35 },
        { ofisKodu: "OF1003", ilanSayisi: 60 },
        { ofisKodu: "OF1004", ilanSayisi: 55 },
        { ofisKodu: "OF1005", ilanSayisi: 40 },
        { ofisKodu: "OF1006", ilanSayisi: 38 },
        { ofisKodu: "OF1007", ilanSayisi: 40 },
        { ofisKodu: "OF1008", ilanSayisi: 55 }
      ];
    } else if (activeAudit.currentPhase === "Kontrol") {
      // PHASE 2 SAMPLE DATA: Let's assume some offices corrected their issues!
      // G2 (Kaya) corrected Sahibinden listings, G3 (Demir) and OF1007 still fail.
      // OF1001 (Part of G1) corrected their illegal consultants, G2 resolved, but G3 and OF1007 still have unresolved Kaçak.
      danismanMock = [
        { ofisKodu: "OF1003", danismanAdi: "Mert Demir", unvan: "Danışman", sahibindenSayisi: 1, panelSayisi: 0 } // G2 corrected (no kaçak), G3 (Demir) still has 1
      ];

      panelIlanMock = [
        { ofisKodu: "OF1001", ilanSayisi: 80 },
        { ofisKodu: "OF1002", ilanSayisi: 40 },
        { ofisKodu: "OF1003", ilanSayisi: 45 },
        { ofisKodu: "OF1004", ilanSayisi: 50 }, // G2 Panel = 95
        { ofisKodu: "OF1005", ilanSayisi: 30 },
        { ofisKodu: "OF1006", ilanSayisi: 35 }, // G3 Panel = 65
        { ofisKodu: "OF1007", ilanSayisi: 25 },
        { ofisKodu: "OF1008", ilanSayisi: 50 }
      ];

      sahibindenIlanMock = [
        { ofisKodu: "OF1001", ilanSayisi: 90 },
        { ofisKodu: "OF1002", ilanSayisi: 35 },
        { ofisKodu: "OF1003", ilanSayisi: 50 },
        { ofisKodu: "OF1004", ilanSayisi: 50 }, // G2 Sahibinden Total = 100. Panel = 95. Diff = 5 (Compliant! They fixed it!)
        { ofisKodu: "OF1005", ilanSayisi: 42 },
        { ofisKodu: "OF1006", ilanSayisi: 40 }, // G3 Sahibinden Total = 82. Panel = 65. Diff = 17 (Failed again!)
        { ofisKodu: "OF1007", ilanSayisi: 41 }, // OF1007 Sahibinden = 41. Panel = 25. Diff = 16 (Failed again!)
        { ofisKodu: "OF1008", ilanSayisi: 50 }
      ];
    }

    try {
      // Save danisman
      await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "danisman", data: danismanMock })
      });
      // Save panel
      await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ilan_panel", data: panelIlanMock })
      });
      // Save sahibinden
      const res = await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ilan_sahibinden", data: sahibindenIlanMock })
      });

      if (res.ok) {
        showMsg("success", `Örnek ${activeAudit.currentPhase} Verileri Başarıyla Yüklendi!`);
        onRefresh();
      }
    } catch (err) {
      showMsg("error", "Hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // Advance Phase / Send Mail API call
  const handleAdvancePhase = async () => {
    if (!activeAudit) return;
    setLoading(true);

    // Build detailsMap for emails
    const detailsMap: { [key: string]: string } = {};

    danismanReport.forEach(item => {
      if (selectedDanismanIds.includes(item.code)) {
        detailsMap[item.code + "_danisman"] = `Portallerde yapılan eşleştirmelerde, ofisiniz bünyesinde çalışan ancak resmi panelde kaydı bulunmayan yetkisiz (kaçak) danışmanlar tespit edilmiştir:\n\nKaçak Danışman Listesi: ${item.names.join(", ")}\n\nSahibinden Danışman Sayısı: ${item.countSahibinden}\nPanel Danışman Sayısı: ${item.countPanel}`;
      }
    });

    ilanReport.forEach(item => {
      if (selectedIlanIds.includes(item.code)) {
        const thresholdText = item.countSahibinden <= 100 
          ? "Sahibinden ilan sayısı <= 100 olduğu için en fazla 10 adet ilan farkı toleransı mevcuttur." 
          : "Sahibinden ilan sayısı > 100 olduğu için en fazla %10 fazla ilan toleransı mevcuttur.";

        detailsMap[item.code + "_ilan"] = `Yapılan ilan denetimlerinde, resmi paneliniz ile Sahibinden.com portalındaki ilan adetlerinizin uyumsuz olduğu tespit edilmiştir.\n\nSahibinden Toplam İlan Sayısı: ${item.countSahibinden}\nPanel Toplam İlan Sayısı: ${item.countPanel}\nFark: +${item.difference}\n\nAçıklama: ${thresholdText}`;
      }
    });

    try {
      const res = await fetch("/api/audits/active/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedDanismanIds: selectedDanismanIds,
          approvedIlanIds: selectedIlanIds,
          detailsMap
        })
      });

      if (res.ok) {
        const data = await res.json();
        const emailCount = data.sentEmails ? data.sentEmails.length : 0;
        showMsg("success", `${emailCount} Adet E-Posta Gönderildi/Simüle Edildi. Aşama İlerletildi.`);
        onRefresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        showMsg("error", errData.error || errData.message || "Faz ilerletilirken hata oluştu.");
      }
    } catch (err) {
      showMsg("error", "İletişim hatası.");
    } finally {
      setLoading(false);
    }
  };

  // Close audit period
  const handleCloseAudit = async () => {
    if (!activeAudit) return;
    if (!confirm("Denetim dönemini tamamlayarak kapatmak istiyor musunuz? Tüm sonuçlar arşive gönderilecektir.")) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/audits/active/close", { method: "POST" });
      if (res.ok) {
        showMsg("success", "Denetim Dönemi Başarıyla Kapatıldı!");
        onRefresh();
      }
    } catch (err) {
      showMsg("error", "Kapatma işleminde hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // Helper selectors toggles
  const toggleDanismanSelection = (id: string) => {
    setSelectedDanismanIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleIlanSelection = (id: string) => {
    setSelectedIlanIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8" id="audit-process-panel">
      {msg && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded border text-xs max-w-md shadow-md ${
            msg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* NO ACTIVE AUDIT STATE */}
      {!activeAudit ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-10 text-center max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 bg-blue-50 rounded flex items-center justify-center mx-auto border border-blue-100">
            <ShieldAlert className="w-8 h-8 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Aktif Denetim Dönemi Bulunmuyor
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Bağımsız franchise ofislerinin kaçak danışman ve ilan portföy sayılarını denetlemek için yeni bir denetim dönemi başlatın.
            </p>
          </div>

          <form onSubmit={handleStart} className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              required
              placeholder="Örn: Ocak 2026 Dönem Denetimi"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded transition duration-150 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Başlat
            </button>
          </form>
        </div>
      ) : (
        /* ACTIVE AUDIT PRESENT STATE */
        <div className="space-y-6">
          
          {/* Active Period Header and Progress Funnel Visualizer */}
          <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-bold px-2 py-0.5 rounded uppercase font-mono">
                  ● AKTİF DENETİM SÜRECİ
                </span>
                <h2 className="text-base font-bold text-slate-800 mt-2 tracking-tight">
                  {activeAudit.name}
                </h2>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Başlatılma Tarihi: {new Date(activeAudit.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>

              <div className="flex gap-2">
                {activeAudit.currentPhase !== "Kapatıldı" && (
                  <button
                    onClick={handleCloseAudit}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Denetim Dönemini Kapat
                  </button>
                )}
              </div>
            </div>

            {/* Funnel Progress Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-5">
              
              {/* Step 1: Tespit */}
              <div className={`p-3 rounded border transition ${
                activeAudit.currentPhase === "Tespit"
                  ? "bg-slate-900 text-white border-slate-950 shadow-xs"
                  : "bg-slate-50 border-slate-200 opacity-60 text-slate-600"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    activeAudit.currentPhase === "Tespit"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    1
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${activeAudit.currentPhase === "Tespit" ? "text-white" : "text-slate-800"}`}>1. Tespit Fazı</h3>
                    <p className={`text-[10px] mt-0.5 ${activeAudit.currentPhase === "Tespit" ? "text-slate-400" : "text-slate-500"}`}>Excel'ler yüklenir, ilk mailler atılır.</p>
                  </div>
                </div>
              </div>

              {/* Step 2: Kontrol */}
              <div className={`p-3 rounded border transition ${
                activeAudit.currentPhase === "Kontrol"
                  ? "bg-slate-900 text-white border-slate-950 shadow-xs"
                  : "bg-slate-50 border-slate-200 opacity-60 text-slate-600"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    activeAudit.currentPhase === "Kontrol"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    2
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${activeAudit.currentPhase === "Kontrol" ? "text-white" : "text-slate-800"}`}>2. Kontrol Fazı</h3>
                    <p className={`text-[10px] mt-0.5 ${activeAudit.currentPhase === "Kontrol" ? "text-slate-400" : "text-slate-500"}`}>Düzeltmeler kontrol edilir, 2. mailler gider.</p>
                  </div>
                </div>
              </div>

              {/* Step 3: Ceza */}
              <div className={`p-3 rounded border transition ${
                activeAudit.currentPhase === "Ceza"
                  ? "bg-slate-900 text-white border-slate-950 shadow-xs"
                  : "bg-slate-50 border-slate-200 opacity-60 text-slate-600"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    activeAudit.currentPhase === "Ceza"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    3
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${activeAudit.currentPhase === "Ceza" ? "text-white" : "text-slate-800"}`}>3. Ceza Fazı</h3>
                    <p className={`text-[10px] mt-0.5 ${activeAudit.currentPhase === "Ceza" ? "text-slate-400" : "text-slate-500"}`}>Kemikleşmiş uyumsuzluklar cezalandırılır.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* PHASE ACTION AREA */}
          {activeAudit.currentPhase === "Tespit" || activeAudit.currentPhase === "Kontrol" ? (
            <div className="space-y-6">
              
              {/* Upload Zone & Guide */}
              <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8 space-y-1">
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-mono">Aşama Eylemi</div>
                  <h3 className="text-xs font-bold text-slate-800">
                    {activeAudit.currentPhase === "Tespit" 
                      ? "1. Adım: Denetim Raporlarını İçeri Aktarın" 
                      : "2. Adım: Kontrol Excel Verilerini Yükleyin"}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sistem, yüklediğiniz verileri otomatik olarak veritabanında kayıtlı grup ofis ilişkilerine göre konsolide edecek ve tolerans kurallarını işletecektir.
                  </p>
                </div>
                
                <div className="md:col-span-4 flex flex-col sm:flex-row gap-2 md:justify-end">
                  <button
                    onClick={handleLoadMockData}
                    disabled={loading}
                    className="w-full sm:w-auto bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold py-2 px-3.5 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Örnek Veri Seti Yükle
                  </button>
                </div>
              </div>

              <ExcelUploader 
                onDataLoaded={handleRealDataLoad} 
                isLoading={loading} 
                title="Denetim Verisi Yükleme"
                fileTypes={[
                  { id: "danisman", label: "Kaçak Danışman Listesi" },
                  { id: "ilan_panel", label: "MasterTürk Panel İlan Raporu" },
                  { id: "ilan_sahibinden", label: "Sahibinden.com İlan Raporu" }
                ]}
                hints={
                  <>
                    <p><strong>Danışman Listesi:</strong> <em>ofisKodu, danismanAdi, unvan, sahibindenSayisi, panelSayisi</em> kolonlarını içermelidir.</p>
                    <p><strong>İlan Raporları:</strong> <em>ofisKodu, ilanSayisi</em> kolonlarını içermelidir.</p>
                  </>
                }
              />

              {/* REPORT DISPLAY TABLES */}
              {((activeAudit.currentPhase === "Tespit" && activeAudit.phase1Uploaded) ||
                (activeAudit.currentPhase === "Kontrol" && activeAudit.phase2Uploaded)) ? (
                <div className="space-y-6">
                  
                  {/* TITLE HEADERS & INFO */}
                  <div className="bg-slate-900 text-white rounded-lg p-4 border border-slate-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs">Konsolide Hesaplamalar Tamamlandı</h4>
                      <p className="text-[11px] text-slate-400">
                        Grup ilişkileriyle birleştirilen toplam veriler kurallarla süzüldü. Lütfen tespit edilen sorunları onaylayıp bildirin.
                      </p>
                    </div>
                    <button
                      onClick={handleAdvancePhase}
                      className="px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs font-bold transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-white" />
                      Seçilenlere Mailleri Gönder & Fazı İlerlet
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    
                    {/* TABLE A: Danışman Denetimi (Kaçak Danışman) */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">BAŞLIK A</span>
                            Danışman Denetimi (Kaçak Danışman Havuzu)
                          </h3>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 w-10">Seç</th>
                              <th className="px-3 py-2">Ofis/Grup Kodu & Adı</th>
                              <th className="px-3 py-2">Durumu</th>
                              <th className="px-3 py-2 text-center">Sahibinden / Panel</th>
                              <th className="px-3 py-2">Kaçak Danışmanlar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {danismanReport.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-6 text-slate-400">Uyumsuz danışman tespiti bulunmuyor.</td>
                              </tr>
                            ) : (
                              danismanReport.map((item) => (
                                <tr key={item.code} className={`hover:bg-slate-50/40 transition ${item.status === "Sorunlu" ? "bg-rose-50/20" : ""}`}>
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      disabled={item.status === "Uyumlu"}
                                      checked={selectedDanismanIds.includes(item.code)}
                                      onChange={() => toggleDanismanSelection(item.code)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-30 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="font-semibold text-slate-850">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.code} - {item.ownerName}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                                      item.status === "Sorunlu" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                                    }`}>
                                      {item.status === "Sorunlu" ? "KAÇAK VAR" : "UYUMLU"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono font-medium text-slate-700">
                                    <span className="text-slate-900">{item.countSahibinden}</span>
                                    <span className="text-slate-300 mx-1">/</span>
                                    <span className="text-slate-500">{item.countPanel}</span>
                                  </td>
                                  <td className="px-3 py-2 text-rose-700 font-semibold max-w-[150px] truncate">
                                    {item.names.length > 0 ? item.names.join(", ") : "-"}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* TABLE B: İlan Denetimi (Portföy Sayıları) */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">BAŞLIK B</span>
                            İlan Denetimi (Portföy Adetleri ve Tolerans)
                          </h3>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 w-10">Seç</th>
                              <th className="px-3 py-2">Ofis/Grup Kodu & Adı</th>
                              <th className="px-3 py-2">Durumu</th>
                              <th className="px-3 py-2 text-center">Sahibinden / Panel</th>
                              <th className="px-3 py-2 text-center">Fark</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ilanReport.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-6 text-slate-400">Uyumsuz ilan sayısı tespiti bulunmuyor.</td>
                              </tr>
                            ) : (
                              ilanReport.map((item) => (
                                <tr key={item.code} className={`hover:bg-slate-50/40 transition ${item.status === "Sorunlu" ? "bg-rose-50/20" : ""}`}>
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      disabled={item.status === "Uyumlu"}
                                      checked={selectedIlanIds.includes(item.code)}
                                      onChange={() => toggleIlanSelection(item.code)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-30 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="font-semibold text-slate-850">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.code} - {item.ownerName}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                                      item.status === "Sorunlu" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                                    }`}>
                                      {item.status === "Sorunlu" ? "LİMİT AŞILDI" : "UYUMLU"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono font-medium text-slate-700">
                                    <span className="text-slate-900">{item.countSahibinden}</span>
                                    <span className="text-slate-300 mx-1">/</span>
                                    <span className="text-slate-500">{item.countPanel}</span>
                                  </td>
                                  <td className="px-3 py-2 text-center font-semibold font-mono">
                                    <span className={item.difference > 0 ? "text-rose-600" : "text-emerald-600"}>
                                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>

                </div>
              ) : (
                /* EMPTY DATA NOTIFICATION */
                <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-400">
                  <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <div className="text-xs font-semibold text-slate-700">Uyumsuzluk Hesaplaması Bekleniyor</div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    Hesaplama yapabilmek için lütfen "Örnek Veri Seti Yükle" butonuna tıklayın ya da Excel CSV rapor dosyalarınızı sisteme entegre edin.
                  </p>
                </div>
              )}

            </div>
          ) : (
            /* PHASE 3: CEZA FAZI DISPLAY */
            <div className="space-y-6">
              <div className="bg-rose-950 text-white rounded-lg p-5 border border-rose-900 shadow-xs flex flex-wrap justify-between items-center gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-300" />
                    3. Faz: Nihai Ceza Havuzu
                  </h3>
                  <p className="text-[11px] text-rose-200/80 leading-relaxed">
                    Önceki tüm aşamalarda (Tespit ve Kontrol) uyarılmasına rağmen limitleri aşmaya veya kaçak çalışmaya devam eden kemikleşmiş ofisler listelenmiştir.
                  </p>
                </div>
                <button
                  onClick={handleCloseAudit}
                  className="px-3.5 py-2 bg-white text-rose-950 hover:bg-rose-50 rounded text-xs font-bold transition duration-150 shadow-xs cursor-pointer"
                >
                  Bu Denetim Dönemini Tamamla
                </button>
              </div>

              {/* LIST OF FINAL OFFENDERS */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-800">Cezai İşleme Sevk Edilecek Bayiler</h4>
                </div>
                
                <div className="divide-y divide-slate-150">
                  {(activeAudit.phase2ProblematicOffices || []).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-mono">
                      Harika! Bu denetim döneminde tüm uyarılara riayet edilerek tüm uyumsuzluklar giderilmiştir. Ceza havuzu boştur.
                    </div>
                  ) : (
                    (activeAudit.phase2ProblematicOffices || []).map((id, index) => {
                      const group = groups.find(g => g.id === id);
                      const office = offices.find(o => o.id === id);
                      const name = group ? `${group.name} (Grup)` : (office ? office.name : "Kayıtlı Olmayan Ofis");
                      const owner = group ? group.ownerName : (office ? office.ownerName : "Bilinmiyor");
                      const email = group ? group.ownerEmail : (office ? office.ownerEmail : "");

                      return (
                        <div key={id} className="p-4 flex flex-wrap justify-between items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-rose-50 border border-rose-100 text-rose-700 rounded flex items-center justify-center font-bold text-xs shrink-0">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-850">{name}</div>
                              <div className="text-[11px] text-slate-500 font-medium">Sahibi: {owner} | E-posta: {email}</div>
                              <span className="font-mono text-[9px] bg-rose-100 text-rose-850 px-1.5 py-0.5 rounded mt-1 inline-block">
                                ID: {id}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  const res = await fetch("/api/audits/active/advance", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      approvedDanismanIds: [id],
                                      approvedIlanIds: [],
                                      detailsMap: {
                                        [id + "_danisman"]: "Yapılan son kontrollerde, tüm resmi ihbar ve kontrol sürelerine rağmen franchise sözleşmesine aykırı kaçak personel çalıştırma ihlalinizin devam ettiği saptanmıştır. Cezai yaptırımlar başlatılacaktır."
                                      }
                                    })
                                  });
                                  if (res.ok) {
                                    showMsg("success", "Nihai Ceza Maili Gönderildi!");
                                    onRefresh();
                                  }
                                } catch (err) {
                                  showMsg("error", "İletişim hatası.");
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Cezai Mail Gönder (Opsiyonel)
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
