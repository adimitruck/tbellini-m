import type { Metadata } from 'next';
import type { ReactNode, ReactElement } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'tbellini · Our shared moments',
  description: 'Shared TBellini events, people tagged on them, and your own Going and Interested calendar.',
};

export interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
