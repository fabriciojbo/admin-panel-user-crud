import {
  pgTable,
  text,
  timestamp,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core'
export const users = pgTable('panel_users', {
  id: text().primaryKey(),
  identityId: text('identity_id').unique(),
  name: text().notNull(),
  email: text().notNull().unique(),
  role: text().notNull().default('member'),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const roles = pgTable('panel_roles', {
  id: text().primaryKey(),
  name: text().notNull().unique(),
  description: text().notNull().default(''),
})
export const permissions = pgTable('panel_permissions', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
})
export const userRoles = pgTable(
  'panel_user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
)
export const rolePermissions = pgTable(
  'panel_role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
)
