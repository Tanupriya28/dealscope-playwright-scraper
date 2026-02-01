// app/layout.jsx
import "./globals.css";

export const metadata = {
  title: "DealScope",
  description: "Smart Discount Finder",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
