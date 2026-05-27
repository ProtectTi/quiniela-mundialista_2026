import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "PEGA_TU_NUEVO_API_KEY",
  authDomain:        "PEGA_TU_NUEVO_PROJECT.firebaseapp.com",
  projectId:         "PEGA_TU_NUEVO_PROJECT_ID",
  storageBucket:     "PEGA_TU_NUEVO_PROJECT.firebasestorage.app",
  messagingSenderId: "PEGA_TU_NUEVO_SENDER_ID",
  appId:             "PEGA_TU_NUEVO_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);