import './globals.css';

export const metadata = {
  title: '拉花日记本 — Latte Art Diary',
  description: '记录每一杯咖啡的拉花艺术，与朋友共享你的咖啡日记',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Caveat:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
