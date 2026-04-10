"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface BirthData {
  birthDate: string;
  birthTime: string;
}

interface InputContextType {
  birthData: BirthData;
  setBirthData: (data: BirthData) => void;
  resetBirthData: () => void;
}

const InputContext = createContext<InputContextType | undefined>(undefined);

export function InputProvider({ children }: { children: ReactNode }) {
  const [birthData, setBirthDataState] = useState<BirthData>({
    birthDate: "",
    birthTime: "",
  });

  const setBirthData = (data: BirthData) => {
    setBirthDataState(data);
  };

  const resetBirthData = () => {
    setBirthDataState({ birthDate: "", birthTime: "" });
  };

  return (
    <InputContext.Provider value={{ birthData, setBirthData, resetBirthData }}>
      {children}
    </InputContext.Provider>
  );
}

export function useInput() {
  const context = useContext(InputContext);
  if (context === undefined) {
    throw new Error("useInput must be used within an InputProvider");
  }
  return context;
}
