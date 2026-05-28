'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FinanceIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/finance/withdrawals');
  }, [router]);
  return null;
}
