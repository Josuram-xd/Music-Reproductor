import type { Metadata } from "next";
import { Nunito, Pixelify_Sans } from "next/font/google";
import "./globals.css";

/** Headings, buttons and labels: the pixel-art voice of the app. */
const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
});

/** Body text stays a smooth, very readable font. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Purrlist",
  description: "Tu reproductor musical kawaii, nya~",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${pixel.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
