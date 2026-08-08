import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCNVF5oDsr0aD-siOFVz8IzjfS63Zg9akI",
  authDomain: "hip-vortex-r8phd.firebaseapp.com",
  projectId: "hip-vortex-r8phd",
  storageBucket: "hip-vortex-r8phd.firebasestorage.app",
  messagingSenderId: "298202193715",
  appId: "1:298202193715:web:1acc03ba411f27376fa846"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
// Set custom parameters if needed
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore with the custom databaseId from the config
export const db = getFirestore(app, "ai-studio-aadtracker-d846500e-1b9e-4231-b72b-a493439b9e5a");

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google', error);
    throw error;
  }
};

// Sign out
export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
    throw error;
  }
};
