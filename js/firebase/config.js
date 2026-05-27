import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmn1Hu69KrWM33dlhzLr3q6oDRwybiHeU",
  authDomain: "quiniela-mundialista-746ab.firebaseapp.com",
  projectId: "quiniela-mundialista-746ab",
  storageBucket: "quiniela-mundialista-746ab.firebasestorage.app",
  messagingSenderId: "720496448416",
  appId: "1:720496448416:web:167b169f30ca848f6e8ac5"
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);