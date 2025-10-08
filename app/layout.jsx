export const metadata = {
  title: "Pediatrack",
  description: "Plataforma de protocolos pediátricos"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
