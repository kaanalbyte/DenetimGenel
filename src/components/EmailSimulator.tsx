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

  const [testRecipient, setTestRecipient] = useState("");
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
          /* Email Integrations Settings */
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                  E-Posta Servis Modu
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Şirketinizin e-posta hesabı (Google Workspace) veya ücretsiz API servisleri ile gerçek gönderim yapabilirsiniz.
                </p>
              </div>
              <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSmtpEnabled(true)}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded border transition cursor-pointer text-center ${
                    smtpEnabled
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Doğrudan SMTP (Workspace / Gmail)
                </button>
                <button
                  type="button"
                  onClick={() => setSmtpEnabled(false)}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded border transition cursor-pointer text-center ${
                    !smtpEnabled
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  API Servisleri (Resend / Brevo)
                </button>
              </div>

              <form onSubmit={handleSave} className="p-4 space-y-3">
                {smtpEnabled ? (
                  /* SMTP Form */
                  <div className="space-y-3">
                    <div className="p-2.5 bg-blue-50 border border-blue-100 rounded text-[11px] text-blue-800 leading-relaxed mb-2">
                      <strong>💡 Google Workspace İpucu:</strong> Gmail veya @masterturk.com.tr kurumsal e-posta hesabınızla <strong>tamamen ücretsiz</strong> mail göndermek için:
                      <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                        <li>Google Hesabınızda 2 Adımlı Doğrulamayı açın.</li>
                        <li><strong>Uygulama Şifreleri (App Passwords)</strong> bölümünden bu portal için bir şifre üretin.</li>
                        <li>O şifreyi aşağıdaki "SMTP Şifre" kısmına girin.</li>
                      </ol>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        SMTP Sunucu Adresi (Host)
                      </label>
                      <input
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        required
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Port
                        </label>
                        <input
                          type="number"
                          placeholder="465"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                          required
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                        />
                      </div>
                      <div className="flex items-end pb-1.5">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={smtpSecure}
                            onChange={(e) => setSmtpSecure(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          Güvenli Bağlantı (SSL)
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        SMTP Kullanıcı Adı (E-posta)
                      </label>
                      <input
                        type="email"
                        placeholder="kaan.albayrak@masterturk.com.tr"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        required
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        SMTP Şifre (Uygulama Şifresi)
                      </label>
                      <input
                        type="password"
                        placeholder="xxxx xxxx xxxx xxxx"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        required
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Görünen Gönderici E-posta (Sender)
                      </label>
                      <input
                        type="email"
                        placeholder="kaan.albayrak@masterturk.com.tr"
                        value={sender}
                        onChange={(e) => setSender(e.target.value)}
                        required
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  /* API Keys Form */
                  <div className="space-y-3">
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
                  </div>
                )}

                {saveStatus && (
                  <div className={`p-2.5 rounded text-xs leading-relaxed ${saveStatus.success ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"}`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      {saveStatus.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      )}
                      {saveStatus.message}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className={`w-full font-bold text-xs py-2 px-3 rounded shadow-xs transition duration-150 cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    saving ? "bg-slate-400 text-slate-100 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : "Ayarları Kaydet"}
                </button>
              </form>
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
