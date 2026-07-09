import React, { useState } from "react";
import { Office, Group } from "../types";
import { ExcelUploader } from "./ExcelUploader";
import { Plus, Users, Trash2, Building, Mail, User, Search, RefreshCw, ChevronRight } from "lucide-react";


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

  // New group state
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOwner, setNewGroupOwner] = useState("");
  const [newGroupEmail, setNewGroupEmail] = useState("");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");

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

  const handleDeleteOffice = async (id: string) => {
    if (!confirm("Bu ofisi silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/offices/${id}`, { method: "DELETE" });
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
    try {
      const defaultBrand = type === "ALL" ? "" : type;
      const res = await fetch("/api/offices/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offices: data, defaultBrand })
      });
      if (res.ok) {
        const result = await res.json();
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

  const handleAssignToGroup = async (officeId: string, groupId: string | null) => {
    const office = offices.find(o => o.id === officeId);
    if (!office) return;

    try {
      // Find all offices in the current group if any, update them
      let targetOfficeIds: string[] = [];
      if (groupId) {
        // Collect current members of this group + this office
        targetOfficeIds = offices
          .filter(o => o.groupId === groupId || o.id === officeId)
          .map(o => o.id);
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
        <div className="flex gap-3">
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
                            members.map(m => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 font-mono text-[9px] bg-slate-100 text-slate-600 border border-slate-200/50 px-1 py-0.5 rounded-sm"
                              >
                                {m.id}
                              </span>
                            ))
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
            
            <form onSubmit={handleCreateOffice} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <input
                  type="text"
                  required
                  placeholder="OF1009"
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

          {/* Office Excel Upload */}
          <ExcelUploader 
            onDataLoaded={handleOfficeExcelLoad} 
            isLoading={loading} 
            title="Ofis Listesi Yükle (Century 21, Coldwell Banker, ERA)"
            fileTypes={[
              { id: "ALL", label: "Tüm Markalar (Otomatik Algıla / Excel Sütunu)" },
              { id: "Coldwell Banker", label: "Coldwell Banker (Yüklenenleri CB olarak işaretle)" },
              { id: "Century 21", label: "Century 21 (Yüklenenleri C21 olarak işaretle)" },
              { id: "ERA", label: "ERA (Yüklenenleri ERA olarak işaretle)" }
            ]}
            hints={
              <div className="space-y-1">
                <p><strong>Zorunlu Sütun Başlıkları:</strong> <em>Ofis Kodu, Durum, Ad, E-Posta, Sorumlu Sistem Kullanıcısı</em></p>
                <p><strong>Seçmeli Sütun Başlığı:</strong> <em>Marka</em> (Eğer "Tüm Markalar" seçilirse ve Excel'de Marka sütunu yoksa, sistem Ofis Kodunun başındaki harflerden (CB, C21, ERA) otomatik eşleştirir).</p>
                <p className="text-blue-600 font-semibold">⚠️ Bilgi: Excel güncellendiğinde sistemdeki grup-ofis ilişkilendirmeleri asla zarar görmez, sadece ofis bilgileri güncellenir.</p>
              </div>
            }
          />

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
                        <tr key={office.id} className="hover:bg-slate-50/40 transition">
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
                                onChange={(e) => handleAssignToGroup(office.id, e.target.value || null)}
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
                              onClick={() => handleDeleteOffice(office.id)}
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
