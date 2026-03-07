import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Real Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyDNw8J2qWJTnqrdq6RnkQp9PvrdUSHl1Ec",
  authDomain: "test-3d0f0.firebaseapp.com",
  projectId: "test-3d0f0",
  storageBucket: "test-3d0f0.firebasestorage.app",
  messagingSenderId: "1009279231392",
  appId: "1:1009279231392:web:5ab53fe8a3b7dcc024f0c5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
