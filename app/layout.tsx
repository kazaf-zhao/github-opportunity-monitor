import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitHub 机会雷达',
  description: '在 GitHub 项目成为主流之前，发现正在快速起飞的早期机会。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
