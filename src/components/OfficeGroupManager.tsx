import React, { useState, useRef } from "react";
import { Office, Group } from "../types";
import * as xlsx from "xlsx";
import { Plus, Users, Trash2, Building, Mail, User, Search, RefreshCw, ChevronRight, Upload, X, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";


interface OfficeGroupManagerProps {
  offices: Office[];
  groups: Group[];
  onRefresh: () => void;
}

export default function OfficeGroupManager({ offices, groups, onRefresh }: OfficeGroupManagerProps) {
  // New office state
  const [newOfficeId, setNewOfficeId] = useState("");
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficeOwner, setNewOfficeOwner] = useState("");
  const [newOfficeEmail, setNewOfficeEmail] = useState("");
  const [newOfficeBrand, setNewOfficeBrand] = useState("Coldwell Banker");

  // New group state
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOwner, setNewGroupOwner] = useState("");
  const [newGroupEmail, setNewGroupEmail] = useState("");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");

  // Multi-brand Excel Slots State
  const [cbFile, setCbFile] = useState<File | null>(null);
  const [c21File, setC21File] = useState<File | null>(null);
  const [eraFile, setEraFile] = useState<File | null>(null);

  const [uploadReport, setUploadReport] = useState<{
    added: number;
    updated: number;
    addedList: { id: string; name: string; brand: string }[];
    updatedList: { id: string; name: string; brand: string }[];
  } | null>(null);

  const cbInputRef = useRef<HTMLInputElement>(null);
  const c21InputRef = useRef<HTMLInputElement>(null);
  const eraInputRef = useRef<HTMLInputElement>(null);

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise<any[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = xlsx.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
          resolve(jsonData);
        } catch (error) {
          console.error("Excel parse error:", error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleBulkBrandUpload = async () => {
    setLoading(true);
    setUploadReport(null);
    try {
      let combinedOffices: any[] = [];
      
      if (cbFile) {
        const rows = await parseExcelFile(cbFile);
        const mapped = rows.map(r => ({ ...r, marka: "Coldwell Banker" }));
        combinedOffices = [...combinedOffices, ...mapped];
      }
      
      if (c21File) {
        const rows = await parseExcelFile(c21File);
        const mapped = rows.map(r => ({ ...r, marka: "Century 21" }));
        combinedOffices = [...combinedOffices, ...mapped];
      }
      
      if (eraFile) {
        const rows = await parseExcelFile(eraFile);
        const mapped = rows.map(r => ({ ...r, marka: "ERA" }));
        combinedOffices = [...combinedOffices, ...mapped];
      }

      if (combinedOffices.length === 0) {
        showMsg("error", "Lütfen yüklemek için en az bir marka Excel dosyası seçin.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/offices/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offices: combinedOffices })
      });

      if (res.ok) {
        const result = await res.json();
        setUploadReport({
          added: result.added,
          updated: result.updated,
          addedList: result.addedList || [],
          updatedList: result.updatedList || []
        });
        showMsg("success", `Excel Yükleme Başarılı! ${result.added} yeni ofis eklendi, ${result.updated} ofis güncellendi.`);
        // Reset state
        setCbFile(null);
        setC21File(null);
        setEraFile(null);
        if (cbInputRef.current) cbInputRef.current.value = "";
        if (c21InputRef.current) c21InputRef.current.value = "";
        if (eraInputRef.current) eraInputRef.current.value = "";
        onRefresh();
      } else {
        showMsg("error", "Sunucuya yüklenirken bir hata oluştu.");
      }
    } catch (err) {
      console.error(err);
      showMsg("error", "Dosyalar çözümlenirken hata oluştu. Kolonları kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMsg = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeId || !newOfficeName || !newOfficeOwner || !newOfficeEmail) {
      showMsg("error", "Lütfen tüm ofis alanlarını doldurun.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newOfficeId.toUpperCase().trim(),
          name: newOfficeName.trim(),
          ownerName: newOfficeOwner.trim(),
          ownerEmail: newOfficeEmail.trim(),
          brand: newOfficeBrand,
          groupId: null
        })
      });
      if (res.ok) {
        showMsg("success", "Ofis başarıyla kaydedildi.");
        setNewOfficeId("");
        setNewOfficeName("");
        setNewOfficeOwner("");
        setNewOfficeEmail("");
        onRefresh();
      } else {
        showMsg("error", "Ofis kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      showMsg("error", "Sunucu bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOffice = async (id: string, brand: string) => {
    if (!confirm(`Bu ofisi (${brand}) silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/offices/${id}?brand=${encodeURIComponent(brand)}`, { method: "DELETE" });
      if (res.ok) {
        showMsg("success", "Ofis silindi.");
        onRefresh();
      }
    } catch (err) {
      showMsg("error", "Ofis silinemedi.");
    }
  };

  const handleOfficeExcelLoad = async (type: string, data: any[]) => {
    setLoading(true);
    setUploadReport(null);
    try {
      const defaultBrand = type === "ALL" ? "" : type;
      const res = await fetch("/api/offices/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offices: data, defaultBrand })
      });
      if (res.ok) {
        const result = await res.json();
        setUploadReport({
          added: result.added,
          updated: result.updated,
          addedList: result.addedList || [],
          updatedList: result.updatedList || []
        });
        showMsg("success", `Excel yüklendi. ${result.added} yeni ofis eklendi, ${result.updated} ofis güncellendi.`);
        onRefresh();
      } else {
        showMsg("error", "Excel yüklenirken bir hata oluştu.");
      }
    } catch (err) {
      showMsg("error", "Sunucu bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupId || !newGroupName || !newGroupOwner || !newGroupEmail) {
      showMsg("error", "Lütfen tüm grup alanlarını doldurun.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: {
            id: newGroupId.toUpperCase().trim(),
            name: newGroupName.trim(),
            ownerName: newGroupOwner.trim(),
            ownerEmail: newGroupEmail.trim()
          },
          officeIds: []
        })
      });
      if (res.ok) {
        showMsg("success", "Grup ofis yapısı başarıyla tanımlandı.");
        setNewGroupId("");
        setNewGroupName("");
        setNewGroupOwner("");
        setNewGroupEmail("");
        onRefresh();
      } else {
        showMsg("error", "Grup kaydedilirken hata oluştu.");
      }
    } catch (err) {
      showMsg("error", "Sunucu bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Bu grubu silmek istediğinize emin misiniz? Grup üyeleri bağımsız hale gelecektir.")) return;
    try {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (res.ok) {
        showMsg("success", "Grup silindi, bağlı ofisler bağımsız hale getirildi.");
        if (selectedGroupId === id) setSelectedGroupId(null);
        onRefresh();
      }
    } catch (err) {
      showMsg("error", "Grup silinemedi.");
    }
  };

  const handleAssignToGroup = async (officeId: string, brand: string, groupId: string | null) => {
    const office = offices.find(o => o.id === officeId && o.brand === brand);
    if (!office) return;

    try {
      // Find all offices in the current group if any, update them using compound keys (id:::brand)
      let targetOfficeIds: string[] = [];
      if (groupId) {
        // Collect current members of this group + this office
        targetOfficeIds = offices
          .filter(o => o.groupId === groupId || (o.id === officeId && o.brand === brand))
          .map(o => `${o.id}:::${o.brand}`);
      }

      // If removing from group
      if (!groupId && office.groupId) {
        // We are removing officeId from its old group. Just update this office specifically.
        const res = await fetch("/api/offices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...office,
            groupId: null
          })
        });
        if (res.ok) {
          showMsg("success", "Ofis gruptan çıkarıldı.");
          onRefresh();
        }
        return;
      }

      const targetGroup = groups.find(g => g.id === groupId);
      if (!targetGroup) return;

      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: targetGroup,
          officeIds: targetOfficeIds
        })
      });

      if (res.ok) {
        showMsg("success", "Ofis grubu güncellendi.");
        onRefresh();
      }
    } catch (err) {
      showMsg("error", "Atama işlemi sırasında hata oluştu.");
    }
  };

  const filteredOffices = offices.filter(o => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (
      o.id.toLowerCase().includes(term) ||
      o.name.toLowerCase().includes(term) ||
      (o.ownerName && o.ownerName.toLowerCase().includes(term)) ||
      (o.responsibleUser && o.responsibleUser.toLowerCase().includes(term))
    );
    const matchesBrand = selectedBrand === "ALL" || o.brand === selectedBrand;
    return matchesSearch && matchesBrand;
  });

  return (
    <div className="space-y-8" id="group-manager-panel">
      {msg && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-sm max-w-md ${
            msg.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Header section with Stats */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600 w-4 h-4" />
            Ofis ve Grup İlişkilendirme Modülü
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Excel verileri kardeş/grup ofis bilgisini barındırmaz. Burada tanımladığınız ilişkiler, denetim konsolidasyonunu belirler.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={async () => {
              if (confirm("DİKKAT: Veritabanındaki tüm ofisler, gruplar, denetim dönemleri ve e-posta kayıtları tamamen sıfırlanacaktır. Devam etmek istiyor musunuz?")) {
                setLoading(true);
                try {
                  const res = await fetch("/api/db/reset", { method: "POST" });
                  if (res.ok) {
                    showMsg("success", "Tüm veritabanı başarıyla temizlendi.");
                    onRefresh();
                  } else {
                    showMsg("error", "Veritabanı sıfırlanırken bir hata oluştu.");
                  }
                } catch (e) {
                  showMsg("error", "Bağlantı hatası.");
                } finally {
                  setLoading(false);
                }
              }
            }}
            disabled={loading}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold text-xs transition duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            Tüm Veritabanını Sıfırla
          </button>
          <div className="px-3 py-1.5 bg-slate-50 rounded border border-slate-200 text-center">
            <div className="text-sm font-bold text-slate-800">{offices.length}</div>
            <div className="text-[10px] text-slate-500">Toplam Ofis</div>
          </div>
          <div className="px-3 py-1.5 bg-blue-50 rounded border border-blue-100 text-center">
            <div className="text-sm font-bold text-blue-700">{groups.length}</div>
            <div className="text-[10px] text-blue-500 font-semibold">Grup Yapısı</div>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded transition duration-150 text-slate-600 cursor-pointer"
            title="Verileri Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Groups Directory & Form */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Create Group Form */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                Yeni Grup Ofis Tanımla
              </h3>
            </div>
            <form onSubmit={handleCreateGroup} className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Grup Kodu</label>
                  <input
                    type="text"
                    required
                    placeholder="G100"
                    value={newGroupId}
                    onChange={(e) => setNewGroupId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Grup Adı</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Kuzey Ege Grubu"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ortak Malik (Sahibi)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ad Soyad"
                    value={newGroupOwner}
                    onChange={(e) => setNewGroupOwner(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ortak İletişim E-posta</label>
                  <input
                    type="email"
                    required
                    placeholder="malik@alan.com"
                    value={newGroupEmail}
                    onChange={(e) => setNewGroupEmail(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded shadow-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Grup Oluştur
              </button>
            </form>
          </div>

          {/* Group Directory List */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                Aktif Grup Yapıları ({groups.length})
              </h3>
            </div>
            <div className="p-3 max-h-[380px] overflow-y-auto space-y-2">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Henüz tanımlanmış bir grup ofis yapısı bulunmuyor.
                </div>
              ) : (
                groups.map((group) => {
                  const members = offices.filter(o => o.groupId === group.id);
                  const isSelected = selectedGroupId === group.id;

                  return (
                    <div
                      key={group.id}
                      onClick={() => setSelectedGroupId(isSelected ? null : group.id)}
                      className={`p-3 rounded border transition duration-150 cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/40 border-blue-200"
                          : "bg-white hover:bg-slate-50/40 border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                              {group.id}
                            </span>
                            <span className="font-bold text-xs text-slate-850">{group.name}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 mt-2 text-[11px] text-slate-500">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{group.ownerName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{group.ownerEmail}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition duration-150 cursor-pointer"
                          title="Grubu Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Members list preview */}
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                          <span>Bağlı Ofisler ({members.length})</span>
                          <span className="text-[9px] text-blue-600">Seçimi Filtrele</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {members.length === 0 ? (
                            <span className="text-[9px] text-slate-400 italic">Bağlı ofis yok. Yandaki listeden atayabilirsiniz.</span>
                          ) : (
                            members.map(m => {
                              const brandAbbr = m.brand === "Coldwell Banker" ? "CB" : m.brand === "Century 21" ? "C21" : m.brand === "ERA" ? "ERA" : "";
                              return (
                                <span
                                  key={`${m.id}-${m.brand}`}
                                  className="inline-flex items-center gap-1 font-mono text-[9px] bg-slate-100 text-slate-600 border border-slate-200/50 px-1 py-0.5 rounded-sm"
                                  title={`${m.name} (${m.brand})`}
                                >
                                  {m.id} {brandAbbr && <span className="text-[8px] text-blue-500 font-bold">({brandAbbr})</span>}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Office Inventory & Assigning */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Create Office Form & Search Header */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              Sisteme Yeni Tekil Ofis Ekle
            </h3>
            
            <form onSubmit={handleCreateOffice} className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div>
                <select
                  value={newOfficeBrand}
                  onChange={(e) => setNewOfficeBrand(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer font-medium text-slate-700"
                >
                  <option value="Coldwell Banker">Coldwell Banker</option>
                  <option value="Century 21">Century 21</option>
                  <option value="ERA">ERA</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="OF1001"
                  value={newOfficeId}
                  onChange={(e) => setNewOfficeId(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Ofis Adı"
                  value={newOfficeName}
                  onChange={(e) => setNewOfficeName(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Ofis Sahibi"
                  value={newOfficeOwner}
                  onChange={(e) => setNewOfficeOwner(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="E-posta"
                    value={newOfficeEmail}
                    onChange={(e) => setNewOfficeEmail(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white p-1.5 rounded transition flex items-center justify-center shrink-0 cursor-pointer"
                    title="Ekle"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Custom Multi-Brand Multi-File Excel Upload Interface */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Ofis Listesi Yükleme Paneli (Aynı Anda 3 Marka)
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                İlgili markanın Excel dosyasını kendi slotuna yerleştirerek 3 markayı aynı anda toplu olarak yükleyebilirsiniz.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Coldwell Banker Slot */}
              <div className="border border-slate-200/80 rounded-lg p-3 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider font-mono">Coldwell Banker</span>
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3">CB ofislerini içeren Excel dosyası</p>
                </div>
                
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  ref={cbInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCbFile(e.target.files[0]);
                    }
                  }}
                  disabled={loading}
                />

                {cbFile ? (
                  <div className="flex items-center justify-between bg-blue-50/50 border border-blue-200 rounded p-1.5 text-xs text-blue-800">
                    <span className="truncate max-w-[120px] font-medium text-[11px]" title={cbFile.name}>{cbFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCbFile(null);
                        if (cbInputRef.current) cbInputRef.current.value = "";
                      }}
                      className="text-blue-500 hover:text-red-500 transition-colors p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => cbInputRef.current?.click()}
                    className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs py-2 px-3 rounded font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    disabled={loading}
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    Dosya Seç...
                  </button>
                )}
              </div>

              {/* Century 21 Slot */}
              <div className="border border-slate-200/80 rounded-lg p-3 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider font-mono font-bold">Century 21</span>
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3">C21 ofislerini içeren Excel dosyası</p>
                </div>

                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  ref={c21InputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setC21File(e.target.files[0]);
                    }
                  }}
                  disabled={loading}
                />

                {c21File ? (
                  <div className="flex items-center justify-between bg-amber-50/50 border border-amber-200 rounded p-1.5 text-xs text-amber-800">
                    <span className="truncate max-w-[120px] font-medium text-[11px]" title={c21File.name}>{c21File.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setC21File(null);
                        if (c21InputRef.current) c21InputRef.current.value = "";
                      }}
                      className="text-amber-500 hover:text-red-500 transition-colors p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => c21InputRef.current?.click()}
                    className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs py-2 px-3 rounded font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    disabled={loading}
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    Dosya Seç...
                  </button>
                )}
              </div>

              {/* ERA Slot */}
              <div className="border border-slate-200/80 rounded-lg p-3 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider font-mono font-bold">ERA Real Estate</span>
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3">ERA ofislerini içeren Excel dosyası</p>
                </div>

                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  ref={eraInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEraFile(e.target.files[0]);
                    }
                  }}
                  disabled={loading}
                />

                {eraFile ? (
                  <div className="flex items-center justify-between bg-rose-50/50 border border-rose-200 rounded p-1.5 text-xs text-rose-800">
                    <span className="truncate max-w-[120px] font-medium text-[11px]" title={eraFile.name}>{eraFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEraFile(null);
                        if (eraInputRef.current) eraInputRef.current.value = "";
                      }}
                      className="text-rose-500 hover:text-red-500 transition-colors p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => eraInputRef.current?.click()}
                    className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs py-2 px-3 rounded font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    disabled={loading}
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    Dosya Seç...
                  </button>
                )}
              </div>
            </div>

            {/* Detailed Upload Report */}
            {uploadReport && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-green-100 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">Son Yükleme Detay Raporu</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadReport(null)}
                    className="text-slate-400 hover:text-slate-600 transition p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Newly Added List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">
                        {uploadReport.added} Yeni Ofis Eklendi
                      </span>
                    </div>
                    {uploadReport.addedList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Sistemde olmayan yeni bir ofis kaydı tespit edilmedi.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto border border-slate-200/60 rounded bg-white divide-y divide-slate-100">
                        {uploadReport.addedList.map((o, idx) => (
                          <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono bg-slate-100 px-1 py-0.2 rounded font-bold text-slate-700">{o.id}</span>
                              <span className="truncate text-slate-800 font-medium">{o.name}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium shrink-0 font-sans">{o.brand}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Updated/Duplicate List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                        {uploadReport.updated} Ofis Bilgisi Güncellendi
                      </span>
                    </div>
                    {uploadReport.updatedList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Var olan ofislerde herhangi bir güncelleme veya mükerrer kayıt bulunmuyor.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto border border-slate-200/60 rounded bg-white divide-y divide-slate-100">
                        {uploadReport.updatedList.map((o, idx) => (
                          <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono bg-slate-100 px-1 py-0.2 rounded font-bold text-slate-700">{o.id}</span>
                              <span className="truncate text-slate-800 font-medium">{o.name}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 font-medium shrink-0 font-sans">{o.brand}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[9px] text-slate-400 leading-relaxed mt-1">
                      💡 <strong>Neden Güncellendi?</strong> Sistemde zaten yüklü bulunan ofisler (örneğin başlangıçtaki varsayılan ofisler) tekrar yüklendiğinde ya da Excel dosyasındaki mükerrer kayıtlar işlendiğinde bu grupta listelenir. Mevcut grup/ofis bağları asla bozulmaz.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action and hints */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span><strong>Zorunlu Sütun Başlıkları:</strong> <em>Ofis Kodu, Durum, Ad, E-Posta, Sorumlu Sistem Kullanıcısı</em></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Türkçe karakterlerin tamamı ve başlık boşlukları otomatik olarak çözümlenir.</span>
                </div>
              </div>

              {(cbFile || c21File || eraFile) && (
                <button
                  type="button"
                  onClick={handleBulkBrandUpload}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-5 rounded shadow-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                >
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Seçilen Dosyaları Yükle ve İşle
                </button>
              )}
            </div>
          </div>

          {/* Office Directory & Assignment */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap justify-between items-center gap-3">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                Ofis Yönetim Envanteri ({filteredOffices.length})
              </h3>
              
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Brand Filter */}
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="text-[11px] border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="ALL">Tüm Markalar</option>
                  <option value="Coldwell Banker">Coldwell Banker</option>
                  <option value="Century 21">Century 21</option>
                  <option value="ERA">ERA</option>
                  <option value="Diğer">Diğer</option>
                </select>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Kod, ad, sorumlu veya e-postaya göre ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-[11px] pl-8 pr-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Ofis Kodu / Adı</th>
                    <th className="px-3 py-2 font-semibold">Marka / Durum</th>
                    <th className="px-3 py-2 font-semibold">Sorumlu & İletişim</th>
                    <th className="px-3 py-2 font-semibold">Mevcut Grubu</th>
                    <th className="px-3 py-2 font-semibold text-right">Eylemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOffices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        Aranan kriterlere uygun ofis kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredOffices.map((office) => {
                      const groupOfOffice = groups.find(g => g.id === office.groupId);
                      return (
                        <tr key={`${office.id}-${office.brand}`} className="hover:bg-slate-50/40 transition">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] bg-slate-100 border border-slate-200/50 font-bold px-1.5 py-0.5 rounded text-slate-700">
                                {office.id}
                              </span>
                              <div className="font-semibold text-slate-850">{office.name}</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-slate-700 font-medium">
                              {office.brand || "Belirsiz"}
                            </div>
                            <div className={`text-[10px] font-bold ${office.status?.toLowerCase() === "aktif" ? "text-emerald-600" : office.status?.toLowerCase() === "pasif" ? "text-rose-600" : "text-slate-400"}`}>
                              {office.status || "-"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-slate-700 font-medium">
                              {office.responsibleUser || office.ownerName || "Atanmamış"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{office.ownerEmail || "-"}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={office.groupId || ""}
                                onChange={(e) => handleAssignToGroup(office.id, office.brand || "", e.target.value || null)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded p-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
                              >
                                <option value="">Bağımsız Ofis</option>
                                {groups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name} ({g.id})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteOffice(office.id, office.brand || "")}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Ofisi Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
