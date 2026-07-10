const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyCj3DLY9i3sjicmx3TUIaxfefU-ofEkkkE",
  authDomain: "denetim-genel-ca47b.firebaseapp.com",
  projectId: "denetim-genel-ca47b",
  storageBucket: "denetim-genel-ca47b.firebasestorage.app",
  messagingSenderId: "698035675578",
  appId: "1:698035675578:web:5e71e4c556c67936083d83"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

async function run() {
  try {
    const docRef = doc(firestore, "app", "database");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const db = docSnap.data();
      console.log("Total audits in database:", (db.audits || []).length);
      (db.audits || []).forEach((a, i) => {
        console.log(`[Audit ${i}] Name: "${a.name}", Status: "${a.status}", Phase: "${a.currentPhase}"`);
        console.log(`  - phase1DanismanRaw: ${(a.phase1DanismanRaw || []).length} rows`);
        console.log(`  - phase1IlanPanelRaw: ${(a.phase1IlanPanelRaw || []).length} rows`);
        console.log(`  - phase1IlanSahibindenRaw: ${(a.phase1IlanSahibindenRaw || []).length} rows`);
        console.log(`  - phase1KacakDanismanRaw: ${(a.phase1KacakDanismanRaw || []).length} rows`);
        if ((a.phase1DanismanRaw || []).length > 0) {
          console.log(`  First few danisman rows:`, a.phase1DanismanRaw.slice(0, 3));
        }
      });
      
    } else {
      console.log("No database document found in Firestore.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

run();
