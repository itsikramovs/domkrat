'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useMe } from '@/lib/api/users';

export default function AccountPage() {
  const me = useMe();

  if (me.isLoading || !me.data) {
    return <div className="text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Профиль</h1>
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
