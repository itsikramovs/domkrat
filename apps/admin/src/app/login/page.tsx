'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/auth';
import { ApiHttpError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'CONTENT_MANAGER', 'SUPPORT_AGENT'];

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    try {
      const data = await authApi.login(values);
      const roles = data.user.roles ?? [];
      if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
        toast.error('У вас нет прав администратора');
        setSubmitting(false);
        return;
      }
      setTokens(data);
      toast.success('Добро пожаловать!');
      router.push('/dashboard');
    } catch (error) {
      const msg = error instanceof ApiHttpError ? error.body.message : 'Ошибка входа';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-12 min-h-[calc(100vh-100px)] flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Админ-панель</CardTitle>
            <CardDescription>
              Демо: <span className="font-mono">super@domkrat.uz / Test1234!</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Входим…' : 'Войти'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
