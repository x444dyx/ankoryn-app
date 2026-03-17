import "./globals.css";
export const metadata = {
  title: "Ankoryn",
  description: "Persistent AI Workspace OS"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#0b0f14",
          color: "#e6edf3",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, Segoe UI, Inter, Roboto, sans-serif",
          WebkitFontSmoothing: "antialiased"
        }}
      >
        {children}
      </body>
    </html>
  );
}