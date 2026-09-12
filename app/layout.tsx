import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
const sans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
export const metadata: Metadata = { title: 'GitHub Opportunity Monitor', description: 'Find fast-growing GitHub repositories before they become mainstream.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html className="dark" lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html> }
