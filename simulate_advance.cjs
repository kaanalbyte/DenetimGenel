const http = require("http");

const payload = {
  approvedDanismanIds: ["OF10620:::C21 ASİL"],
  approvedIlanIds: ["G102"],
  detailsMap: {
    "OF10620:::C21 ASİL_danisman": "Deneme danışman detayı",
    "G102_ilan": "Deneme ilan detayı"
  },
  config: {
    senderEmail: "denetim@masterturk.com.tr",
    smtpEnabled: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "denetim@masterturk.com.tr"
  },
  offices: [
    {
      id: "OF10620",
      name: "C21 ASİL",
      brand: "Century 21",
      ownerEmail: "denetim@masterturk.com.tr",
      ownerName: "Kaan Albayrak"
    }
  ],
  groups: [
    {
      id: "G102",
      name: "ERA REFERANS",
      ownerEmail: "denetim@masterturk.com.tr",
      ownerName: "Denetim"
    }
  ],
  activeAudit: {
    id: "AUD_123",
    name: "Haziran 2026",
    status: "Aktif",
    currentPhase: "Tespit",
    phase1DanismanRaw: [],
    phase1IlanPanelRaw: [],
    phase1IlanSahibindenRaw: [],
    phase1KacakDanismanRaw: [],
    phase1KullaniciRaw: []
  }
};

const reqData = JSON.stringify(payload);

const req = http.request({
  hostname: "localhost",
  port: 3000,
  path: "/api/audits/active/advance",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(reqData)
  }
}, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    console.log("Status Code:", res.statusCode);
    console.log("Response Body:", body);
  });
});

req.on("error", err => console.error("Error:", err));
req.write(reqData);
req.end();
