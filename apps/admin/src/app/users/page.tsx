'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAdminUsers, useSetUserStatus } from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';

const ROLES = [
  '',
  'CUSTOMER',
  'MERCHANT',
  'ADMIN',
  'COURIER',
  'CONTENT_MANAGER',
  'FINANCE_MANAGER',
];

export default function UsersPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const users = useAdminUsers({ search: search || undefined, role: role || undefined });
  const setStatus = useSetUserStatus();

  async function toggle(id: string, isActive: boolean) {
    try {
      await setStatus.mutateAsync({ id, isActive });
      toast.success(isActive ? 'Активирован' : 'Заблокирован');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  const list = users.data?.data ?? [];

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Пользователи</h1>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Поиск: email, телефон, имя"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r || 'Все роли'}
            </option>
          ))}
        </select>
      </div>

      {users.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-3">Пользователь</th>
                  <th>Контакты</th>
                  <th>Роли</th>
                  <th>Статус</th>
                  <th className="p-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="text-muted-foreground">{u.email ?? u.phone ?? '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r, i) => (
                          <Badge key={i} variant="outline">
                            {r.role}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge variant={u.isActive ? 'success' : 'destructive'}>
                        {u.isActive ? 'активен' : 'заблокирован'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant={u.isActive ? 'outline' : 'default'}
                        onClick={() => toggle(u.id, !u.isActive)}
                        disabled={setStatus.isPending}
                      >
                        {u.isActive ? 'Заблокировать' : 'Активировать'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Не найдено
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
