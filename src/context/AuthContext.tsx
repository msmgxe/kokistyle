"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAdmin: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const session = localStorage.getItem("kokistyle-admin");
      if (session === "true") {
        setIsAdmin(true);
      }
      setIsLoading(false);
    }
  }, []);

  const login = (pin: string): boolean => {
    if (pin === "1234") {
      setIsAdmin(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("kokistyle-admin", "true");
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("kokistyle-admin");
    }
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
