import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, terminate } from "firebase/firestore";

// Firebase Spark (Free Tier) Configuration - 100% Free, No Credit Card / Billing Required
const firebaseConfig = {
  apiKey: "AIzaSyCj3DLY9i3sjicmx3TUIaxfefU-ofEkkkE",
  authDomain: "denetim-genel-ca47b.firebaseapp.com",
  projectId: "denetim-genel-ca47b",
  storageBucket: "denetim-genel-ca47b.firebasestorage.app",
  messagingSenderId: "698035675578",
  appId: "1:698035675578:web:5e71e4c556c67936083d83"
};

/**
 * Loads the database document from Cloud Firestore.
 * This runs completely within the Spark Free Tier limits.
 */
export async function loadFromFirestore(): Promise<any> {
  const appName = `app-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const app = initializeApp(firebaseConfig, appName);
  const db = getFirestore(app);
  try {
    const docRef = doc(db, "app", "database");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("[Firebase] Veritabanı başarıyla Cloud Firestore üzerinden yüklendi.");
      return docSnap.data();
    } else {
      console.log("[Firebase] Firestore üzerinde veritabanı belgesi bulunamadı. İlk yazmada oluşturulacak.");
      return null;
    }
  } catch (err) {
    console.error("[Firebase] Firestore'dan veri yükleme hatası:", err);
    return null;
  } finally {
    try {
      await terminate(db);
      await deleteApp(app);
    } catch (e) {
      console.error("[Firebase] Clean up error:", e);
    }
  }
}

/**
 * Saves the database state to Cloud Firestore.
 * This runs completely within the Spark Free Tier limits.
 */
export async function saveToFirestore(data: any): Promise<boolean> {
  const appName = `app-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const app = initializeApp(firebaseConfig, appName);
  const db = getFirestore(app);
  try {
    const docRef = doc(db, "app", "database");
    // Deep clone the object and filter out any undefined fields to prevent Firestore serialization errors
    const serializedData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, serializedData);
    console.log("[Firebase] Veritabanı bulut yedeklemesi başarıyla Firestore'a kaydedildi.");
    return true;
  } catch (err) {
    console.error("[Firebase] Firestore'a veri yazma hatası:", err);
    return false;
  } finally {
    try {
      await terminate(db);
      await deleteApp(app);
    } catch (e) {
      console.error("[Firebase] Clean up error:", e);
    }
  }
}

