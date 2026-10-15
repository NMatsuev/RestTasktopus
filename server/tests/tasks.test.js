process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.LOGIN_RATE_MAX_REQUESTS = "1000";

const request = require("supertest");
const app = require("../src/app");
const {
  connectTestDb,
  clearCollections,
  disconnectTestDb,
  createUser,
} = require("./dbHelper");
const fs = require("fs");
const Task = require("../src/models/Task");
const { UPLOAD_DIR } = require("../src/middleware/upload");

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await disconnectTestDb();
});

async function loginAs(email, password = "Password123!") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return res.body.accessToken;
}

describe("CRUD /api/tasks", () => {
  let managerToken;
  let viewerToken;

  beforeEach(async () => {
    await createUser({ email: "manager@example.com", role: "manager" });
    await createUser({ email: "viewer@example.com", role: "viewer" });
    managerToken = await loginAs("manager@example.com");
    viewerToken = await loginAs("viewer@example.com");
  });

  it("создаёт задачу (201) и привязывает её к создавшему пользователю", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${managerToken}`)
      .field("title", "Подготовить отчёт")
      .field("status", "todo");

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Подготовить отчёт");
    expect(res.body.createdBy).toBeTruthy();
  });

  it("возвращает 400 при попытке создать задачу без обязательного названия", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${managerToken}`)
      .field("status", "todo");

    expect(res.status).toBe(400);
    expect(res.body.details).toBeInstanceOf(Array);
  });

  it("читает список и конкретную задачу (200), в т.ч. ролью viewer", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${managerToken}`)
      .field("title", "Задача для чтения");

    const list = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    const single = await request(app)
      .get(`/api/tasks/${created.body._id}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(single.status).toBe(200);
    expect(single.body.title).toBe("Задача для чтения");
  });

  it("возвращает 404 для несуществующего, но валидного id", async () => {
    const fakeId = "64b64b64b64b64b64b64b64b";
    const res = await request(app)
      .get(`/api/tasks/${fakeId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
  });

  it("возвращает 400 для некорректного формата id", async () => {
    const res = await request(app)
      .get("/api/tasks/not-a-valid-id")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  it("обновляет задачу (200) и запрещает обновление роли viewer (403)", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${managerToken}`)
      .field("title", "Исходное название");

    const updated = await request(app)
      .put(`/api/tasks/${created.body._id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .field("title", "Новое название")
      .field("status", "done");
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Новое название");

    const forbidden = await request(app)
      .put(`/api/tasks/${created.body._id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .field("title", "Попытка viewer");
    expect(forbidden.status).toBe(403);
  });

  it("удаляет задачу (200), повторное удаление даёт 404; viewer получает 403", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${managerToken}`)
      .field("title", "На удаление");

    const forbidden = await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(forbidden.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(deleted.status).toBe(200);

    const again = await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(again.status).toBe(404);
  });
});

describe("Владение задачами: менеджер меняет и удаляет только свои", () => {
  let managerAToken, managerBToken, adminToken, taskOfA;

  beforeEach(async () => {
    await createUser({ email: "manager-a@example.com", role: "manager" });
    await createUser({ email: "manager-b@example.com", role: "manager" });
    await createUser({ email: "admin@example.com", role: "admin" });
    managerAToken = await loginAs("manager-a@example.com");
    managerBToken = await loginAs("manager-b@example.com");
    adminToken = await loginAs("admin@example.com");
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${managerAToken}`)
      .field("title", "Задача менеджера A");
    taskOfA = created.body;
  });

  it("автор-менеджер может изменить и удалить свою задачу", async () => {
    const updated = await request(app)
      .put(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${managerAToken}`)
      .field("title", "Изменено автором");
    expect(updated.status).toBe(200);
    const deleted = await request(app)
      .delete(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${managerAToken}`);
    expect(deleted.status).toBe(200);
  });

  it("другой менеджер получает 403 при изменении чужой задачи, и она не меняется", async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${managerBToken}`)
      .field("title", "Попытка перезаписать");
    expect(res.status).toBe(403);
    const check = await request(app)
      .get(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${managerBToken}`);
    expect(check.status).toBe(200);
    expect(check.body.title).toBe("Задача менеджера A");
  });

  it("другой менеджер получает 403 при удалении чужой задачи, и она остаётся", async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${managerBToken}`);
    expect(res.status).toBe(403);
    expect(await Task.countDocuments({ _id: taskOfA._id })).toBe(1);
  });

  it("отказ 403 не оставляет на диске загруженный файл", async () => {
    const before = fs.readdirSync(UPLOAD_DIR).length;
    const res = await request(app)
      .put(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${managerBToken}`)
      .field("title", "С файлом")
      .attach("attachment", Buffer.from("fake image"), {
        filename: "a.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(403);
    expect(fs.readdirSync(UPLOAD_DIR).length).toBe(before);
  });

  it("несуществующая задача — по-прежнему 404, а не 403", async () => {
    const res = await request(app)
      .delete("/api/tasks/64b64b64b64b64b64b64b64b")
      .set("Authorization", `Bearer ${managerBToken}`);
    expect(res.status).toBe(404);
  });

  it("админ может изменить и удалить задачу любого менеджера", async () => {
    const updated = await request(app)
      .put(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("title", "Изменено админом");
    expect(updated.status).toBe(200);
    expect(updated.body.createdBy).toBe(taskOfA.createdBy); // автор не меняется
    const deleted = await request(app)
      .delete(`/api/tasks/${taskOfA._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);
  });

  it("задача без автора: менеджеру 403, админу 200", async () => {
    const legacy = await Task.create({ title: "Старая задача без автора" });
    const byManager = await request(app)
      .put(`/api/tasks/${legacy._id}`)
      .set("Authorization", `Bearer ${managerAToken}`)
      .field("title", "Попытка менеджера");
    expect(byManager.status).toBe(403);
    const byAdmin = await request(app)
      .put(`/api/tasks/${legacy._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("title", "Исправлено админом");
    expect(byAdmin.status).toBe(200);
  });
});
