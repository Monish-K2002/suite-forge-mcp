import type { ReactNode } from "react";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import LayoutClient from "./components/LayoutClient";

// Top-level providers belong here so every screen can use the same theme and app chrome.
export default function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <DarkModeProvider>
      <LayoutClient>{children}</LayoutClient>
    </DarkModeProvider>
  );
}
