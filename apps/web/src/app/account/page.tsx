'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';
import { useMe } from '@/lib/api/users';

export default function AccountPage() {
  const me = useMe();
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  if (me.isLoading || !me.data) {
    return <div className="text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Профиль</h1>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            clear();
            router.push('/');
          }}
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
      <Card>
        <CardContent className="p-6 grid gap-3 sm:grid-cols-2">
          <Field label="Имя" value={me.data.firstName ?? '—'} />
          <Field label="Фамилия" value={me.data.lastName ?? '—'} />
          <Field label="Email" value={me.data.email ?? '—'} />
          <Field label="Телефон" value={me.data.phone ?? '—'} />
          <Field label="Роли" value={me.data.roles.join(', ')} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
