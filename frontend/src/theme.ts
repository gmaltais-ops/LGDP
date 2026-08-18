// LGDP Design tokens — Dark-First Utility DARK w/ Glass & Luxe accents
import { Platform } from "react-native";

export const colors = {
  surface: "#0D0E12",
  surfaceSecondary: "#1C1D22",
  surfaceTertiary: "#26282E",
  onSurface: "#FFFFFF",
  onSurfaceSecondary: "#B4B5B9",
  onSurfaceTertiary: "#D1D3D8",
  brand: "#E52321",
  brandDark: "#8A1614",
  brandGold: "#D4AF37",
  brandGoldDim: "#8A6E1F",
  brandTertiary: "#3E1515",
  onBrand: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#26282E",
  borderStrong: "#3E414A",
  divider: "#1F2127",
  black: "#000000",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  pill: 999,
};

// Use system fonts with strong weights to emulate Barlow Condensed / Manrope
// Reliably works on Expo Go + preview without external font files.
export const fonts = {
  display: Platform.select({
    ios: "Impact",
    android: "sans-serif-condensed",
    default: "System",
  }) as string,
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System",
  }) as string,
};

export const typography = {
  displayXL: { fontFamily: fonts.display, fontSize: 40, fontWeight: "900" as const, letterSpacing: 0.5 },
  displayLG: { fontFamily: fonts.display, fontSize: 32, fontWeight: "900" as const, letterSpacing: 0.4 },
  displayMD: { fontFamily: fonts.display, fontSize: 24, fontWeight: "900" as const, letterSpacing: 0.3 },
  displaySM: { fontFamily: fonts.display, fontSize: 18, fontWeight: "800" as const, letterSpacing: 0.3 },
  body: { fontFamily: fonts.body, fontSize: 14, fontWeight: "400" as const },
  bodyBold: { fontFamily: fonts.body, fontSize: 14, fontWeight: "700" as const },
  caption: { fontFamily: fonts.body, fontSize: 12, fontWeight: "500" as const },
  label: { fontFamily: fonts.body, fontSize: 12, fontWeight: "700" as const, letterSpacing: 1, textTransform: "uppercase" as const },
};
