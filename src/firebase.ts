import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDocFromServer,
  type Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const env = (import.meta as any).env || {};
const readEnv = (key: string): string => {
  const val = env?.[key];
  return typeof val === 'string' ? val.trim() : '';
};

const resolvedFirebaseConfig = {
  ...firebaseConfig,
  ...(readEnv('VITE_FIREBASE_PROJECT_ID') ? { projectId: readEnv('VITE_FIREBASE_PROJECT_ID') } : {}),
  ...(readEnv('VITE_FIREBASE_APP_ID') ? { appId: readEnv('VITE_FIREBASE_APP_ID') } : {}),
  ...(readEnv('VITE_FIREBASE_API_KEY') ? { apiKey: readEnv('VITE_FIREBASE_API_KEY') } : {}),
  ...(readEnv('VITE_FIREBASE_AUTH_DOMAIN') ? { authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN') } : {}),
  ...(readEnv('VITE_FIREBASE_DATABASE_ID') ? { firestoreDatabaseId: readEnv('VITE_FIREBASE_DATABASE_ID') } : {}),
  ...(readEnv('VITE_FIREBASE_STORAGE_BUCKET') ? { storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET') } : {}),
  ...(readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') ? { messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') } : {})
};

const app = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);

function createFirestoreInstance(): Firestore {
  const dbId = resolvedFirebaseConfig.firestoreDatabaseId || '(default)';
  try {
    return initializeFirestore(
      app,
      { experimentalAutoDetectLongPolling: true },
      dbId
    );
  } catch {
    return getFirestore(app, dbId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = resolvedFirebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = resolvedFirebaseConfig.firestoreDatabaseId || '(default)';
export const ADMIN_EMAIL = readEnv('VITE_FIREBASE_ADMIN_EMAIL') || 'gyansaimathsiitcentertech@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
