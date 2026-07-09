export interface Office {
  id: string; // Ofis Kodu (örn: OF1001)
  name: string; // Ofis Adı
  ownerName: string; // Ofis Sahibi
  ownerEmail: string; // Ofis E-posta
  groupId: string | null; // Bağlı olduğu Grup Ofis ID'si
  status?: string; // Durum
  responsibleUser?: string; // Sorumlu Sistem Kullanıcısı
  brand?: string; // Marka
}

export interface Group {
  id: string; // Grup Kodu (örn: G1)
  name: string; // Grup Adı
  ownerName: string; // Grup Sahibi (genelde ofislerle aynı)
  ownerEmail: string; // Grup E-posta
}

export interface EmailLog {
  id: string;
  timestamp: string;
  auditName: string;
  stage: "Tespit" | "Kontrol" | "Ceza";
  type: "Danışman" | "İlan";
  officeId: string;
  officeName: string;
  recipient: string;
  subject: string;
  bodyHtml: string;
  status: "Gönderildi" | "Simüle Edildi" | "Hata";
  errorDetails?: string;
}

export interface AuditPeriod {
  id: string;
  name: string;
  status: "Aktif" | "Tamamlandı";
  currentPhase: "Tespit" | "Kontrol" | "Ceza" | "Kapatıldı";
  createdAt: string;
  updatedAt: string;
  
  // Phase 1: Tespit
  phase1Uploaded: boolean;
  phase1DanismanRaw: any[];
  phase1IlanPanelRaw: any[];
  phase1IlanSahibindenRaw: any[];
  phase1KacakDanismanRaw?: any[];
  phase1ProblematicOffices: string[];
  phase1ApprovedOffices: string[];
  
  // Phase 2: Kontrol
  phase2Uploaded: boolean;
  phase2DanismanRaw: any[];
  phase2IlanPanelRaw: any[];
  phase2IlanSahibindenRaw: any[];
  phase2KacakDanismanRaw?: any[];
  phase2ProblematicOffices: string[];
  phase2ApprovedOffices: string[];
  
  // Phase 3: Ceza
  phase3ProblematicOffices: string[];
  phase3ApprovedOffices: string[];
}

export interface AppConfig {
  resendApiKey: string;
  brevoApiKey: string;
  senderEmail: string;
  smtpEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
}
