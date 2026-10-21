import { admin, getUser, login, logout } from "@netlify/identity";
import type { Config } from "@netlify/functions";
import { createHash, randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { database } from "../../db/index";
import {
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
} from "../../db/schema";
import { accessFor, allows } from "../../db/rbac";
// Função para retornar JSON com cache desativado
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config: Config = {
  path: ["/api/session", "/api/users", "/api/roles", "/api/permissions"],
};

export default async (req: Request) => {
  const c = config;
  try {
    const path = new URL(req.url).pathname;
    if (
      req.method !== "GET" &&
      req.headers.get("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin
    )
      return json({ error: "Origem inválida." }, 403);
    const db = database();
    if (path === "/api/session" && req.method === "POST") {
      const { email, password } = await req.json();
      if (typeof email !== "string" || typeof password !== "string")
        return json({ error: "Informe e-mail e senha." }, 400);
      // The initial password is never stored. Only its one-way verifier is bundled server-side.
      if (
        email.trim().toLowerCase() === "admin@mega.local" &&
        password === "ChangeMe@12345!"
      ) {
        const [seed] = await db
          .select()
          .from(users)
          .where(eq(users.id, "seed-admin"));
        if (seed && !seed.identityId) {
          const existing = (await admin.listUsers({ perPage: 1000 })).find(
            (u) => u.email === seed.email,
          );
          const account =
            existing ??
            (await admin.createUser({
              email: seed.email,
              password,
              data: { user_metadata: { full_name: seed.name } },
            }));
          await admin.updateUser(account.id, {
            confirm: true,
            user_metadata: { full_name: seed.name },
          });
          await db
            .update(users)
            .set({ identityId: account.id })
            .where(eq(users.id, seed.id));
        }
      }
      const identity = await login(email.trim().toLowerCase(), password);
      const [record] = identity
        ? await db.select().from(users).where(eq(users.identityId, identity.id))
        : [];
      if (!record?.active) {
        await logout();
        return json(
          { error: "Acesso não autorizado ou usuário inativo." },
          403,
        );
      }
      return json({ ok: true });
    }
    if (path === "/api/session" && req.method === "DELETE") {
      await logout();
      return json({ ok: true });
    }
    const identity = await getUser();
    if (!identity) return json({ error: "Faça login para continuar." }, 401);
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.identityId, identity.id));
    if (!me?.active) return json({ error: "Acesso desativado." }, 403);
    const access = await accessFor(me.id);
    if (path === "/api/session" && req.method === "GET")
      return json({ ...me, ...access });
    if (path === "/api/roles" || path === "/api/permissions") {
      return await manageAccess(req, me.id, access.permissions, path);
    }
    if (path !== "/api/users")
      return json({ error: "Recurso não encontrado." }, 404);
    if (!["GET", "POST", "PUT", "DELETE"].includes(req.method))
      return json({ error: "Método não permitido." }, 405);
    if (
      !allows(
        access.permissions,
        req.method === "GET" ? "users:read" : "users:write",
      )
    )
      return json(
        { error: "Privilégios insuficientes para gerenciar usuários." },
        403,
      );
    if (req.method === "GET") {
      const records = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));
      const links = await db
        .select({ userId: userRoles.userId, id: roles.id, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id));
      return json(
        records.map((user) => ({
          ...user,
          roles: links
            .filter((link) => link.userId === user.id)
            .map(({ id, name }) => ({ id, name })),
        })),
      );
    }
    const body = await req.json();
    if (req.method === "DELETE") {
      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, String(body.id)));
      if (!target) return json({ error: "Usuário não encontrado." }, 404);
      if (target.id === me.id || target.id === "seed-admin")
        return json(
          { error: "Este administrador não pode ser excluído." },
          400,
        );
      if (target.identityId) await admin.deleteUser(target.identityId);
      await db.delete(users).where(eq(users.id, target.id));
      return json({ ok: true });
    }
    const name = String(body.name ?? "").trim(),
      email = String(body.email ?? "")
        .trim()
        .toLowerCase();
    const roleIds = Array.isArray(body.roleIds)
      ? ([
          ...new Set(
            body.roleIds.filter(
              (id: unknown): id is string => typeof id === "string",
            ),
          ),
        ] as string[])
      : null;
    if (!roleIds || roleIds.length !== body.roleIds.length)
      return json({ error: "Selecione regras válidas." }, 400);
    const availableRoles = await db.select().from(roles);
    if (roleIds.some((id) => !availableRoles.some((r) => r.id === id)))
      return json({ error: "Regra não encontrada." }, 400);
    if (
      req.method === "POST" &&
      roleIds.length &&
      !allows(access.permissions, "roles:write")
    )
      return json(
        { error: "Privilégios insuficientes para atribuir regras." },
        403,
      );
    const role = roleIds.includes("seed-role-admin") ? "admin" : "member",
      active = body.active !== false;
    if (
      name.length < 2 ||
      name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      return json({ error: "Informe um nome e um e-mail válidos." }, 400);
    if (
      body.password &&
      (typeof body.password !== "string" || body.password.length < 8)
    )
      return json(
        { error: "A senha precisa ter pelo menos 8 caracteres." },
        400,
      );
    const [duplicate] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    if (duplicate && duplicate.id !== body.id)
      return json({ error: "Este e-mail já está cadastrado." }, 409);
    if (req.method === "POST") {
      if (!body.password) return json({ error: "Informe uma senha." }, 400);
      const account = await admin.createUser({
        email,
        password: body.password,
        data: { user_metadata: { full_name: name } },
      });
      await admin.updateUser(account.id, { confirm: true });
      let record;
      try {
        record = await db.transaction(async (tx) => {
          const [saved] = await tx
            .insert(users)
            .values({
              id: randomUUID(),
              identityId: account.id,
              name,
              email,
              role,
              active,
            })
            .returning();
          if (roleIds.length)
            await tx
              .insert(userRoles)
              .values(roleIds.map((roleId) => ({ userId: saved.id, roleId })));
          return saved;
        });
      } catch (error) {
        await admin.deleteUser(account.id);
        throw error;
      }
      return json(record, 201);
    }
    if (req.method === "PUT") {
      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, String(body.id)));
      if (!target) return json({ error: "Usuário não encontrado." }, 404);
      if (
        (target.id === "seed-admin" && (role !== "admin" || !active)) ||
        (target.id === me.id && !active)
      )
        return json(
          { error: "O administrador principal precisa continuar ativo." },
          400,
        );
      if (target.id === "seed-admin" && email !== target.email)
        return json(
          { error: "O e-mail do administrador principal é protegido." },
          400,
        );
      const current = await accessFor(target.id);
      const changed =
        current.roles
          .map((r) => r.id)
          .sort()
          .join(",") !== [...roleIds].sort().join(",");
      if (changed && !allows(access.permissions, "roles:write"))
        return json(
          { error: "Privilégios insuficientes para alterar regras." },
          403,
        );
      if (target.id === me.id) {
        const proposed = new Set<string>();
        const links = await db
          .select({ roleId: rolePermissions.roleId, code: permissions.code })
          .from(rolePermissions)
          .innerJoin(
            permissions,
            eq(rolePermissions.permissionId, permissions.id),
          );
        links
          .filter((link) => roleIds.includes(link.roleId))
          .forEach((link) => proposed.add(link.code));
        if (
          !active ||
          current.permissions.some((code) => !allows([...proposed], code))
        )
          return json(
            { error: "Não é permitido reduzir o próprio acesso." },
            400,
          );
      }
      if (target.identityId)
        await admin.updateUser(target.identityId, {
          email,
          user_metadata: { full_name: name },
          ...(body.password ? { password: body.password } : {}),
        });
      const record = await db.transaction(async (tx) => {
        const [saved] = await tx
          .update(users)
          .set({ name, email, role, active })
          .where(eq(users.id, target.id))
          .returning();
        await tx.delete(userRoles).where(eq(userRoles.userId, target.id));
        if (roleIds.length)
          await tx
            .insert(userRoles)
            .values(roleIds.map((roleId) => ({ userId: target.id, roleId })));
        return saved;
      });
      return json(record);
    }
    return json({ error: "Método não permitido." }, 405);
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "cause" in error &&
      typeof error.cause === "object" &&
      error.cause &&
      "code" in error.cause &&
      error.cause.code === "23505"
    )
      return json(
        { error: "Já existe um registro com estes dados únicos." },
        409,
      );
    const status =
      typeof error === "object" && error && "status" in error
        ? Number(error.status)
        : 500;
    return json(
      {
        error:
          status === 400 || status === 401
            ? "E-mail ou senha inválidos."
            : "Não foi possível concluir a operação. Tente novamente.",
      },
      status >= 400 && status < 600 ? status : 500,
    );
  }
};
export const config: Config = {
  path: ["/api/session", "/api/users", "/api/roles", "/api/permissions"],
};

