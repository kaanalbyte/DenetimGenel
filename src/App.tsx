import React, { useState, useEffect } from "react";
import { Office, Group, EmailLog, AuditPeriod, AppConfig } from "./types";
import OfficeGroupManager from "./components/OfficeGroupManager";
import EmailSimulator from "./components/EmailSimulator";
import AuditPanel from "./components/AuditPanel";
import {
  ShieldAlert,
  Building2,
  Mail,
  Archive,
  BarChart3,
  TrendingUp,
  FileCheck2,
  BadgeAlert,
  UserCheck2,
  Layers,
  Sparkles,
  HelpCircle,
  Building
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [allAudits, setAllAudits] = useState<AuditPeriod[]>([]);
  const [activeAudit, setActiveAudit] = useState<AuditPeriod | null>(null);
  const [config, setConfig] = useState<AppConfig>({
    resendApiKey: "",
    brevoApiKey: "",
    senderEmail: "denetim@masterturk.com"
  });

  const [activeTab, setActiveTab] = useState<"dashboard" | "funnel" | "groups" | "emails" | "archive">("dashboard");
  const [loading, setLoading] = useState(true);

  // Consolidated Fetch/Sync Function
  const refreshData = async () => {
    try {
      const [officesRes, groupsRes, emailsRes, auditsRes, activeAuditRes, configRes] = await Promise.all([
        fetch("/api/offices"),
        fetch("/api/groups"),
        fetch("/api/emails"),
        fetch("/api/audits"),
        fetch("/api/audits/active"),
        fetch("/api/config")
      ]);

      if (officesRes.ok) setOffices(await officesRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (emailsRes.ok) setEmails(await emailsRes.json());
      if (auditsRes.ok) setAllAudits(await auditsRes.json());
      if (activeAuditRes.ok) setActiveAudit(await activeAuditRes.json());
      if (configRes.ok) setConfig(await configRes.json());
    } catch (err) {
      console.error("Error refreshing data from API:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleStartAudit = async (name: string) => {
    const res = await fetch("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      await refreshData();
      setActiveTab("funnel");
    }
  };

  const handleSaveConfig = async (newCfg: AppConfig): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCfg)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        return { success: true, message: "Ayarlar başarıyla kaydedildi!" };
      }
      const errText = await res.text().catch(() => "Detay alınamadı.");
      return { success: false, message: `Sunucu hatası (${res.status}): ${errText.substring(0, 150)}` };
    } catch (err: any) {
      console.error("Error saving config:", err);
      return { success: false, message: `Bağlantı hatası: ${err.message}` };
    }
  };

  // High Level Summary Statistics for Dashboard
  const getStats = () => {
    const totalOffices = offices.length;
    const totalGroups = groups.length;
    const totalSentMails = emails.length;
    
    // Active audit metrics
    let activePhase = "Yok";
    let pendingDanismanDiscrepancies = 0;
    let pendingIlanDiscrepancies = 0;

    if (activeAudit) {
      activePhase = activeAudit.currentPhase;
      
      const currentPhase = activeAudit.currentPhase;
      const danismanRaw = currentPhase === "Tespit" ? activeAudit.phase1DanismanRaw : activeAudit.phase2DanismanRaw;
      const ilanPanelRaw = currentPhase === "Tespit" ? activeAudit.phase1IlanPanelRaw : activeAudit.phase2IlanPanelRaw;
      const ilanSahibindenRaw = currentPhase === "Tespit" ? activeAudit.phase1IlanSahibindenRaw : activeAudit.phase2IlanSahibindenRaw;

      // Group IDs mapping
      const groupedOfficeIds = offices.filter(o => o.groupId).map(o => o.id);

      // Danisman discrepancy check
      const officesWithKaçak = new Set();
      danismanRaw.forEach(row => {
        const offId = row.ofisKodu || row["Ofis Kodu"];
        if (offId) officesWithKaçak.add(offId);
      });
      pendingDanismanDiscrepancies = officesWithKaçak.size;

      // Ilan discrepancy check
      const panelMap: { [key: string]: number } = {};
      const sahibindenMap: { [key: string]: number } = {};
      
      ilanPanelRaw.forEach(r => { panelMap[r.ofisKodu || r["Ofis Kodu"]] = Number(r.ilanSayisi || r["İlan Sayısı"] || 0); });
      ilanSahibindenRaw.forEach(r => { sahibindenMap[r.ofisKodu || r["Ofis Kodu"]] = Number(r.ilanSayisi || r["İlan Sayısı"] || 0); });

      let badIlanCount = 0;
      offices.forEach(o => {
        // Only count if not grouped or evaluate at office level for high-level raw anomalies
        const p = panelMap[o.id] || 0;
        const s = sahibindenMap[o.id] || 0;
        const diff = s - p;
        if (s <= 100) {
          if (diff > 10) badIlanCount++;
        } else {
          if (diff > p * 0.10) badIlanCount++;
        }
      });
      pendingIlanDiscrepancies = badIlanCount;
    }

    return {
      totalOffices,
      totalGroups,
      totalSentMails,
      activePhase,
      pendingDanismanDiscrepancies,
      pendingIlanDiscrepancies
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4 text-white">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/10"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
        </div>
        <p className="text-xs font-semibold text-slate-400 font-mono">Franchise Denetim Sistemi Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden" id="app-root">
      
      {/* Sidebar Navigation */}
      <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-sm">FD</div>
            <div>
              <span className="font-semibold text-white tracking-tight text-sm block">FranchiseAudit</span>
              <span className="text-[9px] text-slate-500 font-medium tracking-wider uppercase">MasterTurk</span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          <div className="text-[10px] text-slate-500 uppercase font-bold px-3 py-2 tracking-wider">Menü</div>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-all ${
              activeTab === "dashboard"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Denetim Masası
          </button>
          <button
            onClick={() => setActiveTab("funnel")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-all relative ${
              activeTab === "funnel"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            Denetim Hunisi
            {activeAudit && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-auto" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-all ${
              activeTab === "groups"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Grup & Ofis Yönetimi
          </button>
          <button
            onClick={() => setActiveTab("emails")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-all ${
              activeTab === "emails"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Mail className="w-4 h-4" />
            E-Posta Şablonları
          </button>
          <button
            onClick={() => setActiveTab("archive")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-all ${
              activeTab === "archive"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Archive className="w-4 h-4" />
            Excel Raporları / Arşiv
          </button>
        </nav>

        <div className="p-4 bg-slate-950 border-t border-slate-900 mt-auto">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider font-mono">Altyapı Durumu</div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-slate-400 font-medium">Supabase Bağlı (Free Tier)</span>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            {activeAudit ? activeAudit.name : "Ocak 2024 Denetim Dönemi"}
            {activeAudit ? (
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-blue-100">
                Aktif Dönem: {activeAudit.currentPhase} Fazı
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-slate-200">
                Beklemede
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("funnel")}
              className="text-xs font-medium text-slate-600 hover:text-slate-950 border border-slate-200 px-3 py-1.5 rounded bg-white shadow-xs transition-colors cursor-pointer"
            >
              Denetimi Başlat
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className="text-xs font-medium text-white bg-blue-600 px-3 py-1.5 rounded shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Grup Tanımla
            </button>
          </div>
        </header>

        {/* Scrollable Content Workspace */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
                id="dashboard-tab"
              >
                {/* Welcome Card */}
                <div className="bg-slate-900 rounded-lg p-6 text-white relative overflow-hidden border border-slate-950 shadow-sm">
                  <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-12 translate-y-12">
                    <ShieldAlert className="w-80 h-80" />
                  </div>
                  
                  <div className="max-w-2xl space-y-3">
                    <span className="bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider font-mono">
                      YÜKSEK YOĞUNLUKLU DENETİM MASASI
                    </span>
                    <h2 className="text-xl font-bold tracking-tight">
                      MasterTurk Bağımsız Bayi Uyum ve Konsolidasyon Portalı
                    </h2>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Sistem, kardeş ve grup ofis ilişkilerini bağımsız bayilerden süzerek, Sahibinden ve resmi Panel portföy verilerini tek çatı altında toplar ve tolerans kurallarını işleterek 3 fazlı otomatik bir huni üzerinden kontrol gerçekleştirir.
                    </p>
                    
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveTab("funnel")}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs font-semibold transition duration-150 flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        {activeAudit ? "Aktif Denetimi Yönet" : "Yeni Denetim Başlat"}
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveTab("groups")}
                        className="px-4 py-2 bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:bg-slate-700 rounded text-xs font-semibold transition duration-150 flex items-center gap-1.5 cursor-pointer"
                      >
                        Ofis Gruplarını Tanımla
                        <Building2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Analytical Widgets Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Stat 1: Registered Bayis */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center shrink-0 border border-slate-200">
                      <Building className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kayıtlı Ofis</div>
                      <div className="text-xl font-extrabold text-slate-800 mt-0.5">{stats.totalOffices}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{stats.totalGroups} Ortak Grup</div>
                    </div>
                  </div>

                  {/* Stat 2: Active Audit Phase */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center shrink-0 border border-blue-100">
                      <Layers className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aktif Aşama</div>
                      <div className="text-xs font-bold text-blue-700 mt-1 uppercase">
                        {activeAudit ? `${activeAudit.currentPhase} Fazı` : "Aktif Dönem Yok"}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">
                        {activeAudit ? activeAudit.name : "Başlatılmadı"}
                      </div>
                    </div>
                  </div>

                  {/* Stat 3: Total Flagged Advisors */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded flex items-center justify-center shrink-0 border border-red-100">
                      <BadgeAlert className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kaçak Danışman</div>
                      <div className="text-xl font-extrabold text-red-700 mt-0.5">
                        {activeAudit ? stats.pendingDanismanDiscrepancies : 0} Ofis
                      </div>
                      <div className="text-[10px] text-slate-500">Yetkisiz personel</div>
                    </div>
                  </div>

                  {/* Stat 4: Out of Tolerance Portfolios */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center shrink-0 border border-blue-100">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uyumsuz İlan</div>
                      <div className="text-xl font-extrabold text-blue-700 mt-0.5">
                        {activeAudit ? stats.pendingIlanDiscrepancies : 0} Ofis
                      </div>
                      <div className="text-[10px] text-slate-500">Limiti aşanlar</div>
                    </div>
                  </div>

                </div>

                {/* Informative Grid of Rules */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Tolerance and System Guide */}
                  <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm space-y-4 text-left">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <FileCheck2 className="w-4 h-4 text-blue-600" />
                      Uyum Limitleri ve Tolerans Algoritmaları
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Sistem ilan portföy farklarını hesaplarken, Sahibinden portalındaki toplam ilan adedine göre iki farklı tolerans süzgeci işletir:
                    </p>
                    
                    <div className="space-y-3 pt-1">
                      <div className="p-3 bg-slate-50 rounded border border-slate-100 flex items-start gap-3">
                        <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mt-0.5">KURAL 1</span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Portföy Sayısı ≤ 100 İlan İse:</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">En fazla 10 ilan farkı tolerans gösterilir. Fark &gt; 10 ise otomatik tespit fazına sevk edilir.</p>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded border border-slate-100 flex items-start gap-3">
                        <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mt-0.5">KURAL 2</span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Portföy Sayısı &gt; 100 İlan İse:</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">En fazla %10 fazla ilan tolerans verilir. Fark &gt; Panel İlan Sayısı * 0.10 ise uyumsuz sayılır.</p>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/50 rounded border border-blue-100/50 flex items-start gap-3">
                        <span className="text-[10px] font-mono font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded mt-0.5">KONSOLİDE</span>
                        <div>
                          <h4 className="text-xs font-bold text-blue-950">Grup Ofis Konsolidasyonu:</h4>
                          <p className="text-[11px] text-blue-800 mt-0.5">Kardeş ofislerin Sahibinden ve Panel toplamları birleştirilerek tek bir büyük bayi gibi değerlendirilir.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Activity Overview */}
                  <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm space-y-4 text-left flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <UserCheck2 className="w-4 h-4 text-blue-600" />
                        Aktif Denetim Döneminin Huni Akışı
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Her denetim dönemi aşamalı olarak ilerler. Aşağıdaki adımları sırayla takip ederek süreci tamamlayabilirsiniz:
                      </p>

                      <div className="space-y-3 mt-4 text-xs">
                        <div className="flex items-start gap-2.5">
                          <div className="w-4 h-4 bg-slate-100 text-slate-800 font-bold text-[9px] rounded-full flex items-center justify-center shrink-0 mt-0.5">1</div>
                          <span className="text-slate-600"><strong className="text-slate-800">Tespit Fazı:</strong> Veriler içeri aktarılır, uyuşmayanlara 1. Aşama Maili atılır.</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <div className="w-4 h-4 bg-blue-50 text-blue-800 font-bold text-[9px] rounded-full flex items-center justify-center shrink-0 mt-0.5">2</div>
                          <span className="text-slate-600"><strong className="text-slate-800">Kontrol Fazı:</strong> Sadece ilk aşamada uyarılmış ofisler güncel yüklemeyle taranır, düzeltmeyenlere 2. Aşama Maili atılır.</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <div className="w-4 h-4 bg-red-50 text-red-800 font-bold text-[9px] rounded-full flex items-center justify-center shrink-0 mt-0.5">3</div>
                          <span className="text-slate-600"><strong className="text-slate-800">Ceza Fazı:</strong> Hâlâ düzeltme yapmamış kemikleşmiş bayiler ceza havuzuna sevk edilerek ceza faturası/yaptırım maili hazırlanır.</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setActiveTab("funnel")}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition duration-150 cursor-pointer"
                      >
                        Denetim Paneline Geç
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {activeTab === "funnel" && (
              <motion.div
                key="funnel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <AuditPanel
                  offices={offices}
                  groups={groups}
                  activeAudit={activeAudit}
                  onRefresh={refreshData}
                  onStartAudit={handleStartAudit}
                />
              </motion.div>
            )}

            {activeTab === "groups" && (
              <motion.div
                key="groups"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <OfficeGroupManager
                  offices={offices}
                  groups={groups}
                  onRefresh={refreshData}
                />
              </motion.div>
            )}

            {activeTab === "emails" && (
              <motion.div
                key="emails"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <EmailSimulator
                  emails={emails}
                  config={config}
                  onSaveConfig={handleSaveConfig}
                  onRefresh={refreshData}
                />
              </motion.div>
            )}

            {activeTab === "archive" && (
              <motion.div
                key="archive"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
                id="archive-tab"
              >
                {/* Completed Audits Archive */}
                <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Archive className="w-4 h-4 text-blue-600" />
                    Kapatılmış Geçmiş Denetim Dönemleri
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Arşivlenmiş denetim süreçleri ve nihai durumları aşağıda listelenmektedir.
                  </p>

                  <div className="divide-y divide-slate-100 mt-4">
                    {allAudits.filter(a => a.status === "Tamamlandı").length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-mono">
                        Tamamlanmış veya kapatılmış herhangi bir denetim dönemi bulunmuyor.
                      </div>
                    ) : (
                      allAudits.filter(a => a.status === "Tamamlandı").map((audit) => (
                        <div key={audit.id} className="py-3 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-xs text-slate-800">{audit.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Oluşturulma: {new Date(audit.createdAt).toLocaleDateString("tr-TR")} | Son Güncelleme: {new Date(audit.updatedAt).toLocaleDateString("tr-TR")}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full uppercase">
                            KAPATILDI / TAMAMLANDI
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Activity Bar */}
        <footer className="h-10 bg-slate-100 border-t border-slate-200 flex items-center px-6 justify-between text-[10px] text-slate-500 shrink-0 font-mono">
           <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                Sistem Hazır
              </span>
              <span>Deploy Sürümü: <strong>v1.4.2-stable</strong></span>
           </div>
           <div className="flex items-center gap-4">
              <span>Sunucu Süresi: 14ms</span>
              <span>Excel Parser: JS-XLSX</span>
           </div>
        </footer>

      </main>
    </div>
  );
}
