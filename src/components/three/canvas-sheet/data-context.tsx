import { createContext, useContext, useState } from "react";

export interface Data {
  id: string;
  x: number;
  y: number;
  color: any; // Use appropriate type for color if available
}

export interface DataContextType {
  data: Data[];
  setData: (data: Data[] | ((prevData: Data[]) => Data[])) => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

// Function overloads for proper type discrimination
export function useData(): Data[];
export function useData(id: string): Data | undefined;
export function useData(id?: string): Data[] | Data | undefined {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }

  if (id) {
    return context.data.find((item) => item.id === id);
  }

  return context.data;
}

export function DataProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Data[];
}) {
  const [data, setData] = useState<Data[]>(initial ?? []);

  return <DataContext.Provider value={{ data, setData }}>{children}</DataContext.Provider>;
}
