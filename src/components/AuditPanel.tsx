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

function getBrandFromRow(row: any, officesList?: any[]): string | null {
  const officeName = getNormalizedValue(row, ["ofisadi", "ofis adi", "name", "office name", "ad", "unvan", "ofis"]).trim();
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
  
  // Also check _sourceFile
  const src = String(row._sourceFile || "").toLowerCase();
  if (src.includes("cb")) return "Coldwell Banker";
  if (src.includes("c21") || src.includes("century")) return "Century 21";
  if (src.includes("era")) return "ERA";
  
  // Fallback database lookup
  if (officesList) {
    const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
    if (officeId) {
      const office = officesList.find(o => o.id === officeId && o.status !== "Silinmiş") || officesList.find(o => o.id === officeId);
      if (office?.brand) return office.brand;
    }
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

  // Diagnostics Panel states
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticSearch, setDiagnosticSearch] = useState("");
  const [diagnosticBrand, setDiagnosticBrand] = useState("all");

  // Filters & Sorting for Table A (Danışman Denetimi)
  const [danismanSearch, setDanismanSearch] = useState("");
  const [danismanBrand, setDanismanBrand] = useState("all");
  const [danismanStatus, setDanismanStatus] = useState("all");
  const [danismanSort, setDanismanSort] = useState("name_asc");

  // Filters & Sorting for Table B (İlan Denetimi)
  const [ilanSearch, setIlanSearch] = useState("");
  const [ilanBrand, setIlanBrand] = useState("all");
  const [ilanStatus, setIlanStatus] = useState("all");
  const [ilanSort, setIlanSort] = useState("name_asc");

  // Helper function to resolve brand of a group or office code
  const getEntityBrand = (code: string) => {
    const office = offices.find(o => o.id === code);
    if (office?.brand) return office.brand;
    const groupOffice = offices.find(o => o.groupId === code);
    if (groupOffice?.brand) return groupOffice.brand;
    const nameUpper = String(code).toUpperCase() + " " + String(offices.find(o => o.id === code)?.name || "").toUpperCase();
    if (nameUpper.includes("CB") || nameUpper.includes("COLDWELL")) return "Coldwell Banker";
    if (nameUpper.includes("C21") || nameUpper.includes("CENTURY")) return "Century 21";
    if (nameUpper.includes("ERA")) return "ERA";
    return "";
  };

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
        entityId: string;
        code: string; 
        name: string; 
        ownerName: string; 
        countOwner: number; 
        countBroker: number; 
        countDanisman: number; 
        countOfficialTotal: number; 
        countKacak: number; 
        sumKacakPortfolio: number;
        names: string[]; 
        status: "Sorunlu" | "Uyumlu";
        isGroup?: boolean;
        subOffices?: {
          code: string;
          name: string;
          countOwner: number;
          countBroker: number;
          countDanisman: number;
          countOfficialTotal: number;
          countKacak: number;
          sumKacakPortfolio: number;
          names: string[];
        }[];
      } 
    } = {};

    // Initialize map with all offices/groups
    const initializeDanismanMap = (entityKey: string, code: string, name: string, ownerName: string, isGroup?: boolean) => {
      if (!danismanMap[entityKey]) {
        danismanMap[entityKey] = {
          entityId: entityKey,
          code,
          name,
          ownerName,
          countOwner: 0,
          countBroker: 0,
          countDanisman: 0,
          countOfficialTotal: 0,
          countKacak: 0,
          sumKacakPortfolio: 0,
          names: [],
          status: "Uyumlu",
          isGroup,
          subOffices: isGroup ? [] : undefined
        };
      }
    };

    const getEntityKey = (o: any) => o.groupId || `${o.id}:::${o.name}`;

    const findCorrectOffice = (officeId: string, rowBrand: string | null, row: any) => {
      let office = offices.find(o => o.id === officeId && (rowBrand ? brandsMatch(o.brand || "", rowBrand) : true) && o.status !== "Silinmiş");
      if (office) return office;
      
      office = offices.find(o => o.id === officeId && (rowBrand ? brandsMatch(o.brand || "", rowBrand) : true));
      if (office) return office;

      const rowOfficeName = getNormalizedValue(row, ["ofisadi", "ofis adi", "name", "office name", "ad", "unvan", "ofis"]);
      if (rowOfficeName) {
        const upName = rowOfficeName.toUpperCase().trim();
        office = offices.find(o => o.name.toUpperCase().trim() === upName && o.status !== "Silinmiş");
        if (office) return office;
        office = offices.find(o => o.name.toUpperCase().trim() === upName);
        if (office) return office;
        
        office = offices.find(o => o.status !== "Silinmiş" && (o.name.toUpperCase().includes(upName) || upName.includes(o.name.toUpperCase())));
        if (office) return office;
        
        office = offices.find(o => (o.name.toUpperCase().includes(upName) || upName.includes(o.name.toUpperCase())));
        if (office) return office;
      }

      office = offices.find(o => o.id === officeId && o.status !== "Silinmiş");
      if (office) return office;
      
      return offices.find(o => o.id === officeId);
    };

    // Populate offices and groups
    offices.forEach(o => {
      const eKey = getEntityKey(o);
      if (isPhase2 && !phase1Problematic.includes(eKey)) return; // Only problematic ones in Phase 2
      
      if (o.groupId) {
        const group = groups.find(g => g.id === o.groupId);
        if (group) {
          initializeDanismanMap(group.id, group.id, `${group.name} (Grup)`, group.ownerName, true);
          const gEnt = danismanMap[group.id];
          if (gEnt && gEnt.subOffices && !gEnt.subOffices.find(s => s.code === o.id)) {
            gEnt.subOffices.push({
              code: o.id, name: o.name, countOwner: 0, countBroker: 0, countDanisman: 0, countOfficialTotal: 0, countKacak: 0, sumKacakPortfolio: 0, names: []
            });
          }
        }
      } else {
        initializeDanismanMap(eKey, o.id, o.name, o.ownerName);
      }
    });

    // Populate official panel advisor numbers from danismanRaw (Kullanıcı Raporu)
    danismanRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const rowBrand = getBrandFromRow(row, offices);
      const office = findCorrectOffice(officeId, rowBrand, row);
      
      if (!office) return;

      const entityId = getEntityKey(office);
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
        
        if (entity.isGroup && office.groupId && entity.subOffices) {
          const sub = entity.subOffices.find(s => s.code === office.id);
          if (sub) {
            sub.countOwner += ownerVal;
            sub.countBroker += brokerVal;
            sub.countDanisman += danismanVal;
            sub.countOfficialTotal += (ownerVal + brokerVal + danismanVal);
          }
        }
      }
    });

    // Populate Kaçak Danışman from kacakDanismanRaw (Kaçak Sahibinden Raporu)
    kacakDanismanRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const rowBrand = getBrandFromRow(row, offices);
      const office = findCorrectOffice(officeId, rowBrand, row);
      console.log("DEBUG KACAK:", { id: officeId, brand: rowBrand, officeName: office?.name, row });

      if (!office) return;

      const entityId = getEntityKey(office);
      if (isPhase2 && !phase1Problematic.includes(entityId)) return;

      const entity = danismanMap[entityId];
      if (entity) {
        const name = getNormalizedValue(row, ["danismanadi", "danisman adi", "danisman adisoyadi", "danisman adi soyadi", "adsoyad", "ad soyad", "danismanadisoyadi", "danismanadisoyadi"]) || "Bilinmeyen Danışman";
        const portfolio = Number(getNormalizedValue(row, ["portfoysayisi", "portfoy", "ilansayisi", "ilan sayisi"]) || 1);
        
        const displayLabel = `${name} (${portfolio} Portföy)`;
        if (name && !entity.names.includes(displayLabel)) {
          entity.names.push(displayLabel);
          entity.countKacak += 1;
          entity.sumKacakPortfolio += portfolio;
          entity.status = "Sorunlu";
        }
        
        if (entity.isGroup && office.groupId && entity.subOffices) {
          const sub = entity.subOffices.find(s => s.code === office.id);
          if (sub) {
            if (name && !sub.names.includes(displayLabel)) {
              sub.names.push(displayLabel);
              sub.countKacak += 1;
              sub.sumKacakPortfolio += portfolio;
            }
          }
        }
      }
    });

    const danismanArr = Object.values(danismanMap);
    setDanismanReport(danismanArr);

    // --- 2. İLAN DENETİMİ RAPORU HESAPLAMA ---
    const ilanMap: { 
      [entityId: string]: { 
        entityId: string;
        code: string; 
        name: string; 
        ownerName: string; 
        countSatilik: number; 
        countKiralik: number; 
        countPanelTotal: number; 
        countSahibinden: number; 
        difference: number; 
        status: "Sorunlu" | "Uyumlu";
        isGroup?: boolean;
        subOffices?: {
          code: string;
          name: string;
          countSatilik: number;
          countKiralik: number;
          countPanelTotal: number;
          countSahibinden: number;
          difference: number;
        }[];
      } 
    } = {};

    offices.forEach(o => {
      const targetId = getEntityKey(o);
      if (isPhase2 && !phase1Problematic.includes(targetId)) return;

      if (!ilanMap[targetId]) {
        if (o.groupId) {
          const group = groups.find(g => g.id === o.groupId);
          ilanMap[targetId] = {
            entityId: targetId,
            code: targetId,
            name: group ? `${group.name} (Grup)` : "Grup Ofis",
            ownerName: group ? group.ownerName : o.ownerName,
            countSatilik: 0,
            countKiralik: 0,
            countPanelTotal: 0,
            countSahibinden: 0,
            difference: 0,
            status: "Uyumlu",
            isGroup: true,
            subOffices: []
          };
        } else {
          ilanMap[targetId] = {
            entityId: targetId,
            code: o.id,
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
      
      if (o.groupId) {
        const ent = ilanMap[targetId];
        if (ent && ent.subOffices && !ent.subOffices.find(s => s.code === o.id)) {
          ent.subOffices.push({
            code: o.id, name: o.name, countSatilik: 0, countKiralik: 0, countPanelTotal: 0, countSahibinden: 0, difference: 0
          });
        }
      }
    });

    // Populate Panel Counts (Satılık, Kiralık)
    ilanPanelRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const rowBrand = getBrandFromRow(row, offices);
      const office = findCorrectOffice(officeId, rowBrand, row);
      console.log("DEBUG ILAN_PANEL:", { id: officeId, brand: rowBrand, officeName: office?.name, row });

      if (!office) return;

      const targetId = getEntityKey(office);
      if (ilanMap[targetId]) {
        const satilik = Number(getNormalizedValue(row, ["satilik", "satılık", "sale"]) || 0);
        const kiralik = Number(getNormalizedValue(row, ["kiralik", "kiralık", "rent"]) || 0);
        
        ilanMap[targetId].countSatilik += satilik;
        ilanMap[targetId].countKiralik += kiralik;
        ilanMap[targetId].countPanelTotal += (satilik + kiralik);
        
        if (ilanMap[targetId].isGroup && office.groupId && ilanMap[targetId].subOffices) {
          const sub = ilanMap[targetId].subOffices!.find(s => s.code === office.id);
          if (sub) {
            sub.countSatilik += satilik;
            sub.countKiralik += kiralik;
            sub.countPanelTotal += (satilik + kiralik);
          }
        }
      }
    });

    // Populate Sahibinden Counts (Consolidated Portföy Sayısı)
    ilanSahibindenRaw.forEach(row => {
      const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
      if (!officeId) return;

      const rowBrand = getBrandFromRow(row, offices);
      const office = findCorrectOffice(officeId, rowBrand, row);
      console.log("DEBUG ILAN_SAHIBINDEN:", { id: officeId, brand: rowBrand, officeName: office?.name, row });

      if (!office) return;

      const targetId = getEntityKey(office);
      if (ilanMap[targetId]) {
        const portfoy = Number(getNormalizedValue(row, ["portfoysayisi", "portfoy", "ilansayisi", "ilan sayisi"]) || 0);
        ilanMap[targetId].countSahibinden += portfoy;
        
        if (ilanMap[targetId].isGroup && office.groupId && ilanMap[targetId].subOffices) {
          const sub = ilanMap[targetId].subOffices!.find(s => s.code === office.id);
          if (sub) {
            sub.countSahibinden += portfoy;
          }
        }
      }
    });

    // Apply tolerances rules to consolidated totals
    Object.keys(ilanMap).forEach(key => {
      const item = ilanMap[key];
      const s = item.countSahibinden;
      const p = item.countPanelTotal;
      const diff = s - p; // Excess on Sahibinden portal
      item.difference = diff;
      
      if (item.subOffices) {
        item.subOffices.forEach(sub => {
          sub.difference = sub.countSahibinden - sub.countPanelTotal;
        });
      }

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

  const handleRealDataLoad = async (type: string, data: any[], secondaryData?: any[]): Promise<boolean> => {
    if (!activeAudit) return false;
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
        return true;
      } else {
        const err = await res.json();
        showMsg("error", "Hata: " + err.error);
        return false;
      }
    } catch (err) {
      showMsg("error", "Sunucuya bağlanılamadı.");
      return false;
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

  const getOfficeBrand = (id: string, sourceFile?: string) => {
    const src = String(sourceFile || "").toLowerCase();
    let preferredBrand: string | null = null;
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
      const brand = getOfficeBrand(id, r._sourceFile);
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
      const brand = getOfficeBrand(id, r._sourceFile);
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
        detailsMap[item.code + "_danisman"] = `Portallerde yapılan eşleştirmelerde, ofisiniz bünyesinde çalışan ancak resmi panelde kaydı bulunmayan yetkisiz (kaçak) danışmanlar tespit edilmiştir:\n\nKaçak Danışman Listesi: ${item.names.join(", ")}\n\nPanel Kişi Sayısı: ${item.countOfficialTotal} (Owner: ${item.countOwner}, Broker: ${item.countBroker}, Danışman: ${item.countDanisman})`;
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

  // --- TABLE A FILTERS, SORTING, AND TOTALS ---
  const processedDanismanReport = React.useMemo(() => {
    let result = [...danismanReport];

    // Filter by search text
    if (danismanSearch.trim()) {
      const searchLower = danismanSearch.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchLower) || 
        item.code.toLowerCase().includes(searchLower) || 
        item.ownerName.toLowerCase().includes(searchLower) ||
        (item.subOffices && item.subOffices.some(sub => 
          sub.name.toLowerCase().includes(searchLower) || 
          sub.code.toLowerCase().includes(searchLower)
        ))
      );
    }

    // Filter by brand
    if (danismanBrand !== "all") {
      result = result.filter(item => {
        const brand = getEntityBrand(item.code);
        return brand === danismanBrand;
      });
    }

    // Filter by status
    if (danismanStatus !== "all") {
      result = result.filter(item => {
        if (danismanStatus === "Sorunlu") return item.status === "Sorunlu";
        if (danismanStatus === "Uyumlu") return item.status === "Uyumlu";
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      switch (danismanSort) {
        case "name_asc":
          return a.name.localeCompare(b.name, "tr");
        case "name_desc":
          return b.name.localeCompare(a.name, "tr");
        case "resmi_kadro_desc":
          return b.countOfficialTotal - a.countOfficialTotal;
        case "resmi_kadro_asc":
          return a.countOfficialTotal - b.countOfficialTotal;
        case "kacak_desc":
          return b.countKacak - a.countKacak;
        case "kacak_asc":
          return a.countKacak - b.countKacak;
        default:
          return 0;
      }
    });

    return result;
  }, [danismanReport, danismanSearch, danismanBrand, danismanStatus, danismanSort, offices]);

  const totalOfficial = processedDanismanReport.reduce((acc, item) => acc + item.countOfficialTotal, 0);
  const totalOwner = processedDanismanReport.reduce((acc, item) => acc + item.countOwner, 0);
  const totalBroker = processedDanismanReport.reduce((acc, item) => acc + item.countBroker, 0);
  const totalDanisman = processedDanismanReport.reduce((acc, item) => acc + item.countDanisman, 0);
  const totalKacakCount = processedDanismanReport.reduce((acc, item) => acc + item.countKacak, 0);
  const totalKacakPortfolios = processedDanismanReport.reduce((acc, item) => acc + (item.sumKacakPortfolio || 0), 0);


  // --- TABLE B FILTERS, SORTING, AND TOTALS ---
  const processedIlanReport = React.useMemo(() => {
    let result = [...ilanReport];

    // Filter by search text
    if (ilanSearch.trim()) {
      const searchLower = ilanSearch.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchLower) || 
        item.code.toLowerCase().includes(searchLower) || 
        item.ownerName.toLowerCase().includes(searchLower) ||
        (item.subOffices && item.subOffices.some(sub => 
          sub.name.toLowerCase().includes(searchLower) || 
          sub.code.toLowerCase().includes(searchLower)
        ))
      );
    }

    // Filter by brand
    if (ilanBrand !== "all") {
      result = result.filter(item => {
        const brand = getEntityBrand(item.code);
        return brand === ilanBrand;
      });
    }

    // Filter by status
    if (ilanStatus !== "all") {
      result = result.filter(item => {
        if (ilanStatus === "Sorunlu") return item.status === "Sorunlu";
        if (ilanStatus === "Uyumlu") return item.status === "Uyumlu";
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      switch (ilanSort) {
        case "name_asc":
          return a.name.localeCompare(b.name, "tr");
        case "name_desc":
          return b.name.localeCompare(a.name, "tr");
        case "resmi_panel_desc":
          return b.countPanelTotal - a.countPanelTotal;
        case "resmi_panel_asc":
          return a.countPanelTotal - b.countPanelTotal;
        case "sahibinden_desc":
          return b.countSahibinden - a.countSahibinden;
        case "sahibinden_asc":
          return a.countSahibinden - b.countSahibinden;
        case "fark_desc":
          return b.difference - a.difference;
        case "fark_asc":
          return a.difference - b.difference;
        default:
          return 0;
      }
    });

    return result;
  }, [ilanReport, ilanSearch, ilanBrand, ilanStatus, ilanSort, offices]);

  const totalPanel = processedIlanReport.reduce((acc, item) => acc + item.countPanelTotal, 0);
  const totalSatilik = processedIlanReport.reduce((acc, item) => acc + item.countSatilik, 0);
  const totalKiralik = processedIlanReport.reduce((acc, item) => acc + item.countKiralik, 0);
  const totalSahibinden = processedIlanReport.reduce((acc, item) => acc + item.countSahibinden, 0);
  const totalDifference = processedIlanReport.reduce((acc, item) => acc + item.difference, 0);

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
                  {/* 1. Panel Kişi Card */}
                  <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-150 space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded flex items-center justify-center font-bold text-xs shrink-0">📋</div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">1. Panel Kişi</h4>
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

                  {/* 2. İlan Portföy Card */}
                  <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-150 space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded flex items-center justify-center font-bold text-xs shrink-0">🏡</div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">2. İlan Portföy</h4>
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
                  { id: "danisman", label: "📋 Kullanıcı Raporu (Panel Kişi)" },
                  { id: "ilan_panel", label: "🏡 İlan Raporu (İlan Portföy)" },
                  { id: "ilan_sahibinden", label: "🌐 Sahibinden İlan & Kaçak Danışman (Çift Sayfalı)" }
                ]}
                hints={
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-500 text-[11px] pt-2 border-t border-slate-100 mt-2">
                    <div>
                      <h5 className="font-bold text-slate-700 mb-0.5">📋 Panel Kişi Dosyası</h5>
                      <p>Örnek dosya adı: <code className="font-mono bg-slate-100 px-1 text-slate-800 rounded">cb_akullanici.xlsx</code>, <code className="font-mono bg-slate-100 px-1 text-slate-800 rounded">c21_akullanici</code></p>
                      <span className="block mt-1 text-[10px] text-slate-400">Kolonlar: Ofis Kodu, Owner, Broker, Danışman</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-700 mb-0.5">🏡 İlan Portföy Dosyası</h5>
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

              {/* DIAGNOSTIC PANEL FOR UPLOADED RAW ROWS */}
              {activeAudit && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🔍</span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Detaylı Veri Yükleme & Ofis Eşleştirme Tanısı (Diagnostic Panel)</h4>
                        <p className="text-[10px] text-slate-400">Excel'den okunan ham verileri ve sistem eşleşmelerini analiz edin.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDiagnostics(!showDiagnostics)}
                      className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded flex items-center gap-1 transition cursor-pointer"
                    >
                      {showDiagnostics ? "Tanı Panelini Kapat" : "Tanı Panelini Aç"}
                    </button>
                  </div>

                  {showDiagnostics && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                      {/* FILTERS */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Ofis Kodu veya Adı Ara..."
                          value={diagnosticSearch}
                          onChange={(e) => setDiagnosticSearch(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white w-full sm:w-64 focus:outline-none focus:border-slate-400"
                        />
                        <select
                          value={diagnosticBrand}
                          onChange={(e) => setDiagnosticBrand(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white w-full sm:w-48 focus:outline-none"
                        >
                          <option value="all">Tüm Markalar</option>
                          <option value="Century 21">Century 21</option>
                          <option value="Coldwell Banker">Coldwell Banker</option>
                          <option value="ERA">ERA</option>
                          <option value="not_found">Marka Bulunamayanlar</option>
                        </select>
                      </div>

                      {/* DATA SECTION TABLES */}
                      <div className="space-y-4">
                        {/* 1. Panel Kişi Ham Verileri */}
                        <div>
                          <h5 className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            📋 Ham Panel Kişi Verileri ({
                              ((activeAudit.currentPhase === "Tespit" ? activeAudit.phase1DanismanRaw : activeAudit.phase2DanismanRaw) || []).length
                            } Satır)
                          </h5>
                          <div className="overflow-x-auto border border-slate-200 rounded bg-white max-h-64 overflow-y-auto">
                            <table className="w-full text-left text-[11px] text-slate-600">
                              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 sticky top-0">
                                <tr>
                                  <th className="px-3 py-1.5">Dosya</th>
                                  <th className="px-3 py-1.5">Excel Ofis Kodu</th>
                                  <th className="px-3 py-1.5">Excel Ofis Adı</th>
                                  <th className="px-3 py-1.5">Çözümlenen Marka</th>
                                  <th className="px-3 py-1.5">Sistem Eşleşmesi & Durumu</th>
                                  <th className="px-3 py-1.5">Owner / Broker / Danışman</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150">
                                {(() => {
                                  const rawList = (activeAudit.currentPhase === "Tespit" ? activeAudit.phase1DanismanRaw : activeAudit.phase2DanismanRaw) || [];
                                  const filtered = rawList.filter(row => {
                                    const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
                                    const officeName = getNormalizedValue(row, ["ofisadi", "ofis adi", "name", "office name", "ad", "unvan", "ofis"]).toLowerCase();
                                    const brand = getOfficeBrand(officeId, row._sourceFile) || "";
                                    
                                    const matchesSearch = officeId.toLowerCase().includes(diagnosticSearch.toLowerCase()) || officeName.includes(diagnosticSearch.toLowerCase());
                                    const matchesBrand = diagnosticBrand === "all" || 
                                      (diagnosticBrand === "not_found" && !brand) ||
                                      brand === diagnosticBrand;
                                      
                                    return matchesSearch && matchesBrand;
                                  });

                                  if (filtered.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={6} className="text-center py-4 text-slate-400">Veri bulunamadı veya arama kriterleriyle eşleşen kayıt yok.</td>
                                      </tr>
                                    );
                                  }

                                  return filtered.map((row, idx) => {
                                    const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
                                    const officeName = getNormalizedValue(row, ["ofisadi", "ofis adi", "name", "office name", "ad", "unvan", "ofis"]) || "-";
                                    const brand = getOfficeBrand(officeId, row._sourceFile);
                                    
                                    // Search in registered offices
                                    const matchedOffice = offices.find(o => o.id === officeId && o.brand === brand) || offices.find(o => o.id === officeId);

                                    return (
                                      <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-1.5 text-slate-400 max-w-[120px] truncate" title={row._sourceFile}>{row._sourceFile || "-"}</td>
                                        <td className="px-3 py-1.5 font-bold font-mono text-slate-800">{officeId || <span className="text-red-500 font-bold">BOŞ / HATA</span>}</td>
                                        <td className="px-3 py-1.5 text-slate-700">{officeName}</td>
                                        <td className="px-3 py-1.5">
                                          {brand ? (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              brand === "Century 21" ? "bg-orange-50 text-orange-700 border border-orange-100" :
                                              brand === "Coldwell Banker" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                                              "bg-red-50 text-red-700 border border-red-100"
                                            }`}>
                                              {brand}
                                            </span>
                                          ) : (
                                            <span className="text-red-500 font-bold">Belirlenemedi</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5">
                                          {matchedOffice ? (
                                            <span className={`flex items-center gap-1 ${matchedOffice.status === "Silinmiş" ? "text-red-500" : matchedOffice.status === "Dondurulmuş" ? "text-amber-600" : "text-emerald-600"}`}>
                                              <span className="font-bold">{matchedOffice.name}</span>
                                              <span className="text-[9px] px-1 py-0.2 bg-slate-100 rounded font-mono">({matchedOffice.status})</span>
                                            </span>
                                          ) : (
                                            <span className="text-rose-500 font-semibold italic flex items-center gap-1">
                                              <span>⚠ Sistemde kayıtlı değil</span>
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-500 font-mono">
                                          O: {getNormalizedValue(row, ["owner", "sahip", "ofissahibi"]) || 0} / 
                                          B: {getNormalizedValue(row, ["broker"]) || 0} / 
                                          D: {getNormalizedValue(row, ["danisman", "danismanlar", "danismantoplami", "advisor", "agent"]) || 0}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* 2. İlan Portföy Ham Verileri */}
                        <div>
                          <h5 className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            🏡 Ham İlan Portföy Verileri ({
                              ((activeAudit.currentPhase === "Tespit" ? activeAudit.phase1IlanPanelRaw : activeAudit.phase2IlanPanelRaw) || []).length
                            } Satır)
                          </h5>
                          <div className="overflow-x-auto border border-slate-200 rounded bg-white max-h-64 overflow-y-auto">
                            <table className="w-full text-left text-[11px] text-slate-600">
                              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 sticky top-0">
                                <tr>
                                  <th className="px-3 py-1.5">Dosya</th>
                                  <th className="px-3 py-1.5">Excel Ofis Kodu</th>
                                  <th className="px-3 py-1.5">Çözümlenen Marka</th>
                                  <th className="px-3 py-1.5">Sistem Eşleşmesi & Durumu</th>
                                  <th className="px-3 py-1.5">Satılık / Kiralık</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150">
                                {(() => {
                                  const rawList = (activeAudit.currentPhase === "Tespit" ? activeAudit.phase1IlanPanelRaw : activeAudit.phase2IlanPanelRaw) || [];
                                  const filtered = rawList.filter(row => {
                                    const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
                                    const brand = getOfficeBrand(officeId, row._sourceFile) || "";
                                    
                                    const matchesSearch = officeId.toLowerCase().includes(diagnosticSearch.toLowerCase());
                                    const matchesBrand = diagnosticBrand === "all" || 
                                      (diagnosticBrand === "not_found" && !brand) ||
                                      brand === diagnosticBrand;
                                      
                                    return matchesSearch && matchesBrand;
                                  });

                                  if (filtered.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={5} className="text-center py-4 text-slate-400">Veri bulunamadı veya arama kriterleriyle eşleşen kayıt yok.</td>
                                      </tr>
                                    );
                                  }

                                  return filtered.map((row, idx) => {
                                    const officeId = getNormalizedValue(row, ["ofiskodu", "ofis kodu", "id", "kod"]).toUpperCase().trim();
                                    const brand = getOfficeBrand(officeId, row._sourceFile);
                                    
                                    // Search in registered offices
                                    const matchedOffice = offices.find(o => o.id === officeId && o.brand === brand) || offices.find(o => o.id === officeId);

                                    return (
                                      <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-1.5 text-slate-400 max-w-[120px] truncate" title={row._sourceFile}>{row._sourceFile || "-"}</td>
                                        <td className="px-3 py-1.5 font-bold font-mono text-slate-800">{officeId || <span className="text-red-500 font-bold">BOŞ / HATA</span>}</td>
                                        <td className="px-3 py-1.5">
                                          {brand ? (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              brand === "Century 21" ? "bg-orange-50 text-orange-700 border border-orange-100" :
                                              brand === "Coldwell Banker" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                                              "bg-red-50 text-red-700 border border-red-100"
                                            }`}>
                                              {brand}
                                            </span>
                                          ) : (
                                            <span className="text-red-500 font-bold">Belirlenemedi</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5">
                                          {matchedOffice ? (
                                            <span className={`flex items-center gap-1 ${matchedOffice.status === "Silinmiş" ? "text-red-500" : matchedOffice.status === "Dondurulmuş" ? "text-amber-600" : "text-emerald-600"}`}>
                                              <span className="font-bold">{matchedOffice.name}</span>
                                              <span className="text-[9px] px-1 py-0.2 bg-slate-100 rounded font-mono">({matchedOffice.status})</span>
                                            </span>
                                          ) : (
                                            <span className="text-rose-500 font-semibold italic flex items-center gap-1">
                                              <span>⚠ Sistemde kayıtlı değil</span>
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-500 font-mono">
                                          S: {getNormalizedValue(row, ["satilik", "satılık", "sale"]) || 0} / 
                                          K: {getNormalizedValue(row, ["kiralik", "kiralık", "rent"]) || 0}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

                      {/* Filter Controls Row for Table A */}
                      <div className="px-3 py-2 bg-slate-50/30 border-b border-slate-150 flex flex-wrap gap-2 items-center">
                        <div className="flex-1 min-w-[140px]">
                          <input
                            type="text"
                            placeholder="Ofis/Grup ara..."
                            value={danismanSearch}
                            onChange={(e) => setDanismanSearch(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
                          />
                        </div>
                        <div className="w-full sm:w-auto">
                          <select
                            value={danismanBrand}
                            onChange={(e) => setDanismanBrand(e.target.value)}
                            className="w-full sm:w-[130px] px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400"
                          >
                            <option value="all">Tüm Markalar</option>
                            <option value="Coldwell Banker">Coldwell Banker</option>
                            <option value="Century 21">Century 21</option>
                            <option value="ERA">ERA</option>
                          </select>
                        </div>
                        <div className="w-full sm:w-auto">
                          <select
                            value={danismanStatus}
                            onChange={(e) => setDanismanStatus(e.target.value)}
                            className="w-full sm:w-[120px] px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400"
                          >
                            <option value="all">Tüm Durumlar</option>
                            <option value="Sorunlu">Kaçak Var</option>
                            <option value="Uyumlu">Uyumlu</option>
                          </select>
                        </div>
                        <div className="w-full sm:w-auto">
                          <select
                            value={danismanSort}
                            onChange={(e) => setDanismanSort(e.target.value)}
                            className="w-full sm:w-[150px] px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400"
                          >
                            <option value="name_asc">Sıralama: İsim (A-Z)</option>
                            <option value="name_desc">Sıralama: İsim (Z-A)</option>
                            <option value="resmi_kadro_desc">Sıralama: Panel Kişi (Yüksek)</option>
                            <option value="resmi_kadro_asc">Sıralama: Panel Kişi (Düşük)</option>
                            <option value="kacak_desc">Sıralama: Kaçak Sayısı (Yüksek)</option>
                            <option value="kacak_asc">Sıralama: Kaçak Sayısı (Düşük)</option>
                          </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-xs text-slate-600 border-collapse table-fixed min-w-[600px]">
                          <colgroup>
                            <col className="w-10" />
                            <col className="w-1/3" />
                            <col className="w-1/4 text-center" />
                            <col className="w-24" />
                            <col className="w-1/3" />
                          </colgroup>
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                            <tr>
                              <th className="px-3 py-2">Seç</th>
                              <th className="px-3 py-2">Ofis/Grup Kodu & Adı</th>
                              <th className="px-3 py-2 text-center">Panel Kişi</th>
                              <th className="px-3 py-2">Durumu</th>
                              <th className="px-3 py-2">Kaçak Danışmanlar (Portföylü)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {processedDanismanReport.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-6 text-slate-400">Aranan kriterlere uygun danışman tespiti bulunamadı.</td>
                              </tr>
                            ) : (
                              processedDanismanReport.map((item) => (
                                <React.Fragment key={item.entityId}>
                                <tr className={`hover:bg-slate-50/40 transition ${item.status === "Sorunlu" ? "bg-rose-50/20" : ""}`}>
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      disabled={item.status === "Uyumlu"}
                                      checked={selectedDanismanIds.includes(item.entityId)}
                                      onChange={() => toggleDanismanSelection(item.entityId)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-30 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="font-semibold text-slate-850 truncate">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{item.code} - {item.ownerName}</div>
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
                                {item.isGroup && item.subOffices && item.subOffices.map((sub: any) => (
                                  <tr key={sub.code} className="bg-slate-50/50 hover:bg-slate-100/50 transition">
                                    <td className="px-3 py-1.5"></td>
                                    <td className="px-3 py-1.5 pl-6">
                                      <div className="flex items-center text-slate-600">
                                        <div className="w-3 h-3 border-l-2 border-b-2 border-slate-300 mr-2 rounded-bl"></div>
                                        <div>
                                          <div className="font-medium text-xs truncate">{sub.name}</div>
                                          <div className="text-[9px] text-slate-400 font-mono">{sub.code}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="font-mono text-[10px] text-slate-600 font-semibold">
                                        Toplam: {sub.countOfficialTotal}
                                      </div>
                                      <div className="text-[8px] text-slate-400 font-mono">
                                        O: {sub.countOwner} | B: {sub.countBroker} | D: {sub.countDanisman}
                                      </div>
                                    </td>
                                    <td className="px-3 py-1.5">
                                      {sub.countKacak > 0 && (
                                        <span className="inline-block px-1.5 py-0.5 rounded font-bold text-[8px] uppercase bg-rose-50 text-rose-600 border border-rose-100">
                                          {sub.countKacak} KAÇAK
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 text-rose-600 font-medium">
                                      {sub.names && sub.names.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {sub.names.map((n: string, i: number) => (
                                            <span key={i} className="bg-rose-50 border border-rose-100 text-[9px] px-1 py-0.5 rounded text-rose-700 font-mono">
                                              {n}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                </React.Fragment>
                              ))
                            )}
                          </tbody>
                          {processedDanismanReport.length > 0 && (
                            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 sticky bottom-0 z-10 shadow-xs">
                              <tr>
                                <td className="px-3 py-2.5"></td>
                                <td className="px-3 py-2.5 text-slate-800 text-xs">TOPLAM ({processedDanismanReport.length} Ofis)</td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="text-xs text-slate-950">Panel Kişi: {totalOfficial}</div>
                                  <div className="text-[9px] text-slate-500 font-normal">
                                    O: {totalOwner} | B: {totalBroker} | D: {totalDanisman}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  {totalKacakCount > 0 ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded font-bold text-[9px] bg-rose-100 text-rose-900">
                                      {totalKacakCount} KAÇAK VAR
                                    </span>
                                  ) : (
                                    <span className="inline-block px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-100 text-emerald-800">
                                      UYUMLU
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-rose-900 text-xs font-semibold">
                                  {totalKacakCount > 0 ? (
                                    <div className="flex flex-col">
                                      <span>Kaçak Danışman Sayısı: {totalKacakCount} Kişi</span>
                                      <span className="text-[10px] text-slate-500 font-mono font-normal">
                                        Toplam Portföy (Parantez İçi): {totalKacakPortfolios}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-mono text-[11px]">-</span>
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          )}
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

                      {/* Filter Controls Row for Table B */}
                      <div className="px-3 py-2 bg-slate-50/30 border-b border-slate-150 flex flex-wrap gap-2 items-center">
                        <div className="flex-1 min-w-[140px]">
                          <input
                            type="text"
                            placeholder="Ofis/Grup ara..."
                            value={ilanSearch}
                            onChange={(e) => setIlanSearch(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
                          />
                        </div>
                        <div className="w-full sm:w-auto">
                          <select
                            value={ilanBrand}
                            onChange={(e) => setIlanBrand(e.target.value)}
                            className="w-full sm:w-[130px] px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400"
                          >
                            <option value="all">Tüm Markalar</option>
                            <option value="Coldwell Banker">Coldwell Banker</option>
                            <option value="Century 21">Century 21</option>
                            <option value="ERA">ERA</option>
                          </select>
                        </div>
                        <div className="w-full sm:w-auto">
                          <select
                            value={ilanStatus}
                            onChange={(e) => setIlanStatus(e.target.value)}
                            className="w-full sm:w-[120px] px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400"
                          >
                            <option value="all">Tüm Durumlar</option>
                            <option value="Sorunlu">Limit Aşıldı</option>
                            <option value="Uyumlu">Uyumlu</option>
                          </select>
                        </div>
                        <div className="w-full sm:w-auto">
                          <select
                            value={ilanSort}
                            onChange={(e) => setIlanSort(e.target.value)}
                            className="w-full sm:w-[150px] px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-slate-400"
                          >
                            <option value="name_asc">Sıralama: İsim (A-Z)</option>
                            <option value="name_desc">Sıralama: İsim (Z-A)</option>
                            <option value="resmi_panel_desc">Sıralama: Panel İlan (Yüksek)</option>
                            <option value="resmi_panel_asc">Sıralama: Panel İlan (Düşük)</option>
                            <option value="sahibinden_desc">Sıralama: Sahibinden (Yüksek)</option>
                            <option value="sahibinden_asc">Sıralama: Sahibinden (Düşük)</option>
                            <option value="fark_desc">Sıralama: Fark (Yüksek)</option>
                            <option value="fark_asc">Sıralama: Fark (Düşük)</option>
                          </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-xs text-slate-600 border-collapse table-fixed min-w-[600px]">
                          <colgroup>
                            <col className="w-10" />
                            <col className="w-2/5" />
                            <col className="w-1/4 text-center" />
                            <col className="w-24 text-center" />
                            <col className="w-20 text-center" />
                            <col className="w-24" />
                          </colgroup>
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                            <tr>
                              <th className="px-3 py-2">Seç</th>
                              <th className="px-3 py-2">Ofis/Grup Kodu & Adı</th>
                              <th className="px-3 py-2 text-center">Panel İlan (Portföy)</th>
                              <th className="px-3 py-2 text-center">Sahibinden</th>
                              <th className="px-3 py-2 text-center">Fark</th>
                              <th className="px-3 py-2">Durumu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {processedIlanReport.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-slate-400">Aranan kriterlere uygun ilan tespiti bulunamadı.</td>
                              </tr>
                            ) : (
                              processedIlanReport.map((item) => (
                                <React.Fragment key={item.entityId}>
                                <tr className={`hover:bg-slate-50/40 transition ${item.status === "Sorunlu" ? "bg-rose-50/20" : ""}`}>
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      disabled={item.status === "Uyumlu"}
                                      checked={selectedIlanIds.includes(item.entityId)}
                                      onChange={() => toggleIlanSelection(item.entityId)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-30 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="font-semibold text-slate-850 truncate">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{item.code} - {item.ownerName}</div>
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
                                {item.isGroup && item.subOffices && item.subOffices.map((sub: any) => (
                                  <tr key={sub.code} className="bg-slate-50/50 hover:bg-slate-100/50 transition">
                                    <td className="px-3 py-1.5"></td>
                                    <td className="px-3 py-1.5 pl-6">
                                      <div className="flex items-center text-slate-600">
                                        <div className="w-3 h-3 border-l-2 border-b-2 border-slate-300 mr-2 rounded-bl"></div>
                                        <div>
                                          <div className="font-medium text-xs truncate">{sub.name}</div>
                                          <div className="text-[9px] text-slate-400 font-mono">{sub.code}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="font-mono text-[10px] text-slate-600 font-semibold">
                                        Toplam: {sub.countPanelTotal}
                                      </div>
                                      <div className="text-[8px] text-slate-400 font-mono">
                                        S: {sub.countSatilik} | K: {sub.countKiralik}
                                      </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-600 text-[11px]">
                                      {sub.countSahibinden}
                                    </td>
                                    <td className="px-3 py-1.5 text-center font-semibold font-mono text-[11px]">
                                      <span className={sub.difference > 0 ? "text-rose-500" : "text-emerald-500"}>
                                        {sub.difference > 0 ? `+${sub.difference}` : sub.difference}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5"></td>
                                  </tr>
                                ))}
                                </React.Fragment>
                              ))
                            )}
                          </tbody>
                          {processedIlanReport.length > 0 && (
                            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 sticky bottom-0 z-10 shadow-xs">
                              <tr>
                                <td className="px-3 py-2.5"></td>
                                <td className="px-3 py-2.5 text-slate-800 text-xs">TOPLAM ({processedIlanReport.length} Ofis)</td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="text-xs text-slate-950">Panel İlan: {totalPanel}</div>
                                  <div className="text-[9px] text-slate-500 font-normal">
                                    Satılık: {totalSatilik} | Kiralık: {totalKiralik}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-950">
                                  {totalSahibinden}
                                </td>
                                <td className="px-3 py-2.5 text-center text-xs font-mono">
                                  <span className={totalDifference > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                                    {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5"></td>
                              </tr>
                            </tfoot>
                          )}
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
