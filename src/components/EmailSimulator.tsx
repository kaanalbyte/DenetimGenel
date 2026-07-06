import React, { useState, useEffect } from "react";
import { EmailLog, AppConfig } from "../types";
import { Mail, CheckCircle2, AlertTriangle, Play, HelpCircle, Eye, Settings, RefreshCw, ChevronRight } from "lucide-react";

interface EmailSimulatorProps {
  emails: EmailLog[];
  config: AppConfig;
  onSaveConfig: (cfg: AppConfig) => void;
  onRefresh: () => void;
}

export default function EmailSimulator({ emails, config, onSaveConfig, onRefresh }: EmailSimulatorProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "settings">("history");
  
  // Settings edit state
  const [resendKey, setResendKey] = useState(config.resendApiKey);
  const [brevoKey, setBrevoKey] = useState(config.brevoApiKey);
  const [sender, setSender] = useState(config.senderEmail);

  useEffect(() => {
    setResendKey(config.resendApiKey);
    setBrevoKey(config.brevoApiKey);
    setSender(config.senderEmail);
  }, [config]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      resendApiKey: resendKey.trim(),
      brevoApiKey: brevoKey.trim(),
      senderEmail: sender.trim()
    });
  };

  // Set first email as selected by default if exists
  useEffect(() => {
    if (emails.length > 0 && !selectedEmail) {
      setSelectedEmail(emails[0]);
    }
  }, [emails, selectedEmail]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="email-center-panel">
      
      {/* Left Menu / Settings Area */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-xs flex gap-1.5">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded transition cursor-pointer ${
              activeTab === "history"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Giden Kutusu ({emails.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "settings"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            E-Posta Ayarları
          </button>
        </div>

        {activeTab === "settings" ? (
          /* Email Integrations Settings */
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                SMTP / Servis Bağlantısı
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Gerçek e-posta gönderimi için Resend ya da Brevo servislerinden birini bağlayabilirsiniz.
              </p>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Resend API Key (İsteğe Bağlı)
                </label>
                <input
                  type="password"
                  placeholder="re_xxxxxxxxxxxxxxxx"
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                />
              </div>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px]">
                  <span className="bg-white px-2 text-slate-400 font-bold uppercase font-mono">veya</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Brevo API Key (İsteğe Bağlı)
                </label>
                <input
                  type="password"
                  placeholder="xkeysib-xxxxxxxxxxxxxxxx"
                  value={brevoKey}
                  onChange={(e) => setBrevoKey(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Gönderici E-posta Adresi (Sender)
                </label>
                <input
                  type="email"
                  placeholder="denetim@masterturk.com"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Resend kullanıyorsanız, doğrulanmış alan adınıza ait bir e-posta girin. Boş bırakılırsa varsayılan test adresi kullanılır.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded shadow-xs transition duration-150 cursor-pointer"
              >
                Ayarları Kaydet
              </button>
            </form>
          </div>
        ) : (
          /* Email Outbox List */
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                Giden E-Posta Arşivi
              </h3>
              <button
                onClick={onRefresh}
                className="p-1 hover:bg-slate-100 rounded transition cursor-pointer"
                title="Yenile"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
              {emails.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Henüz gönderilmiş veya simüle edilmiş bir e-posta bulunmuyor.
                </div>
              ) : (
                emails.map((email) => {
                  const isSelected = selectedEmail?.id === email.id;
                  const date = new Date(email.timestamp).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <div
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`p-3 text-left transition duration-150 cursor-pointer ${
                        isSelected ? "bg-blue-50/40" : "hover:bg-slate-50/30"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
                            email.type === "Danışman" 
                              ? "bg-slate-800 text-white" 
                              : "bg-slate-600 text-white"
                          }`}>
                            {email.type}
                          </span>
                          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
                            email.stage === "Tespit"
                              ? "bg-blue-100 text-blue-800"
                              : email.stage === "Kontrol"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {email.stage}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">{date}</span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-800 mt-1.5 truncate">
                        {email.officeName}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                        Alıcı: {email.recipient}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                          {email.auditName}
                        </span>
                        
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                          email.status === "Gönderildi"
                            ? "text-emerald-600"
                            : email.status === "Simüle Edildi"
                            ? "text-blue-600"
                            : "text-rose-600"
                        }`}>
                          {email.status === "Gönderildi" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : email.status === "Simüle Edildi" ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {email.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right HTML Mail Preview Area */}
      <div className="lg:col-span-8">
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden h-full flex flex-col min-h-[500px]">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-600" />
                HTML Şablon ve Gönderim Önizleme
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Seçili franchise ofisine gönderilen nihai e-posta şablonunun piksel doğruluğunda çıktısı.
              </p>
            </div>
          </div>

          {selectedEmail ? (
            <div className="flex-1 flex flex-col bg-slate-50">
              {/* Mail Meta Header */}
              <div className="bg-white p-3.5 border-b border-slate-200 text-xs space-y-1 text-left">
                <div>
                  <span className="font-bold text-slate-400 mr-2 inline-block w-12 font-mono text-[10px] uppercase">Konu:</span>
                  <span className="font-bold text-slate-800">{selectedEmail.subject}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 mr-2 inline-block w-12 font-mono text-[10px] uppercase">Kime:</span>
                  <span className="font-bold text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded text-[10px] inline-block">
                    {selectedEmail.recipient}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 mr-2 inline-block w-12 font-mono text-[10px] uppercase">Tarih:</span>
                  <span className="text-slate-500 font-mono">{new Date(selectedEmail.timestamp).toLocaleString("tr-TR")}</span>
                </div>
                {selectedEmail.errorDetails && (
                  <div className="bg-rose-50 p-2 rounded text-rose-800 border border-rose-100 font-mono text-[10px] mt-2">
                    <strong>Hata Detayı:</strong> {selectedEmail.errorDetails}
                  </div>
                )}
              </div>

              {/* Iframe to securely render HTML template */}
              <div className="flex-1 p-3 flex items-center justify-center">
                <iframe
                  title="E-posta İçerik Önizleme"
                  srcDoc={selectedEmail.bodyHtml}
                  className="w-full h-[360px] border border-slate-200 rounded bg-white shadow-xs"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12 bg-slate-50">
              <Mail className="w-10 h-10 text-slate-300 mb-2" />
              <div className="text-xs font-semibold text-slate-700">Önizleme İçin Bir E-Posta Seçin</div>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs text-center leading-relaxed">
                Denetim Hunisi adımlarında mailleri gönderdiğinizde, gönderilen her şablon burada listelenir.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