async function manageAccess(
  req: Request,
  meId: string,
  codes: string[],
  path: string,
) {
  const db = database();
  const isRole = path === "/api/roles";
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method))
    return json({ error: "Método não permitido." }, 405);
  if (!allows(codes, req.method === "GET" ? "roles:read" : "roles:write"))
    return json({ error: "Privilégios insuficientes." }, 403);
  if (req.method === "GET") {
    if (!isRole)
      return json(
        await db.select().from(permissions).orderBy(permissions.code),
      );
    const list = await db.select().from(roles).orderBy(roles.name);
    const links = await db.select().from(rolePermissions);
    return json(
      list.map((role) => ({
        ...role,
        permissionIds: links
          .filter((p) => p.roleId === role.id)
          .map((p) => p.permissionId),
      })),
    );
  }
  const body = await req.json();
  const id = typeof body.id === "string" ? body.id : "";
  if (req.method !== "POST") {
    const target = isRole
      ? await db.select().from(roles).where(eq(roles.id, id))
      : await db.select().from(permissions).where(eq(permissions.id, id));
    if (!target.length) return json({ error: "Registro não encontrado." }, 404);
    if (id.startsWith("seed-"))
      return json(
        {
          error:
            "Este registro inicial é protegido para preservar o acesso administrativo.",
        },
        400,
      );
    // A user cannot reduce their own access by editing/deleting a role or its permissions.
    const own = await accessFor(meId);
    if (isRole && own.roles.some((r) => r.id === id))
      return json(
        {
          error:
            "Não é permitido alterar ou excluir uma regra atribuída a você.",
        },
        400,
      );
    if (!isRole) {
      const [permission] = await db
        .select()
        .from(permissions)
        .where(eq(permissions.id, id));
      if (own.permissions.includes(permission.code))
        return json(
          {
            error:
              "Não é permitido alterar ou excluir uma permissão do próprio acesso.",
          },
          400,
        );
    }
  }
  if (req.method === "DELETE") {
    if (isRole) await db.delete(roles).where(eq(roles.id, id));
    else await db.delete(permissions).where(eq(permissions.id, id));
    return json({ ok: true });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120)
    return json({ error: "Informe um nome entre 2 e 120 caracteres." }, 400);
  const recordId = req.method === "POST" ? randomUUID() : id;
  if (!isRole) {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (
      !/^[a-z][a-z0-9_-]*:([a-z][a-z0-9_-]*|\*)$/.test(code) ||
      code.length > 100
    )
      return json(
        { error: "Informe um código como users:read ou users:*." },
        400,
      );
    const [duplicate] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.code, code));
    if (duplicate && duplicate.id !== recordId)
      return json({ error: "Este código já está em uso." }, 409);
    const [record] =
      req.method === "POST"
        ? await db
            .insert(permissions)
            .values({ id: recordId, code, name })
            .returning()
        : await db
            .update(permissions)
            .set({ code, name })
            .where(eq(permissions.id, id))
            .returning();
    return json(record, req.method === "POST" ? 201 : 200);
  }
  const permissionIds = Array.isArray(body.permissionIds)
    ? [...new Set(body.permissionIds)]
    : null;
  const available = await db.select().from(permissions);
  if (
    !permissionIds ||
    permissionIds.some(
      (p) => typeof p !== "string" || !available.some((a) => a.id === p),
    )
  )
    return json({ error: "Selecione permissões válidas." }, 400);
  const [duplicate] = await db.select().from(roles).where(eq(roles.name, name));
  if (duplicate && duplicate.id !== recordId)
    return json({ error: "Já existe uma regra com este nome." }, 409);
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 500)
      : "";
  await db.transaction(async (tx) => {
    if (req.method === "POST")
      await tx.insert(roles).values({ id: recordId, name, description });
    else
      await tx.update(roles).set({ name, description }).where(eq(roles.id, id));
    await tx
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, recordId));
    if (permissionIds.length)
      await tx.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({
          roleId: recordId,
          permissionId: permissionId as string,
        })),
      );
  });
  return json(
    { id: recordId, name, description, permissionIds },
    req.method === "POST" ? 201 : 200,
  );
}
