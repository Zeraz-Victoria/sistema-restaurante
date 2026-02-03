/**
 * FIREBASE CONFIGURATION FILE
 * ---------------------------
 * Keys provided by user on 2026-02-03
 */

// Import from CDN for direct browser usage without bundlers
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDCV3U47chx0l3tsprhsfon_H1DOCVkPKI",
    authDomain: "restaurante-7001f.firebaseapp.com",
    projectId: "restaurante-7001f",
    storageBucket: "restaurante-7001f.firebasestorage.app",
    messagingSenderId: "396584238483",
    appId: "1:396584238483:web:852e7d849bbf2d3fb9bc66",
    measurementId: "G-MX6Q9LD512"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore and Storage instances
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log("Firebase initialized with project: restaurante-7001f");
