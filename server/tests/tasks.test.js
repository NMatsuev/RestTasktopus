process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.LOGIN_RATE_MAX_REQUESTS = '1000';

const request = require('supertest');
const app = require('../src/app');
const { connectTestDb, clearCollections, disconnectTestDb, createUser } = require('./dbHelper');

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await disconnectTestDb();
});

async function loginAs(email, password = 'Password123!') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken;
}

describe('CRUD /api/tasks', () => {
  let managerToken;
  let viewerToken;

  beforeEach(async () => {
    await createUser({ email: 'manager@example.com', role: 'manager' });
    await createUser({ email: 'viewer@example.com', role: 'viewer' });
    managerToken = await loginAs('manager@example.com');
    viewerToken = await loginAs('viewer@example.com');
  });

  it('создаёт задачу (201) и привязывает её к создавшему пользователю', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('title', 'Подготовить отчёт')
      .field('status', 'todo');

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Подготовить отчёт');
    expect(res.body.createdBy).toBeTruthy();
  });

  it('возвращает 400 при попытке создать задачу без обязательного названия', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('status', 'todo');

    expect(res.status).toBe(400);
    expect(res.body.details).toBeInstanceOf(Array);
  });

  it('читает список и конкретную задачу (200), в т.ч. ролью viewer', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('title', 'Задача для чтения');

    const list = await request(app).get('/api/tasks').set('Authorization', `Bearer ${viewerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    const single = await request(app)
      .get(`/api/tasks/${created.body._id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(single.status).toBe(200);
    expect(single.body.title).toBe('Задача для чтения');
  });

  it('возвращает 404 для несуществующего, но валидного id', async () => {
    const fakeId = '64b64b64b64b64b64b64b64b';
    const res = await request(app)
      .get(`/api/tasks/${fakeId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
  });

  it('возвращает 400 для некорректного формата id', async () => {
    const res = await request(app)
      .get('/api/tasks/not-a-valid-id')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  it('обновляет задачу (200) и запрещает обновление роли viewer (403)', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('title', 'Исходное название');

    const updated = await request(app)
      .put(`/api/tasks/${created.body._id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .field('title', 'Новое название')
      .field('status', 'done');
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Новое название');

    const forbidden = await request(app)
      .put(`/api/tasks/${created.body._id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .field('title', 'Попытка viewer');
    expect(forbidden.status).toBe(403);
  });

  it('удаляет задачу (200), повторное удаление даёт 404; viewer получает 403', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('title', 'На удаление');

    const forbidden = await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(forbidden.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(deleted.status).toBe(200);

    const again = await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(again.status).toBe(404);
  });
});
