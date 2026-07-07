import React, { useState, useEffect } from "react";
import { EmailLog, AppConfig } from "../types";
import { Mail, CheckCircle2, AlertTriangle, Play, HelpCircle, Eye, Settings, RefreshCw, ChevronRight } from "lucide-react";

interface EmailSimulatorProps {
  emails: EmailLog[];
  config: AppConfig;
  onSaveConfig: (cfg: AppConfig) => Promise<{ success: boolean; message: string }>;
  onRefresh: () => void;
}

export default function EmailSimulator({ emails, config, onSaveConfig, onRefresh }: EmailSimulatorProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "settings">("history");
  
  // Settings edit state
  const [resendKey, setResendKey] = useState(config.resendApiKey || "");
  const [brevoKey, setBrevoKey] = useState(config.brevoApiKey || "");
  const [sender, setSender] = useState(config.senderEmail || "denetim@masterturk.com");
  const [smtpEnabled, setSmtpEnabled] = useState(config.smtpEnabled || false);
  const [smtpHost, setSmtpHost] = useState(config.smtpHost || "smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(config.smtpPort || 465);
  const [smtpSecure, setSmtpSecure] = useState(config.smtpSecure !== false);
  const [smtpUser, setSmtpUser] = useState(config.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState(config.smtpPass || "");

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setResendKey(config.resendApiKey || "");
    setBrevoKey(config.brevoApiKey || "");
    setSender(config.senderEmail || "denetim@masterturk.com");
    setSmtpEnabled(config.smtpEnabled || false);
    setSmtpHost(config.smtpHost || "smtp.gmail.com");
    setSmtpPort(config.smtpPort || 465);
    setSmtpSecure(config.smtpSecure !== false);
    setSmtpUser(config.smtpUser || "");
    setSmtpPass(config.smtpPass || "");
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);
    try {
      const result = await onSaveConfig({
        resendApiKey: resendKey.trim(),
        brevoApiKey: brevoKey.trim(),
        senderEmail: sender.trim(),
        smtpEnabled,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort),
        smtpSecure,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim()
      });
      if (result.success) {
        setSaveStatus({ success: true, message: result.message });
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus({ success: false, message: result.message });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: "Hata: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const [testRecipient, setTestRecipient] = useState("denetim@masterturk.com.tr");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/config/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testRecipient.trim() })
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        throw new Error(text || "Sunucu geçersiz veya boş bir yanıt döndürdü.");
      }

      if (res.ok && data.success) {
        if (data.status === "Simüle Edildi") {
          setTestResult({ success: true, message: "Test e-postası başarıyla simüle edildi! (E-posta servisiniz aktif olmadığı için giden kutusu arşivine eklendi.)" });
        } else {
          setTestResult({ success: true, message: "Test e-postası başarıyla gönderildi! Lütfen gelen kutunuzu ve spam klasörünüzü kontrol edin." });
        }
        onRefresh();
      } else {
        const errMsg = data.errorDetails || data.error || data.message || "Gönderim başarısız oldu. API bağlantı ayarlarınızı kontrol edin.";
        setTestResult({ success: false, message: errMsg });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: "İstek hatası: " + err.message });
    } finally {
      setTestSending(false);
    }
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
          /* Locked System Email Configuration Display */
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                    Sistem E-Posta Bağlantısı
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Aktif ve Gömülü
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Denetim uyarı e-postalarının sorunsuz gönderilmesi için kurumsal e-posta hesabınız sistem altyapısına doğrudan gömülmüştür. Herhangi bir ek ayar yapmanız gerekmez.
                </p>
              </div>

              <div className="p-4 space-y-3 bg-white">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Gönderici E-posta</span>
                    <span className="font-mono text-slate-800 font-semibold">denetim@masterturk.com.tr</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">SMTP Sunucu (Host)</span>
                    <span className="font-mono text-slate-800 font-semibold">smtp.gmail.com</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">SMTP Port</span>
                    <span className="font-mono text-slate-800 font-semibold">587 (STARTTLS) / 465 (SSL)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">SMTP Kullanıcı Adı</span>
                    <span className="font-mono text-slate-800 font-semibold">denetim@masterturk.com.tr</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400 font-medium">Uygulama Şifresi</span>
                    <span className="font-mono text-slate-800 font-semibold">fucaupikpfrrhzzs</span>
                  </div>
                </div>

                <div className="mt-3 p-2.5 bg-slate-50 rounded border border-slate-100 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
                  <span className="text-blue-500 font-bold shrink-0">ℹ️</span>
                  <span>SMTP ayarları arka planda optimize edilmiştir. Güvenli bağlantılar Vercel serverless limitlerine takılmaması için otomatik olarak Port 587 ve Port 465 arasında yedekli çalışmaktadır.</span>
                </div>
              </div>
            </div>

            {/* Connection Test Form */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                  Bağlantı ve Gönderim Testi
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Ayarlarınızı kaydettikten sonra, API bağlantısının çalıştığını doğrulamak için hızlıca bir test e-postası gönderebilirsiniz.
                </p>
              </div>
              <form onSubmit={handleSendTestEmail} className="p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Alıcı E-posta Adresi
                  </label>
                  <input
                    type="email"
                    placeholder="ornek@alanadi.com"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    required
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <p className="text-[10px] text-amber-600 mt-1 leading-normal">
                    {smtpEnabled 
                      ? "⚡ SMTP modunda dilediğiniz herhangi bir gerçek e-posta adresine doğrudan test gönderebilirsiniz."
                      : "⚠️ Resend sandbox modunda sadece doğrulanmış alıcı e-posta adreslerinize gönderim yapabilirsiniz."
                    }
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={testSending}
                  className={`w-full text-white font-bold text-xs py-2 px-3 rounded shadow-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                    testSending ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {testSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Test E-postası Gönder
                    </>
                  )}
                </button>

                {testResult && (
                  <div className={`p-3 rounded text-[11px] font-medium leading-relaxed border ${
                    testResult.success ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}>
                    {testResult.success ? (
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{testResult.message}</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span className="font-mono text-[10px]">{testResult.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
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
