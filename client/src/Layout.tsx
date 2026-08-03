import type { ReactNode } from "react";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import LayoutClient from "./components/LayoutClient";

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
