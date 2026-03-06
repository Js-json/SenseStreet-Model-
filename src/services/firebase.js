import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Real Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyD4zztx_YRpbFYIHBQ--hYUnBnD9fTzD9Q",
  authDomain: "sensestreet-b8c2c.firebaseapp.com",
  projectId: "sensestreet-b8c2c",
  storageBucket: "sensestreet-b8c2c.firebasestorage.app",
  messagingSenderId: "323558503839",
  appId: "1:323558503839:web:5631f25a17a4bdba6df9aa"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
