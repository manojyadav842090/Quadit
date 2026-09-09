import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AuditResult } from '../services/geminiService';

export const ADMIN_EMAIL = 'my8420090713@gmail.com';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID and auto-detect long polling for reliable connection in web environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || undefined);
} catch {
  firestoreInstance = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}
export const db = firestoreInstance;

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error Context: ', JSON.stringify(errInfo));
}

// Test connection on boot
export async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline') || error?.code === 'unavailable' || msg.includes('unavailable')) {
      console.info("Firestore client is connecting (operating in offline/reconnect mode).");
    } else {
      console.warn("Firestore connection check info:", msg);
    }
  }
}
testFirebaseConnection();

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  geminiApiKey?: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt: string;
}

export interface StoredAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  inputType: 'image' | 'text';
  snippet: string;
  result: AuditResult;
  createdAt: string;
  timestamp: number;
}

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Sign in with Google Popup
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  await syncUserProfile(user);
  return user;
}

// Sign in with Email / Password
export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const res = await signInWithEmailAndPassword(auth, email, pass);
  await syncUserProfile(res.user);
  return res.user;
}

// Sign up with Email / Password
export async function registerWithEmail(email: string, pass: string, name: string): Promise<FirebaseUser> {
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  if (name && res.user) {
    await updateProfile(res.user, { displayName: name });
  }
  await syncUserProfile(res.user, name);
  return res.user;
}

// Sync user record in Firestore
export async function syncUserProfile(user: FirebaseUser, overrideName?: string): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userDocRef);
  const now = new Date().toISOString();
  const isAdmin = isUserAdmin(user.email);

  if (userSnapshot.exists()) {
    const existing = userSnapshot.data() as UserProfile;
    const updated: Partial<UserProfile> = {
      lastLoginAt: now,
      displayName: user.displayName || overrideName || existing.displayName || 'User',
      photoURL: user.photoURL || existing.photoURL || '',
      email: user.email || existing.email,
      role: isAdmin ? 'admin' : (existing.role || 'user')
    };
    await setDoc(userDocRef, updated, { merge: true });
    return { ...existing, ...updated } as UserProfile;
  } else {
    const newProfile: UserProfile = {
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || overrideName || (user.email?.split('@')[0]) || 'User',
      photoURL: user.photoURL || '',
      geminiApiKey: '',
      role: isAdmin ? 'admin' : 'user',
      createdAt: now,
      lastLoginAt: now,
    };
    await setDoc(userDocRef, newProfile);
    return newProfile;
  }
}

// Fetch user profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
}

// Save custom Gemini API Key for user
export async function saveUserApiKey(userId: string, geminiApiKey: string): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, { geminiApiKey: geminiApiKey.trim() }, { merge: true });
}

// Save Audit Log to Firestore
export async function logAuditEntry(params: {
  user: FirebaseUser;
  inputType: 'image' | 'text';
  rawSnippet?: string;
  result: AuditResult;
}): Promise<string> {
  try {
    const auditLogsCol = collection(db, 'audit_logs');
    const snippet = params.rawSnippet 
      ? params.rawSnippet.slice(0, 300) 
      : (params.result.cleanSolution?.slice(0, 200) || 'Quantitative Question Audit');
    
    const newDoc = await addDoc(auditLogsCol, {
      userId: params.user.uid,
      userEmail: params.user.email || 'anonymous',
      userName: params.user.displayName || params.user.email?.split('@')[0] || 'User',
      userPhoto: params.user.photoURL || '',
      inputType: params.inputType,
      snippet: snippet,
      topic: params.result.topic || 'Quantitative Aptitude',
      subtopic: params.result.subtopic || '',
      myAnswerStatus: params.result.myAnswerStatus || 'unknown',
      markedAnswer: params.result.markedAnswer || '',
      isAbsurd: params.result.isAbsurd || 'No',
      cleanSolution: params.result.cleanSolution || '',
      hindiSolution: params.result.hindiSolution || '',
      auditSummary: params.result.auditSummary || '',
      solutionShouldBeChanged: params.result.solutionShouldBeChanged || '',
      questionShouldBeChanged: params.result.questionShouldBeChanged || '',
      correctedQuestion: params.result.correctedQuestion || '',
      hindiQuestion: params.result.hindiQuestion || '',
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      serverTimestamp: serverTimestamp()
    });
    return newDoc.id;
  } catch (error) {
    console.error("Failed to log audit in Firestore:", error);
    return '';
  }
}

function mapDocToResult(data: any): AuditResult {
  const res = data.result || {};
  return {
    cleanSolution: data.cleanSolution || res.cleanSolution || '',
    hindiSolution: data.hindiSolution || res.hindiSolution || '',
    myAnswerStatus: (data.myAnswerStatus || res.myAnswerStatus || 'wrong') as 'correct' | 'wrong',
    solutionShouldBeChanged: data.solutionShouldBeChanged || res.solutionShouldBeChanged || 'No',
    questionShouldBeChanged: data.questionShouldBeChanged || res.questionShouldBeChanged || 'No',
    auditSummary: data.auditSummary || res.auditSummary || '',
    correctedQuestion: data.correctedQuestion || res.correctedQuestion || data.snippet || '',
    hindiQuestion: data.hindiQuestion || res.hindiQuestion || '',
    isAbsurd: data.isAbsurd || res.isAbsurd || 'No',
    markedAnswer: data.markedAnswer || res.markedAnswer || '',
    topic: data.topic || res.topic || '',
    subtopic: data.subtopic || res.subtopic || ''
  };
}

// Fetch all audit logs (for Admin)
export async function fetchAllAuditLogs(maxCount: number = 200): Promise<StoredAuditLog[]> {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        userPhoto: data.userPhoto,
        inputType: data.inputType,
        snippet: data.snippet,
        createdAt: data.createdAt,
        timestamp: data.timestamp || 0,
        result: mapDocToResult(data)
      };
    });
  } catch (error) {
    console.error("Failed to fetch all audit logs:", error);
    // Fallback if index isn't ready or error
    const snap = await getDocs(collection(db, 'audit_logs'));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        userPhoto: data.userPhoto,
        inputType: data.inputType,
        snippet: data.snippet,
        createdAt: data.createdAt,
        timestamp: data.timestamp || 0,
        result: mapDocToResult(data)
      };
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
}

// Fetch logs for specific user
export async function fetchUserAuditLogs(userId: string): Promise<StoredAuditLog[]> {
  try {
    const q = query(
      collection(db, 'audit_logs'), 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        userPhoto: data.userPhoto,
        inputType: data.inputType,
        snippet: data.snippet,
        createdAt: data.createdAt,
        timestamp: data.timestamp || 0,
        result: mapDocToResult(data)
      };
    });
  } catch (error) {
    console.error("Failed to fetch user audit logs with ordering, trying unordered:", error);
    const q = query(
      collection(db, 'audit_logs'), 
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        userPhoto: data.userPhoto,
        inputType: data.inputType,
        snippet: data.snippet,
        createdAt: data.createdAt,
        timestamp: data.timestamp || 0,
        result: mapDocToResult(data)
      };
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
}

// Delete an audit log
export async function deleteAuditLog(logId: string): Promise<void> {
  await deleteDoc(doc(db, 'audit_logs', logId));
}

// Log out user
export async function userSignOut(): Promise<void> {
  await signOut(auth);
}
