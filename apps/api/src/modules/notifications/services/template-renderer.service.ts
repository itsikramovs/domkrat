import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

interface MultiLang {
  ru: string;
  uz?: string;
}

@Injectable()
export class TemplateRendererService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Загружает шаблон из БД, подставляет переменные {{var}}, возвращает {subject, body}.
   */
  async render(
    code: string,
    vars: Record<string, string | number>,
    language: 'ru' | 'uz' = 'ru',
  ): Promise<{ subject: string; body: string }> {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { code } });
    if (!template) throw new NotFoundException(`Notification template "${code}" not found`);

    const pick = (json: unknown): string => {
      if (!json || typeof json !== 'object') return '';
      const obj = json as MultiLang;
      return obj[language] ?? obj.ru ?? '';
    };

    const subjectRaw = pick(template.subjectTemplate);
    const bodyRaw = pick(template.bodyTemplate);

    return {
      subject: this.interpolate(subjectRaw, vars),
      body: this.interpolate(bodyRaw, vars),
    };
  }

  private interpolate(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? `{{${key}}}`));
  }
}
