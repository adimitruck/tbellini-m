'use client';
import type { ReactElement } from 'react';
export interface ErrorProps { error: Error & { digest?: string }; reset(): void }
export default function ErrorBoundary({ reset }: ErrorProps): ReactElement { return <main className="content"><h1>The archive could not open.</h1><p>Your saved records are still in storage. Try opening the page again.</p><button onClick={reset}>Try again</button></main>; }
