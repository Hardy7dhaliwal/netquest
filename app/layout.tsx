import type { Metadata } from "next";
import "./globals.css";
import Glossary from "@/components/glossary";

export const metadata: Metadata = {
  title: "NetQuest",
  description: "Interactive CCNP ENCOR learning missions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Glossary>{children}</Glossary>
      </body>
    </html>
  );
}
