'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const AUTH_COOKIE_NAME = "gh-auth";

const setAuthCookie = (token: string) => {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = 60 * 60; // 1 hour
  document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

const clearAuthCookie = () => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setLoading(false);
      console.warn(
        "Auth is not configured. Check your NEXT_PUBLIC_FIREBASE_* environment variables."
      );
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  useEffect(() => {
    if (!user) {
      clearAuthCookie();
      return;
    }

    user
      .getIdToken()
      .then((token) => {
        setAuthCookie(token);
      })
      .catch((error) => {
        console.warn("Failed to refresh auth cookie", error);
      });
  }, [user]);

  const handleSignOut = useCallback(async () => {
    if (!auth) {
      return;
    }

    await firebaseSignOut(auth);
    clearAuthCookie();
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signOut: handleSignOut,
    }),
    [user, loading, handleSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
