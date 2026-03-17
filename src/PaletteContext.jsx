import { createContext, useContext } from "react";
const PaletteContext = createContext({});
export const PaletteProvider = PaletteContext.Provider;
export const usePalette = () => useContext(PaletteContext);
