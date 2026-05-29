'use client';

import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiHttpError } from '@/lib/api-client';
import {
  STAFF_ROLE_LABELS,
  useCreateStaff,
  useSetStaffRoles,
  useSetUserStatus,
  useStaff,
  type AdminUser,
  type StaffRole,
} from '@/lib/api/management';
import { useAuthStore } from '@/lib/auth-store';

const ROLES = Object.keys(STAFF_ROLE_LABELS) as StaffRole[];

function errMsg(err: unknown): string {
  return err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка';
}

function fullName(u: AdminUser): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return n || u.email || u.id.slice(0, 8);
}

export default function StaffPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const isSuperAdmin = useAuthStore((s) => s.user?.roles.includes('SUPER_ADMIN') ?? false);
  const [search, setSearch] = useState('');
  const staff = useStaff({ search: search || undefined });
  const list = staff.data?.data ?? [];

  return (
    <div className="container space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Системные пользователи</h1>
        <p className="text-sm text-muted-foreground">Сотрудники платформы и их роли</p>
      </div>

      {isSuperAdmin ? (
        <CreateForm />
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Создание и смена ролей доступны только супер-админу. Сейчас режим просмотра.
        </div>
      )}

      <Input
        placeholder="Поиск по имени или email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {staff.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((u) => (
            <StaffRow key={u.id} user={u} canManage={isSuperAdmin} />
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сотрудников не найдено</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CreateForm() {
  const create = useCreateStaff();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<StaffRole>('CONTENT_MANAGER');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        email,
        password,
        role,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      toast.success('Сотрудник создан');
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 text-sm font-semibold">Новый сотрудник</div>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Email *">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Пароль * (мин. 8)">
            <Input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Роль *">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Имя">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Фамилия">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending}>
              Создать
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffRow({ user, canManage }: { user: AdminUser; canManage: boolean }) {
  const setRoles = useSetStaffRoles();
  const setStatus = useSetUserStatus();
  const [editing, setEditing] = useState(false);
  const current = (user.roles ?? []).map((r) => r.role) as StaffRole[];
  const [selected, setSelected] = useState<StaffRole[]>(current);

  function toggle(r: StaffRole) {
    setSelected((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  }

  async function saveRoles() {
    if (selected.length === 0) {
      toast.error('Нужна хотя бы одна роль');
      return;
    }
    try {
      await setRoles.mutateAsync({ id: user.id, roles: selected });
      toast.success('Роли обновлены');
      setEditing(false);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function toggleActive() {
    try {
      await setStatus.mutateAsync({ id: user.id, isActive: !user.isActive });
      toast.success(user.isActive ? 'Заблокирован' : 'Активирован');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{fullName(user)}</span>
              {!user.isActive ? <Badge variant="destructive">заблокирован</Badge> : null}
            </div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {current.length ? (
                current.map((r) => (
                  <Badge key={r} variant="secondary">
                    {STAFF_ROLE_LABELS[r] ?? r}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">нет ролей</span>
              )}
            </div>
          </div>
          {canManage ? (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                Роли
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleActive}
                disabled={setStatus.isPending}
              >
                {user.isActive ? 'Блок' : 'Актив'}
              </Button>
            </div>
          ) : null}
        </div>

        {editing && canManage ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ROLES.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(r)}
                    onChange={() => toggle(r)}
                    className="h-4 w-4 rounded border-input"
                  />
                  {STAFF_ROLE_LABELS[r]}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveRoles} disabled={setRoles.isPending}>
                Сохранить роли
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelected(current);
                  setEditing(false);
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
