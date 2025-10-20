"use client"

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import { useState, useEffect } from "react";
import ConfigModal from "./components/ConfigModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { DarkModeProvider } from "./contexts/DarkModeContext";
import LayoutClient from "./components/LayoutClient";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen`}
      >
        <DarkModeProvider>
          <LayoutClient>{children}</LayoutClient>
        </DarkModeProvider>
      </body>
    </html>
  );
}