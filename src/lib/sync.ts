import { db, auth } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { BankAccount, BankReEligibilityRule, VacationGoal, LoyaltyProgramBalance, UserProfile } from '../types';

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Save User Profile/Metadata
export async function saveUserProfile(uid: string, data: { email: string | null; displayName: string | null; photoURL: string | null }) {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      lastLogin: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch user-specific accounts from Firestore
export async function fetchAccountsFromFirestore(uid: string): Promise<BankAccount[]> {
  const path = `users/${uid}/accounts`;
  try {
    const querySnapshot = await getDocs(collection(db, 'users', uid, 'accounts'));
    const accounts: BankAccount[] = [];
    querySnapshot.forEach((docSnap) => {
      accounts.push(docSnap.data() as BankAccount);
    });
    return accounts;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

// Save single account to Firestore
export async function saveAccountToFirestore(uid: string, account: BankAccount) {
  const path = `users/${uid}/accounts/${account.id}`;
  try {
    const accountRef = doc(db, 'users', uid, 'accounts', account.id);
    await setDoc(accountRef, account);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Batch save multiple accounts
export async function saveAllAccountsToFirestore(uid: string, accounts: BankAccount[]) {
  const path = `users/${uid}/accounts`;
  try {
    const batch = writeBatch(db);
    accounts.forEach((acc) => {
      const accountRef = doc(db, 'users', uid, 'accounts', acc.id);
      batch.set(accountRef, acc);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete account from Firestore
export async function deleteAccountFromFirestore(uid: string, accountId: string) {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    const accountRef = doc(db, 'users', uid, 'accounts', accountId);
    await deleteDoc(accountRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch user-specific rules from Firestore
export async function fetchRulesFromFirestore(uid: string): Promise<BankReEligibilityRule[]> {
  const path = `users/${uid}/rules`;
  try {
    const querySnapshot = await getDocs(collection(db, 'users', uid, 'rules'));
    const rules: BankReEligibilityRule[] = [];
    querySnapshot.forEach((docSnap) => {
      rules.push(docSnap.data() as BankReEligibilityRule);
    });
    return rules;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

// Save single rule to Firestore
export async function saveRuleToFirestore(uid: string, rule: BankReEligibilityRule) {
  const path = `users/${uid}/rules/${rule.id}`;
  try {
    const ruleRef = doc(db, 'users', uid, 'rules', rule.id);
    await setDoc(ruleRef, rule);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Batch save multiple rules
export async function saveAllRulesToFirestore(uid: string, rules: BankReEligibilityRule[]) {
  const path = `users/${uid}/rules`;
  try {
    const batch = writeBatch(db);
    rules.forEach((rule) => {
      const ruleRef = doc(db, 'users', uid, 'rules', rule.id);
      batch.set(ruleRef, rule);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- MaxMyVacay Vacation Goals Firestore Sync ---

export async function fetchVacationGoalsFromFirestore(uid: string): Promise<VacationGoal[]> {
  const path = `users/${uid}/vacationGoals`;
  try {
    const querySnapshot = await getDocs(collection(db, 'users', uid, 'vacationGoals'));
    const goals: VacationGoal[] = [];
    querySnapshot.forEach((docSnap) => {
      goals.push(docSnap.data() as VacationGoal);
    });
    return goals;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveVacationGoalToFirestore(uid: string, goal: VacationGoal) {
  const path = `users/${uid}/vacationGoals/${goal.id}`;
  try {
    const goalRef = doc(db, 'users', uid, 'vacationGoals', goal.id);
    await setDoc(goalRef, goal);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAllVacationGoalsToFirestore(uid: string, goals: VacationGoal[]) {
  const path = `users/${uid}/vacationGoals`;
  try {
    const batch = writeBatch(db);
    goals.forEach((goal) => {
      const goalRef = doc(db, 'users', uid, 'vacationGoals', goal.id);
      batch.set(goalRef, goal);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteVacationGoalFromFirestore(uid: string, goalId: string) {
  const path = `users/${uid}/vacationGoals/${goalId}`;
  try {
    const goalRef = doc(db, 'users', uid, 'vacationGoals', goalId);
    await deleteDoc(goalRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- MaxMyVacay Loyalty Program Balances Firestore Sync ---

export async function fetchLoyaltyBalancesFromFirestore(uid: string): Promise<LoyaltyProgramBalance[]> {
  const path = `users/${uid}/loyaltyBalances`;
  try {
    const querySnapshot = await getDocs(collection(db, 'users', uid, 'loyaltyBalances'));
    const balances: LoyaltyProgramBalance[] = [];
    querySnapshot.forEach((docSnap) => {
      balances.push(docSnap.data() as LoyaltyProgramBalance);
    });
    return balances;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveLoyaltyBalanceToFirestore(uid: string, balance: LoyaltyProgramBalance) {
  const path = `users/${uid}/loyaltyBalances/${balance.id}`;
  try {
    const balanceRef = doc(db, 'users', uid, 'loyaltyBalances', balance.id);
    await setDoc(balanceRef, balance);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAllLoyaltyBalancesToFirestore(uid: string, balances: LoyaltyProgramBalance[]) {
  const path = `users/${uid}/loyaltyBalances`;
  try {
    const batch = writeBatch(db);
    balances.forEach((bal) => {
      const balanceRef = doc(db, 'users', uid, 'loyaltyBalances', bal.id);
      batch.set(balanceRef, bal);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLoyaltyBalanceFromFirestore(uid: string, balanceId: string) {
  const path = `users/${uid}/loyaltyBalances/${balanceId}`;
  try {
    const balanceRef = doc(db, 'users', uid, 'loyaltyBalances', balanceId);
    await deleteDoc(balanceRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch user profile from Firestore
export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// Save complete user profile to Firestore
export async function saveFullUserProfileToFirestore(uid: string, profile: UserProfile) {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...profile,
      uid,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
