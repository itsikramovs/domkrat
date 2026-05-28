'use client';

import { ChevronLeft, X } from 'lucide-react';
import { useState } from 'react';

import {
  useCarGenerations,
  useCarMakes,
  useCarModels,
  useCarModifications,
} from '@/lib/api/cars';
import { cn } from '@/lib/utils';

type Step = 'make' | 'model' | 'generation' | 'modification';

export interface SelectedCar {
  makeId: string;
  makeName: string;
  modelId?: string;
  modelName?: string;
  generationId?: string;
  generationName?: string;
  modificationId?: string;
  modificationName?: string;
}

interface Props {
  open: boolean;
  initial?: Partial<SelectedCar>;
  onClose: () => void;
  /** Уровень детализации: 'model' — достаточно модели, 'modification' — нужна модификация */
  minDepth?: 'make' | 'model' | 'modification';
  onSelect: (selected: SelectedCar) => void;
}

export function CarPicker({ open, onClose, onSelect, minDepth = 'model', initial }: Props) {
  const [step, setStep] = useState<Step>('make');
  const [picked, setPicked] = useState<SelectedCar | null>(
    initial?.makeId && initial.makeName ? (initial as SelectedCar) : null,
  );

  const makes = useCarMakes(false);
  const models = useCarModels(picked?.makeId ?? null);
  const generations = useCarGenerations(picked?.modelId ?? null);
  const modifications = useCarModifications(picked?.generationId ?? null);

  if (!open) return null;

  const reset = () => {
    setStep('make');
    setPicked(null);
  };

  const back = () => {
    if (step === 'modification') setStep('generation');
    else if (step === 'generation') setStep('model');
    else if (step === 'model') setStep('make');
    else onClose();
  };

  const titles: Record<Step, string> = {
    make: 'Выберите марку',
    model: 'Выберите модель',
    generation: 'Выберите поколение',
    modification: 'Выберите модификацию',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/50 md:items-center md:justify-center">
      <div className="flex h-[85vh] w-full flex-col rounded-t-3xl bg-background md:h-[600px] md:max-w-md md:rounded-3xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <button
            type="button"
            onClick={back}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
            aria-label="Назад"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="flex-1 text-base font-semibold">{titles[step]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Breadcrumb */}
        {picked ? (
          <div className="border-b px-4 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{picked.makeName}</span>
            {picked.modelName ? <> · {picked.modelName}</> : null}
            {picked.generationName ? <> · {picked.generationName}</> : null}
            <button type="button" onClick={reset} className="ml-2 text-primary hover:underline">
              сбросить
            </button>
          </div>
        ) : null}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {step === 'make' && (
            <List loading={makes.isLoading}>
              {makes.data?.map((m) => (
                <Row
                  key={m.id}
                  onClick={() => {
                    const next = { makeId: m.id, makeName: m.name };
                    setPicked(next);
                    if (minDepth === 'make') onSelect(next);
                    else setStep('model');
                  }}
                >
                  <span className={cn('font-medium', m.isPopular && 'text-foreground')}>
                    {m.name}
                  </span>
                  {m.isPopular ? (
                    <span className="text-xs text-primary">★</span>
                  ) : null}
                </Row>
              ))}
            </List>
          )}
          {step === 'model' && (
            <List loading={models.isLoading}>
              {models.data?.length === 0 ? (
                <Empty text="У этой марки пока нет моделей в справочнике." />
              ) : null}
              {models.data?.map((m) => (
                <Row
                  key={m.id}
                  onClick={() => {
                    const next = { ...picked!, modelId: m.id, modelName: m.name };
                    setPicked(next);
                    if (minDepth === 'model') {
                      onSelect(next);
                    } else {
                      setStep('generation');
                    }
                  }}
                >
                  {m.name}
                </Row>
              ))}
            </List>
          )}
          {step === 'generation' && (
            <List loading={generations.isLoading}>
              {generations.data?.length === 0 ? (
                <Empty text="Поколения не загружены." />
              ) : null}
              {generations.data?.map((g) => (
                <Row
                  key={g.id}
                  onClick={() => {
                    const next = { ...picked!, generationId: g.id, generationName: g.name };
                    setPicked(next);
                    setStep('modification');
                  }}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.yearFrom}{g.yearTo ? `—${g.yearTo}` : '—н.в.'}
                  </span>
                </Row>
              ))}
            </List>
          )}
          {step === 'modification' && (
            <List loading={modifications.isLoading}>
              {modifications.data?.length === 0 ? (
                <Empty text="Модификации не загружены." />
              ) : null}
              {modifications.data?.map((mod) => (
                <Row
                  key={mod.id}
                  onClick={() => {
                    onSelect({
                      ...picked!,
                      modificationId: mod.id,
                      modificationName: mod.name,
                    });
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{mod.name}</span>
                    {mod.engine ? (
                      <span className="text-[11px] text-muted-foreground">
                        {mod.engine.name} {mod.horsepower ? `· ${mod.horsepower} л.с.` : ''}
                      </span>
                    ) : null}
                  </div>
                </Row>
              ))}
            </List>
          )}
        </div>
      </div>
    </div>
  );
}

function List({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  if (loading) {
    return <div className="space-y-1 p-3">{Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary" />
    ))}</div>;
  }
  return <ul className="divide-y">{children}</ul>;
}

function Row({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-secondary"
      >
        {children}
      </button>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
