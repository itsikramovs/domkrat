'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
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

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Код состоит из 6 цифр'),
});
type FormData = z.infer<typeof schema>;

export default function VerifyEmailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const e = params.get('email');
    if (e) setValue('email', e);
  }, [params, setValue]);

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    try {
      const data = await authApi.verifyEmail(values);
      setTokens(data);
      toast.success('Аккаунт подтверждён!');
      router.push('/');
    } catch (error) {
      const msg = error instanceof ApiHttpError ? error.body.message : 'Неверный код';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Подтверждение email</CardTitle>
        <CardDescription>
          Введите 6-значный код из письма. В dev — посмотрите{' '}
          <a className="text-primary underline" href="http://192.168.1.8:8025" target="_blank" rel="noreferrer">
            MailHog
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" readOnly {...register('email')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Код</Label>
            <Input id="code" inputMode="numeric" maxLength={6} placeholder="123456" {...register('code')} />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Проверяем…' : 'Подтвердить'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
