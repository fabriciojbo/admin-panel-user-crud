import { eq } from 'drizzle-orm'
import { database } from './index'
import { users, roles, permissions, userRoles, rolePermissions } from './schema'

export async function accessFor(userId: string) {
  const db = database()
  const assigned = await db
    .select({ id: roles.id, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
  const grants = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId))
  return {
    roles: assigned,
    permissions: [...new Set(grants.map((p) => p.code))].sort(),
  }
}
export function allows(codes: string[], code: string) {
  return codes.includes(code) || codes.includes(code.split(':')[0] + ':*')
}
export async function identityAccess(identityId: string) {
  const [user] = await database()
    .select()
    .from(users)
    .where(eq(users.identityId, identityId))
  if (!user?.active) return null
  return { user, ...(await accessFor(user.id)) }
}
