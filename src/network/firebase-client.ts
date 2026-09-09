import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
  firestore: Firestore;
  functions: Functions;
}

let services: FirebaseServices | undefined;
let emulatorsConnected = false;

function firebaseOptions(): FirebaseOptions {
  const options: FirebaseOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };
  if (!options.apiKey || !options.projectId || !options.appId || !options.databaseURL) {
    throw new Error('Firebase is not configured. See docs/FIREBASE_SOCIAL_SETUP.md.');
  }
  return options;
}

function connectEmulators(result: FirebaseServices): void {
  if (!import.meta.env.DEV || import.meta.env.VITE_FIREBASE_USE_EMULATORS !== 'true' || emulatorsConnected) {
    return;
  }
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(result.auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(result.firestore, host, 8080);
  connectDatabaseEmulator(result.database, host, 9000);
  connectFunctionsEmulator(result.functions, host, 5001);
  emulatorsConnected = true;
}

export function getFirebaseServices(): FirebaseServices {
  if (services) {
    return services;
  }
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseOptions());
  services = {
    app,
    auth: getAuth(app),
    database: getDatabase(app),
    firestore: getFirestore(app),
    functions: getFunctions(app),
  };
  connectEmulators(services);
  return services;
}
