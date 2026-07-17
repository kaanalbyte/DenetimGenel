import React, { useState } from "react";
import { Office, Group, AppConfig, AuditPeriod } from "../types";

interface BetaTesterProps {
  offices: Office[];
  groups: Group[];
  config: AppConfig;
  activeAudit: AuditPeriod | null;
}

export default function BetaTester({ offices, groups, config, activeAudit }: BetaTesterProps) {
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");
  const [manualEmails, setManualEmails] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);

  const selectedOffice = offices.find((o) => o.id === selectedOfficeId);

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 800);
  };

  const calculateRecipients = () => {
    if (!selectedOffice) return null;

    // 1-Adım: Ofisin Kendi E-postası (Marka Ofis Tanımı)
    const officeEmail = selectedOffice.ownerEmail;

    // 2-Adım: Excel Listesindeki Broker & Owner E-postaları
    const step2Emails = selectedOffice.brokerEmails 
      ? selectedOffice.brokerEmails.split(",").map((e: string) => e.trim()).filter((e: string) => e.includes("@"))
      : [];

    // 3-Adım: Sorumlu Saha Personeli (Field Staff)
    const fieldStaffName = selectedOffice.responsibleUser;
    const fieldStaffEmail = config.fieldStaffEmails?.[fieldStaffName] || "";

    // 4-Adım: Sabit Yönetici / CC E-postası (Manager Email)
    const managerEmail = config.managerEmail || "";

    // 5-Adım: Manuel Ek Alıcılar
    const manualArr = manualEmails.split(",").map(e => e.trim()).filter(e => e.includes("@"));

    return {
      officeEmail,
      step2Emails,
      fieldStaffEmail,
      managerEmail,
      manualArr
    };
  };

  const res = calculateRecipients();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">E-Posta Test Ekranı (Beta)</h2>
            <p className="text-xs text-slate-500 mt-1">Firebase güncel ofis ve grup verileriyle mail gönderim şemasını simüle edin.</p>
          </div>
          <div className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold uppercase tracking-wider">
            Canlı Simülasyon
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Ofis Seçin</label>
              <select
                value={selectedOfficeId}
                onChange={(e) => setSelectedOfficeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-colors"
              >
                <option value="">-- Ofis Seçin --</option>
                {groups.map(g => (
                  <optgroup key={g.id} label={`Grup: ${g.name} (${g.id})`}>
                    {offices.filter(o => o.groupId === g.id).map(o => (
                      <option key={o.id} value={o.id}>{o.id} - {o.name} ({o.brand})</option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="Bağımsız Ofisler">
                  {offices.filter(o => !o.groupId).map(o => (
                    <option key={o.id} value={o.id}>{o.id} - {o.name} ({o.brand})</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Manuel Ek Alıcılar (Virgülle Ayırın)</label>
              <input
                type="text"
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                placeholder="ornek@test.com, ikincimail@test.com"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            <button
              onClick={handleSimulate}
              disabled={!selectedOfficeId || isSimulating}
              className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-2.5 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSimulating ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
              {isSimulating ? "Hesaplanıyor..." : "Şemayı Simüle Et"}
            </button>

            {selectedOffice && (
              <div className="bg-slate-50 border border-slate-200 rounded p-4 mt-6">
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mb-3">Seçili Ofis Bilgileri</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500">Ofis Kodu:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedOffice.id}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500">Durum:</span>
                    <span className={`font-bold ${selectedOffice.status.includes("Aktif") ? "text-emerald-600" : "text-rose-600"}`}>{selectedOffice.status}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500">Sorumlu Saha Pers:</span>
                    <span className="font-medium text-slate-800">{selectedOffice.responsibleUser || "-"}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-slate-500">Grup / Kardeş:</span>
                    <span className="font-medium text-slate-800">
                      {selectedOffice.groupId ? groups.find(g => g.id === selectedOffice.groupId)?.name || selectedOffice.groupId : "Bağımsız"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="bg-slate-900 rounded-lg p-5 text-white h-full shadow-inner relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
                 <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </div>

              <h3 className="text-sm font-bold border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Giden Posta Şeması
              </h3>

              {!res ? (
                <div className="h-48 flex items-center justify-center text-slate-500 text-xs italic">
                  Sol taraftan bir ofis seçerek simülasyonu başlatın.
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">1. Adım: Ofis Kendi E-Postası</div>
                    <div className="font-medium text-blue-300 break-all">
                      {res.officeEmail ? res.officeEmail : <span className="text-slate-500 italic">Tanımlı değil</span>}
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">2. Adım: Excel Broker/Owner (Panel Kişi)</div>
                      <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        Sistemden çekildi
                      </span>
                    </div>
                    {res.step2Emails.length > 0 ? (
                      <ul className="list-disc list-inside font-medium text-emerald-300">
                        {res.step2Emails.map((e, i) => <li key={i} className="break-all">{e}</li>)}
                      </ul>
                    ) : (
                      <span className="text-slate-500 italic font-medium">Bulunamadı</span>
                    )}
                  </div>

                  <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">3. Adım: Saha Personeli (CC)</div>
                    <div className="font-medium text-amber-300 break-all">
                      {res.fieldStaffEmail ? `${selectedOffice?.responsibleUser} -> ${res.fieldStaffEmail}` : <span className="text-slate-500 italic">Kayıtlı değil</span>}
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">4. Adım: Sabit Yönetici (CC)</div>
                    <div className="font-medium text-purple-300 break-all">
                      {res.managerEmail ? res.managerEmail : <span className="text-slate-500 italic">Tanımlı değil</span>}
                    </div>
                  </div>

                  {res.manualArr.length > 0 && (
                    <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">5. Adım: Arayüz Ek Alıcılar (Manuel)</div>
                      <ul className="list-disc list-inside font-medium text-white">
                        {res.manualArr.map((e, i) => <li key={i} className="break-all">{e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
