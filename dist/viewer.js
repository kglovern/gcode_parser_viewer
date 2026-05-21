import { G as r, a as d, V as i, d as c, b as s } from "./GCodeSVGRenderer-B3Yor_nk.js";
const a = {
  dark: {
    background: "#111827",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#0ef6ae",
      cutting: "#3e85c7",
      laser: "#a855f7",
      processed: "#6b7280",
      boundingBox: "#77a9d7",
      grid: { major: "#2f3840", minor: "#1f252b" },
      axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" }
    }
  },
  light: {
    background: "#e5e7eb",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#295d8d",
      cutting: "#111827",
      laser: "#FF0000",
      processed: "#9ca3af",
      boundingBox: "#5191cc",
      grid: { major: "#77a9d7", minor: "#a8c6e4" },
      axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" }
    }
  },
  "flexoki-dark": {
    background: "#100f0f",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#DA702C",
      cutting: "#3AA99F",
      laser: "#8B7EC8",
      processed: "#6f6e69",
      boundingBox: "#da702c",
      grid: { major: "#403e3c", minor: "#282726" },
      axes: { x: "#d14d41", y: "#879a39", z: "#4385be" }
    }
  },
  "tokyo-night": {
    background: "#1a1b26",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#ff9e64",
      cutting: "#7dcfff",
      laser: "#bb9af7",
      processed: "#565f89",
      boundingBox: "#73daca",
      grid: { major: "#414868", minor: "#24283b" },
      axes: { x: "#f7768e", y: "#9ece6a", z: "#7aa2f7" }
    }
  },
  "gruvbox-light": {
    background: "#fbf1c7",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#d65d0e",
      cutting: "#3c3836",
      laser: "#b16286",
      processed: "#928374",
      boundingBox: "#076678",
      grid: { major: "#d5c4a1", minor: "#ebdbb2" },
      axes: { x: "#cc241d", y: "#98971a", z: "#458588" }
    }
  },
  "ayu-dark": {
    background: "#0b0e14",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#FFA659",
      cutting: "#73D0FF",
      laser: "#DFBFFF",
      processed: "#6E7C8F",
      boundingBox: "#95E6CB",
      grid: { major: "#242b38", minor: "#1a1f2b" },
      axes: { x: "#F28779", y: "#D5FF80", z: "#5CCFE6" }
    }
  },
  "ayu-light": {
    background: "#fafafa",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#FA8D3E",
      cutting: "#22A4E6",
      laser: "#A37ACC",
      processed: "#ADAEB1",
      boundingBox: "#5C6773",
      grid: { major: "#c9cacc", minor: "#e5e7ea" },
      axes: { x: "#F07171", y: "#86B300", z: "#55B4D4" }
    }
  }
};
export {
  r as GCodeSVGRenderer,
  d as GCodeViewer,
  i as ViewCube,
  c as defaultGCodeViewerOptions,
  s as defaultGCodeViewerTheme,
  a as gCodeViewerThemePresets
};
