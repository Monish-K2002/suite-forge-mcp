import Navbar from "./components/Navbar";
import { useState, useEffect } from "react";
import ConfigModal from "./components/ConfigModal";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import LayoutClient from "./components/LayoutClient";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DarkModeProvider>
      <LayoutClient>{children}</LayoutClient>
    </DarkModeProvider>
  );
}