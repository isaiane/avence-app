import type { ReactNode } from "react";

export const metadata = {
  title: "Avence",
  description: "Avence — B2B2C WhatsApp-first",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}


