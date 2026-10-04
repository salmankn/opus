export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#0b0d12", color: "#e8eaf0" }}>
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>{children}</main>
      </body>
    </html>
  );
}
