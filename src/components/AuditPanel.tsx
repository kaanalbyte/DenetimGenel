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

function getBrandFromRow(row: any): string | null {
  const officeName = getNormalizedValue(row, ["ofisadi", "ofis adi", "name", "office name", "ad", "unvan"]).trim();
  if (!officeName) return null;
  const upperName = officeName.toUpperCase();
  if (upperName.startsWith("CB")) {
    return "Coldwell Banker";
  }
  if (upperName.startsWith("C21")) {
    return "Century 21";
  }
  if (upperName.startsWith("ERA")) {
    return "ERA";
  }
  return null;
}

function brandsMatch(b1: string, b2: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
  return norm(b1) === norm(b2);
}

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
    const kacakDanismanRaw = (currentPhase === "Tespit" ? activeAudit.phase1KacakDanismanRaw : activeAudit.phase2KacakDanismanRaw) || [];

    // Determine target entities:
    // If in Phase 2 (Kontrol), we ONLY evaluate entities that were problematic in Phase 1 (activeAudit.phase1ProblematicOffices)
    const isPhase2 = currentPhase === "Kontrol";
    const phase1Problematic = activeAudit.phase1ProblematicOffices || [];

    // --- 1. DANİŞMAN DENETİMİ RAPORU HESAPLAMA ---
    const danismanMap: { 
      [entityId: string]: { 
        code: string; 
        name: string; 
        ownerName: string; 
        countOwner: number; 
        countBroker: number; 
        countDanisman: number; 
        countOfficialTotal: number; 
        countKacak: number; 
        names: string[]; 
        status: "Sorunlu" | "Uyumlu" 
      } 
    } = {};

    // Initialize map with all offices/groups
    const initializeDanismanMap = (id: string, name: string, ownerName: string) => {
      if (!danismanMap[id]) {
        danismanMap[id] = {
          code: id,
          name,
          ownerName,
          countOwner: 0,
          countBroker: 0,
          countDanisman: 0,
          countOfficialTotal: 0,
          countKacak: 0,
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
        if (group) initializeDanismanMap(group.id, `${group.name} (Grup)`, group.ownerName);
      } else {
        initializeDanismanMap(o.id, o.name, o.ownerName);
      }
    });

    // Populate official panel advisor numbers from danismanRaw (Kullanıcı Raporu)
    danismanRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const office = offices.find(o => o.id === officeId);
      if (!office) return;

      const entityId = office.groupId || office.id;
      if (isPhase2 && !phase1Problematic.includes(entityId)) return;

      const entity = danismanMap[entityId];
      if (entity) {
        const ownerVal = Number(getNormalizedValue(row, ["owner", "sahip", "ofissahibi"]) || 0);
        const brokerVal = Number(getNormalizedValue(row, ["broker"]) || 0);
        const danismanVal = Number(getNormalizedValue(row, ["danisman", "danismanlar", "danismantoplami", "advisor", "agent"]) || 0);

        entity.countOwner += ownerVal;
        entity.countBroker += brokerVal;
        entity.countDanisman += danismanVal;
        entity.countOfficialTotal += (ownerVal + brokerVal + danismanVal);
      }
    });

    // Populate Kaçak Danışman from kacakDanismanRaw (Kaçak Sahibinden Raporu)
    kacakDanismanRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const rowBrand = getBrandFromRow(row);
      let office = offices.find(o => o.id === officeId && (rowBrand ? brandsMatch(o.brand || "", rowBrand) : true));
      if (!office) {
        office = offices.find(o => o.id === officeId);
      }
      if (!office) return;

      const entityId = office.groupId || office.id;
      if (isPhase2 && !phase1Problematic.includes(entityId)) return;

      const entity = danismanMap[entityId];
      if (entity) {
        const name = getNormalizedValue(row, ["danismanadi", "danisman adi", "danisman adisoyadi", "danisman adi soyadi", "adsoyad", "ad soyad", "danismanadisoyadi", "danismanadisoyadi"]) || "Bilinmeyen Danışman";
        const portfolio = Number(getNormalizedValue(row, ["portfoysayisi", "portfoy", "ilansayisi", "ilan sayisi"]) || 1);
        
        const displayLabel = `${name} (${portfolio} Portföy)`;
        if (name && !entity.names.includes(displayLabel)) {
          entity.names.push(displayLabel);
          entity.countKacak += 1;
          entity.status = "Sorunlu";
        }
      }
    });

    const danismanArr = Object.values(danismanMap);
    setDanismanReport(danismanArr);

    // --- 2. İLAN DENETİMİ RAPORU HESAPLAMA ---
    const ilanMap: { 
      [entityId: string]: { 
        code: string; 
        name: string; 
        ownerName: string; 
        countSatilik: number; 
        countKiralik: number; 
        countPanelTotal: number; 
        countSahibinden: number; 
        difference: number; 
        status: "Sorunlu" | "Uyumlu" 
      } 
    } = {};

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
            countSatilik: 0,
            countKiralik: 0,
            countPanelTotal: 0,
            countSahibinden: 0,
            difference: 0,
            status: "Uyumlu"
          };
        } else {
          ilanMap[targetId] = {
            code: targetId,
            name: o.name,
            ownerName: o.ownerName,
            countSatilik: 0,
            countKiralik: 0,
            countPanelTotal: 0,
            countSahibinden: 0,
            difference: 0,
            status: "Uyumlu"
          };
        }
      }
    });

    // Populate Panel Counts (Satılık, Kiralık)
    ilanPanelRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const office = offices.find(o => o.id === officeId);
      if (!office) return;

      const targetId = office.groupId || office.id;
      if (ilanMap[targetId]) {
        const satilik = Number(getNormalizedValue(row, ["satilik", "satılık", "sale"]) || 0);
        const kiralik = Number(getNormalizedValue(row, ["kiralik", "kiralık", "rent"]) || 0);
        
        ilanMap[targetId].countSatilik += satilik;
        ilanMap[targetId].countKiralik += kiralik;
        ilanMap[targetId].countPanelTotal += (satilik + kiralik);
      }
    });

    // Populate Sahibinden Counts (Consolidated Portföy Sayısı)
    ilanSahibindenRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const rowBrand = getBrandFromRow(row);
      let office = offices.find(o => o.id === officeId && (rowBrand ? brandsMatch(o.brand || "", rowBrand) : true));
      if (!office) {
        office = offices.find(o => o.id === officeId);
      }
      if (!office) return;

      const targetId = office.groupId || office.id;
      if (ilanMap[targetId]) {
        const portfoy = Number(getNormalizedValue(row, ["portfoysayisi", "portfoy", "ilansayisi", "ilan sayisi"]) || 0);
        ilanMap[targetId].countSahibinden += portfoy;
      }
    });

    // Apply tolerances rules to consolidated totals
    Object.keys(ilanMap).forEach(key => {
      const item = ilanMap[key];
      const s = item.countSahibinden;
      const p = item.countPanelTotal;
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

  const handleRealDataLoad = async (type: string, data: any[], secondaryData?: any[]) => {
    if (!activeAudit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, secondaryData })
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
    let kacakDanismanMock: any[] = [];

    // Map to actual office codes in db.json (OF10605, OF10610, OF10611, OF10612, OF10615, OF10620, OF10621, OF10630, OF10631, OF10632)
    danismanMock = [
      { "Ofis Kodu": "OF10605", "Owner": 1, "Broker": 1, "Danışman": 12, "_sourceFile": "cb_akullanici.xlsx" },
      { "Ofis Kodu": "OF10610", "Owner": 1, "Broker": 0, "Danışman": 5, "_sourceFile": "cb_akullanici.xlsx" },
      { "Ofis Kodu": "OF10611", "Owner": 1, "Broker": 1, "Danışman": 8, "_sourceFile": "cb_akullanici.xlsx" },
      { "Ofis Kodu": "OF10612", "Owner": 1, "Broker": 1, "Danışman": 4, "_sourceFile": "cb_akullanici.xlsx" },
      
      { "Ofis Kodu": "OF10615", "Owner": 1, "Broker": 1, "Danışman": 15, "_sourceFile": "c21_akullanici.xlsx" },
      { "Ofis Kodu": "OF10620", "Owner": 1, "Broker": 0, "Danışman": 6, "_sourceFile": "c21_akullanici.xlsx" },
      { "Ofis Kodu": "OF10621", "Owner": 1, "Broker": 1, "Danışman": 7, "_sourceFile": "c21_akullanici.xlsx" },
      
      { "Ofis Kodu": "OF10630", "Owner": 1, "Broker": 1, "Danışman": 5, "_sourceFile": "era_akullanici.xlsx" },
      { "Ofis Kodu": "OF10631", "Owner": 1, "Broker": 0, "Danışman": 8, "_sourceFile": "era_akullanici.xlsx" },
      { "Ofis Kodu": "OF10632", "Owner": 1, "Broker": 1, "Danışman": 9, "_sourceFile": "era_akullanici.xlsx" }
    ];

    panelIlanMock = [
      { "Ofis Kodu": "OF10605", "Satılık": 45, "Kiralık": 25, "_sourceFile": "cb_ilan.xlsx" },
      { "Ofis Kodu": "OF10610", "Satılık": 20, "Kiralık": 10, "_sourceFile": "cb_ilan.xlsx" },
      { "Ofis Kodu": "OF10611", "Satılık": 35, "Kiralık": 15, "_sourceFile": "cb_ilan.xlsx" },
      { "Ofis Kodu": "OF10612", "Satılık": 40, "Kiralık": 10, "_sourceFile": "cb_ilan.xlsx" },
      
      { "Ofis Kodu": "OF10615", "Satılık": 38, "Kiralık": 15, "_sourceFile": "c21_ilan.xlsx" },
      { "Ofis Kodu": "OF10620", "Satılık": 12, "Kiralık": 8, "_sourceFile": "c21_ilan.xlsx" },
      { "Ofis Kodu": "OF10621", "Satılık": 22, "Kiralık": 12, "_sourceFile": "c21_ilan.xlsx" },
      
      { "Ofis Kodu": "OF10630", "Satılık": 24, "Kiralık": 8, "_sourceFile": "era_ilan.xlsx" },
      { "Ofis Kodu": "OF10631", "Satılık": 28, "Kiralık": 18, "_sourceFile": "era_ilan.xlsx" },
      { "Ofis Kodu": "OF10632", "Satılık": 18, "Kiralık": 12, "_sourceFile": "era_ilan.xlsx" }
    ];

    sahibindenIlanMock = [
      { "Ofis Kodu": "OF10605", "Portföy Sayısı": 98, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10610", "Portföy Sayısı": 32, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10611", "Portföy Sayısı": 62, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10612", "Portföy Sayısı": 52, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      
      { "Ofis Kodu": "OF10615", "Portföy Sayısı": 78, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10620", "Portföy Sayısı": 30, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10621", "Portföy Sayısı": 50, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      
      { "Ofis Kodu": "OF10630", "Portföy Sayısı": 44, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10631", "Portföy Sayısı": 68, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10632", "Portföy Sayısı": 30, "_sourceFile": "platform_icerik_ozetleri.xlsx" }
    ];

    kacakDanismanMock = [
      { "Ofis Kodu": "OF10605", "Danışman Adı Soyadı": "Kaan Arslan", "Portföy Sayısı": 2, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10605", "Danışman Adı Soyadı": "Zeynep Tekin", "Portföy Sayısı": 1, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10611", "Danışman Adı Soyadı": "Mert Demir", "Portföy Sayısı": 1, "_sourceFile": "platform_icerik_ozetleri.xlsx" },
      { "Ofis Kodu": "OF10631", "Danışman Adı Soyadı": "Selin Bakır", "Portföy Sayısı": 3, "_sourceFile": "platform_icerik_ozetleri.xlsx" }
    ];

    try {
      await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "danisman", data: danismanMock })
      });
      await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ilan_panel", data: panelIlanMock })
      });
      const res = await fetch("/api/audits/active/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ilan_sahibinden", data: sahibindenIlanMock, secondaryData: kacakDanismanMock })
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

  const getUploadDetails = () => {
    if (!activeAudit) return {
      cbDanisman: { uploaded: false, count: 0 },
      c21Danisman: { uploaded: false, count: 0 },
      eraDanisman: { uploaded: false, count: 0 },
      cbIlan: { uploaded: false, count: 0 },
      c21Ilan: { uploaded: false, count: 0 },
      eraIlan: { uploaded: false, count: 0 },
      sahibinden: { uploaded: false, count: 0 },
      kacak: { uploaded: false, count: 0 },
      uploadedFiles: [],
      hasAnyData: false
    };

    const currentPhase = activeAudit.currentPhase || "Tespit";
    const danismanRaw = (currentPhase === "Tespit" ? activeAudit.phase1DanismanRaw : activeAudit.phase2DanismanRaw) || [];
    const ilanPanelRaw = (currentPhase === "Tespit" ? activeAudit.phase1IlanPanelRaw : activeAudit.phase2IlanPanelRaw) || [];
    const ilanSahibindenRaw = (currentPhase === "Tespit" ? activeAudit.phase1IlanSahibindenRaw : activeAudit.phase2IlanSahibindenRaw) || [];
    const kacakDanismanRaw = (currentPhase === "Tespit" ? activeAudit.phase1KacakDanismanRaw : activeAudit.phase2KacakDanismanRaw) || [];

    const getOfficeBrand = (id: string) => {
      const office = offices.find(o => o.id === id);
      return office?.brand || null;
    };

    let cbDanismanCount = 0;
    let c21DanismanCount = 0;
    let eraDanismanCount = 0;

    let cbIlanCount = 0;
    let c21IlanCount = 0;
    let eraIlanCount = 0;

    let sahibindenCount = ilanSahibindenRaw.length;
    let kacakCount = kacakDanismanRaw.length;

    danismanRaw.forEach(r => {
      const id = getNormalizedValue(r, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      const brand = getOfficeBrand(id);
      if (brand === "Coldwell Banker") cbDanismanCount++;
      else if (brand === "Century 21") c21DanismanCount++;
      else if (brand === "ERA") eraDanismanCount++;
      else {
        const src = String(r._sourceFile || "").toLowerCase();
        if (src.includes("cb")) cbDanismanCount++;
        else if (src.includes("c21") || src.includes("century")) c21DanismanCount++;
        else if (src.includes("era")) eraDanismanCount++;
      }
    });

    ilanPanelRaw.forEach(r => {
      const id = getNormalizedValue(r, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      const brand = getOfficeBrand(id);
      if (brand === "Coldwell Banker") cbIlanCount++;
      else if (brand === "Century 21") c21IlanCount++;
      else if (brand === "ERA") eraIlanCount++;
      else {
        const src = String(r._sourceFile || "").toLowerCase();
        if (src.includes("cb")) cbIlanCount++;
        else if (src.includes("c21") || src.includes("century")) c21IlanCount++;
        else if (src.includes("era")) eraIlanCount++;
      }
    });

    const uploadedFilesSet = new Set<string>();
    const addFile = (rows: any[]) => {
      if (Array.isArray(rows)) {
        rows.forEach(r => {
          if (r._sourceFile) uploadedFilesSet.add(r._sourceFile);
        });
      }
    };
    addFile(danismanRaw);
    addFile(ilanPanelRaw);
    addFile(ilanSahibindenRaw);
    addFile(kacakDanismanRaw);
    const uploadedFiles = Array.from(uploadedFilesSet);

    return {
      cbDanisman: { uploaded: cbDanismanCount > 0, count: cbDanismanCount },
      c21Danisman: { uploaded: c21DanismanCount > 0, count: c21DanismanCount },
      eraDanisman: { uploaded: eraDanismanCount > 0, count: eraDanismanCount },
      cbIlan: { uploaded: cbIlanCount > 0, count: cbIlanCount },
      c21Ilan: { uploaded: c21IlanCount > 0, count: c21IlanCount },
      eraIlan: { uploaded: eraIlanCount > 0, count: eraIlanCount },
      sahibinden: { uploaded: sahibindenCount > 0, count: sahibindenCount },
      kacak: { uploaded: kacakCount > 0, count: kacakCount },
      uploadedFiles,
      hasAnyData: danismanRaw.length > 0 || ilanPanelRaw.length > 0 || ilanSahibindenRaw.length > 0
    };
  };

  const handleResetData = async () => {
    if (!activeAudit) return;
    if (!window.confirm("Bu döneme ait yüklenmiş tüm Excel verilerini silmek ve baştan başlamak istediğinize emin misiniz?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/audits/active/reset", {
        method: "POST"
      });
      if (res.ok) {
        showMsg("success", "Yüklenen tüm veriler sıfırlandı!");
        onRefresh();
      } else {
        showMsg("error", "Veriler sıfırlanamadı.");
      }
    } catch (err) {
      showMsg("error", "Sunucuya bağlanılamadı.");
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
        detailsMap[item.code + "_danisman"] = `Portallerde yapılan eşleştirmelerde, ofisiniz bünyesinde çalışan ancak resmi panelde kaydı bulunmayan yetkisiz (kaçak) danışmanlar tespit edilmiştir:\n\nKaçak Danışman Listesi: ${item.names.join(", ")}\n\nResmi Kadro Sayısı: ${item.countOfficialTotal} (Owner: ${item.countOwner}, Broker: ${item.countBroker}, Danışman: ${item.countDanisman})`;
      }
    });

    ilanReport.forEach(item => {
      if (selectedIlanIds.includes(item.code)) {
        const thresholdText = item.countSahibinden <= 100 
          ? "Sahibinden ilan sayısı <= 100 olduğu için en fazla 10 adet ilan farkı toleransı mevcuttur." 
          : `Sahibinden ilan sayısı > 100 olduğu için en fazla %10 fazla ilan toleransı mevcuttur (Limit: ${Math.floor(item.countPanelTotal * 0.10)} ilan).`;

        detailsMap[item.code + "_ilan"] = `Yapılan ilan denetimlerinde, resmi paneliniz ile Sahibinden.com portalındaki ilan adetlerinizin uyumsuz olduğu tespit edilmiştir.\n\nSahibinden Toplam İlan Sayısı: ${item.countSahibinden}\nPanel Toplam İlan Sayısı: ${item.countPanelTotal} (Satılık: ${item.countSatilik}, Kiralık: ${item.countKiralik})\nFark: +${item.difference}\n\nAçıklama: ${thresholdText}`;
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
              
              {/* BRAND-BY-BRAND AUDIT DASHBOARD */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-mono">Dönem Veri Entegrasyonu</span>
                    <h3 className="text-xs font-bold text-slate-800">Ofis ve Marka Bazlı Veri Takip Paneli</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleLoadMockData}
                      disabled={loading}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold py-1.5 px-3 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Örnek Veri Seti Yükle
                    </button>
                    {getUploadDetails().hasAnyData && (
                      <button
                        onClick={handleResetData}
                        disabled={loading}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-bold py-1.5 px-3 transition flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Verileri Temizle
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 1. Resmi Kadro Card */}
                  <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-150 space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded flex items-center justify-center font-bold text-xs shrink-0">📋</div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">1. Resmi Kadro</h4>
                        <p className="text-[9px] text-slate-400 font-mono">Kullanıcı Raporu (akullanici)</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {/* CB */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          Coldwell Banker
                        </span>
                        {getUploadDetails().cbDanisman.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().cbDanisman.count} Satır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>

                      {/* C21 */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          Century 21
                        </span>
                        {getUploadDetails().c21Danisman.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().c21Danisman.count} Satır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>

                      {/* ERA */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                          ERA
                        </span>
                        {getUploadDetails().eraDanisman.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().eraDanisman.count} Satır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. Resmi Portföy Card */}
                  <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-150 space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded flex items-center justify-center font-bold text-xs shrink-0">🏡</div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">2. Resmi Portföy</h4>
                        <p className="text-[9px] text-slate-400 font-mono">İlan Raporu (ilan)</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* CB */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          Coldwell Banker
                        </span>
                        {getUploadDetails().cbIlan.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().cbIlan.count} Satır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>

                      {/* C21 */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          Century 21
                        </span>
                        {getUploadDetails().c21Ilan.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().c21Ilan.count} Satır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>

                      {/* ERA */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                          ERA
                        </span>
                        {getUploadDetails().eraIlan.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().eraIlan.count} Satır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Portal Verileri Card */}
                  <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-150 space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="w-6 h-6 bg-amber-100 text-amber-700 rounded flex items-center justify-center font-bold text-xs shrink-0">🌐</div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">3. Portal Raporu</h4>
                        <p className="text-[9px] text-slate-400 font-mono">Sahibinden Çift Sayfalı</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Sahibinden İlanlar */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                          Sahibinden_Danismanlar
                        </span>
                        {getUploadDetails().sahibinden.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().sahibinden.count} Satır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>

                      {/* Kaçak Danışmanlar */}
                      <div className="flex items-center justify-between text-xs p-1.5 bg-white rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          Kacak_Sahibinden
                        </span>
                        {getUploadDetails().kacak.uploaded ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ✓ {getUploadDetails().kacak.count} Danışman
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Bekleniyor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* YÜKLENEN DOSYA LİSTESİ */}
                {getUploadDetails().uploadedFiles.length > 0 && (
                  <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-150 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Sistemde Aktif Dosyalar:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {getUploadDetails().uploadedFiles.map((file, idx) => (
                        <span key={idx} className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* UPLOADER TRIGGER BOX */}
              <ExcelUploader 
                onDataLoaded={handleRealDataLoad} 
                isLoading={loading} 
                title="Yeni Dosya Sürükleyin veya Seçin (Otomatik Kategori Algılama)"
                fileTypes={[
                  { id: "danisman", label: "📋 Kullanıcı Raporu (Resmi Kadro)" },
                  { id: "ilan_panel", label: "🏡 İlan Raporu (Resmi Portföy)" },
                  { id: "ilan_sahibinden", label: "🌐 Sahibinden İlan & Kaçak Danışman (Çift Sayfalı)" }
                ]}
                hints={
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-500 text-[11px] pt-2 border-t border-slate-100 mt-2">
                    <div>
                      <h5 className="font-bold text-slate-700 mb-0.5">📋 Resmi Kadro Dosyası</h5>
                      <p>Örnek dosya adı: <code className="font-mono bg-slate-100 px-1 text-slate-800 rounded">cb_akullanici.xlsx</code>, <code className="font-mono bg-slate-100 px-1 text-slate-800 rounded">c21_akullanici</code></p>
                      <span className="block mt-1 text-[10px] text-slate-400">Kolonlar: Ofis Kodu, Owner, Broker, Danışman</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-700 mb-0.5">🏡 Resmi Portföy Dosyası</h5>
                      <p>Örnek dosya adı: <code className="font-mono bg-slate-100 px-1 text-slate-800 rounded">cb_ilan.xlsx</code>, <code className="font-mono bg-slate-100 px-1 text-slate-800 rounded">era_ilan</code></p>
                      <span className="block mt-1 text-[10px] text-slate-400">Kolonlar: Ofis Kodu, Satılık, Kiralık</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-700 mb-0.5">🌐 Sahibinden Portal</h5>
                      <p>Dosya adı: <code className="font-mono bg-slate-100 px-1 text-slate-800 rounded">platform_icerik_ozetleri.xlsx</code></p>
                      <span className="block mt-1 text-[10px] text-slate-400">Çift sayfa: 1. Sahibinden_Danismanlar, 2. Kacak_Sahibinden</span>
                    </div>
                  </div>
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
                            Danışman Denetimi (Kaçak Danışman Tespiti)
                          </h3>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 w-10">Seç</th>
                              <th className="px-3 py-2">Ofis/Grup Kodu & Adı</th>
                              <th className="px-3 py-2 text-center">Resmi Kadro (Panel)</th>
                              <th className="px-3 py-2">Durumu</th>
                              <th className="px-3 py-2">Kaçak Danışmanlar (Portföylü)</th>
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
                                  <td className="px-3 py-2 text-center">
                                    <div className="font-mono text-xs text-slate-700 font-semibold">
                                      Toplam: {item.countOfficialTotal}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-mono">
                                      Owner: {item.countOwner} | Broker: {item.countBroker} | Dan: {item.countDanisman}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                                      item.status === "Sorunlu" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                                    }`}>
                                      {item.status === "Sorunlu" ? `${item.countKacak} KAÇAK VAR` : "UYUMLU"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-rose-700 font-medium">
                                    {item.names.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {item.names.map((n: string, i: number) => (
                                          <span key={i} className="bg-rose-50 border border-rose-100 text-[10px] px-1.5 py-0.5 rounded text-rose-800 font-mono">
                                            {n}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-mono text-[11px]">-</span>
                                    )}
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
                              <th className="px-3 py-2 text-center">Resmi Panel (Portföy)</th>
                              <th className="px-3 py-2 text-center">Sahibinden</th>
                              <th className="px-3 py-2 text-center">Fark</th>
                              <th className="px-3 py-2">Durumu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ilanReport.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-slate-400">Uyumsuz ilan sayısı tespiti bulunmuyor.</td>
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
                                  <td className="px-3 py-2 text-center">
                                    <div className="font-mono text-xs text-slate-700 font-semibold">
                                      Toplam: {item.countPanelTotal}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-mono">
                                      Satılık: {item.countSatilik} | Kiralık: {item.countKiralik}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono font-bold text-slate-800 text-xs">
                                    {item.countSahibinden}
                                  </td>
                                  <td className="px-3 py-2 text-center font-semibold font-mono text-xs">
                                    <span className={item.difference > 0 ? "text-rose-600" : "text-emerald-600"}>
                                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                                      item.status === "Sorunlu" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                                    }`}>
                                      {item.status === "Sorunlu" ? "LİMİT AŞILDI" : "UYUMLU"}
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
