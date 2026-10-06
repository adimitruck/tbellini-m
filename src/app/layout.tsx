import type { Metadata } from 'next';
import type { ReactNode, ReactElement } from 'react';
import './globals.css';
export const metadata: Metadata = { title: 'tbellini · Our community moments', description: 'Shared TBellini events, user tagging, and your own Going and Interested calendar.' };
export interface RootLayoutProps { children: ReactNode }
export default function RootLayout({ children }: RootLayoutProps): ReactElement { return <html lang="en"><body>{children}</body></html>; }
