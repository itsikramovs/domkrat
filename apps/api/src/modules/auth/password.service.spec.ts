import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('хэширует пароль через argon2id (formato $argon2id$...$...)', async () => {
    const hash = await service.hash('Test1234!');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verify возвращает true для правильного пароля', async () => {
    const hash = await service.hash('Test1234!');
    expect(await service.verify(hash, 'Test1234!')).toBe(true);
  });

  it('verify возвращает false для неправильного пароля', async () => {
    const hash = await service.hash('Test1234!');
    expect(await service.verify(hash, 'WrongPassword')).toBe(false);
  });

  it('два хэша одного и того же пароля разные (рандомная соль)', async () => {
    const h1 = await service.hash('Test1234!');
    const h2 = await service.hash('Test1234!');
    expect(h1).not.toBe(h2);
    expect(await service.verify(h1, 'Test1234!')).toBe(true);
    expect(await service.verify(h2, 'Test1234!')).toBe(true);
  });
});
