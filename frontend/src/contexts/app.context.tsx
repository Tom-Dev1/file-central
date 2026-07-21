import { useState } from "react";
import { AppContext, initialAppContext } from "./index";

export interface AppContextInterface {
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;

  //   setProfile: React.Dispatch<React.SetStateAction<User | null>>;
  reset: () => void;
}

export const AppProvider = ({
  children,
  defaultValue = initialAppContext,
}: {
  children: React.ReactNode;
  defaultValue?: AppContextInterface;
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(defaultValue.isAuthenticated);

  const reset = () => {
    setIsAuthenticated(false);
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        reset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
