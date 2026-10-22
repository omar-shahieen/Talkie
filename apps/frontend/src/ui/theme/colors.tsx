import { useColorMode } from "@chakra-ui/react";

export const colors = {
  white: "#FFFFFF",
  primary: "#7289DA",
  dark: "#FFFFFF", // Mapping 'dark' to white for text in dark mode
  darkLight: "#454545",
  darkMedium: "#2C2F33",
  darker: "#363738",

  lightGray: "#b9bbbe",
  grayLight: "#36393f",
  grayMedium: "#2f3136",
  grayDark: "#292b2f",
  grayDarkest: "#202225",

  // Semantic mappings
  textMain: "#FFFFFF",
  textDim: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  bgMain: "#36393f",
};

// Light mode colors - properly inverted for light theme
export const lightColors = {
  white: "#060607",
  primary: "#7289DA",
  dark: "#060607", // Text color - black for readability
  darkLight: "#E3E5E8", // Hover backgrounds - light gray
  darkMedium: "#FFFFFF", // Containers - white
  darker: "#F2F3F5",

  lightGray: "#4f5660", // Dim text
  grayLight: "#FFFFFF", // Main background - white
  grayMedium: "#F2F3F5", // Sidebar background - light gray
  grayDark: "#EBEDEF", // Slightly off-white
  grayDarkest: "#E3E5E8", // Darker gray for some accents
  
  // Semantic mappings
  textMain: "#060607",
  textDim: "rgba(6, 6, 7, 0.7)",
  textMuted: "rgba(6, 6, 7, 0.5)",
  bgMain: "#FFFFFF",
};

export function useThemedColors() {
  const { colorMode } = useColorMode();
  return colorMode === "dark" ? colors : lightColors;
}
