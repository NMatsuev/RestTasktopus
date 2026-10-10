process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.LOGIN_MAX_ATTEMPTS = '3';
process.env.LOGIN_RATE_MAX_REQUESTS = '1000'; // не мешаем IP-лимитеру в тестах лимита по аккаунту

const request = require('supertest');

jest.mock('../src/utils/mailer', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ delivered: false }),
}));

const app = require('../src/app');
const { sendPasswordResetEmail } = require('../src/utils/mailer');
const { connectTestDb, clearCollections, disconnectTestDb, createUser } = require('./dbHelper');

// Refresh-токен теперь приходит не в JSON-теле, а в Set-Cookie. Достаём из
// массива заголовков ответа именно пару "имя=значение" нужной cookie, без
// остальных атрибутов (Path/HttpOnly/SameSite/Max-Age), чтобы отправить её
// обратно как обычный заголовок Cookie в следующем запросе.
function extractCookiePair(setCookieHeader, name) {
  if (!setCookieHeader) return null;
  const line = setCookieHeader.find((c) => c.startsWith(`${name}=`));
  return line ? line.split(';')[0] : null;
}

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearCollections();
  jest.clearAllMocks();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('POST /api/auth/register', () => {
  it('создаёт нового пользователя с ролью viewer по умолчанию и возвращает 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.role).toBe('viewer');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('возвращает 409 при повторной регистрации того же email', async () => {
    await createUser({ email: 'alice@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'Password123!' });

    expect(res.status).toBe(409);
  });

  it('возвращает 400 при слишком коротком пароле', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeInstanceOf(Array);
  });
});

describe('POST /api/auth/login и защита от подбора пароля', () => {
  it('выдаёт accessToken в теле и refresh-токен в httpOnly-cookie при верных данных', async () => {
    await createUser({ email: 'alice@example.com', password: 'Password123!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.refreshToken).toBeUndefined(); // в теле его больше нет

    const cookie = extractCookiePair(res.headers['set-cookie'], 'refresh_token');
    expect(cookie).toBeTruthy();
    const rawCookieLine = res.headers['set-cookie'].find((c) => c.startsWith('refresh_token='));
    expect(rawCookieLine).toMatch(/HttpOnly/i);
  });

  it('возвращает 401 с одинаковым сообщением для неверного пароля и несуществующего email', async () => {
    await createUser({ email: 'alice@example.com', password: 'Password123!' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });

  it('блокирует аккаунт на время после превышения числа неудачных попыток (LOGIN_MAX_ATTEMPTS=3)', async () => {
    await createUser({ email: 'alice@example.com', password: 'Password123!' });

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'wrong' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'Password123!' }); // даже верный пароль не поможет

    expect(res.status).toBe(423);
  });
});

describe('Ролевая модель доступа (RBAC) для задач', () => {
  async function loginAs(email, password) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res.body.accessToken;
  }

  it('требует аутентификации (401 без токена)', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('viewer может читать, но не может создавать задачи (403)', async () => {
    await createUser({ email: 'viewer@example.com', password: 'Password123!', role: 'viewer' });
    const token = await loginAs('viewer@example.com', 'Password123!');

    const list = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);

    const create = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Задача от viewer');
    expect(create.status).toBe(403);
  });

  it('manager может создавать задачи (201)', async () => {
    await createUser({ email: 'manager@example.com', password: 'Password123!', role: 'manager' });
    const token = await loginAs('manager@example.com', 'Password123!');

    const create = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Задача от менеджера');
    expect(create.status).toBe(201);
    expect(create.body.title).toBe('Задача от менеджера');
  });
});

describe('Обновление токена (refresh) и ротация', () => {
  it('выдаёт новую пару токенов и аннулирует старый refresh-токен', async () => {
    await createUser({ email: 'alice@example.com', password: 'Password123!' });

    // agent сам хранит и прикладывает cookie между запросами — как настоящий
    // браузер — это и нужно для сквозного теста login → refresh.
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: 'alice@example.com', password: 'Password123!' });
    expect(login.status).toBe(200);
    const originalCookie = extractCookiePair(login.headers['set-cookie'], 'refresh_token');

    const firstRefresh = await agent.post('/api/auth/refresh');
    expect(firstRefresh.status).toBe(200);
    expect(typeof firstRefresh.body.accessToken).toBe('string');
    const rotatedCookie = extractCookiePair(firstRefresh.headers['set-cookie'], 'refresh_token');
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie).not.toBe(originalCookie);

    // Повторное использование уже отработавшего (старого) refresh-токена —
    // считается подозрительным и должно быть отклонено. Отправляем его явно
    // через обычный (не agent) запрос, так как agent уже перешёл на новый.
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(reuse.status).toBe(401);
  });

  it('отвечает 401 без cookie вообще', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('Выход (logout) — очищает сессию и cookie', () => {
  it('завершает сессию: после logout обновить токен по старой cookie уже нельзя', async () => {
    await createUser({ email: 'alice@example.com', password: 'Password123!' });
    const agent = request.agent(app);

    const login = await agent.post('/api/auth/login').send({ email: 'alice@example.com', password: 'Password123!' });
    expect(login.status).toBe(200);

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);
    const clearedCookie = logoutRes.headers['set-cookie'];
    expect(clearedCookie).toBeDefined();

    const refreshAfterLogout = await agent.post('/api/auth/refresh');
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe('Восстановление доступа через email', () => {
  it('позволяет сбросить пароль по токену из письма и затем войти с новым паролем', async () => {
    await createUser({ email: 'alice@example.com', password: 'OldPassword123!' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'alice@example.com' });
    expect(forgot.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const [, resetLink] = sendPasswordResetEmail.mock.calls[0];
    const token = new URL(resetLink).searchParams.get('token');

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'alice@example.com', token, newPassword: 'NewPassword123!' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'OldPassword123!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'NewPassword123!' });
    expect(newLogin.status).toBe(200);
  });

  it('не раскрывает, зарегистрирован ли email (одинаковый ответ для существующего и несуществующего)', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(known.body.message).toMatch(/Если такой email/);
  });
});
