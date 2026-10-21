CREATE TABLE "panel_permissions" (
	"id" text PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_role_permissions" (
	"role_id" text,
	"permission_id" text,
	CONSTRAINT "panel_role_permissions_pkey" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "panel_roles" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_user_roles" (
	"user_id" text,
	"role_id" text,
	CONSTRAINT "panel_user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "panel_role_permissions" ADD CONSTRAINT "panel_role_permissions_role_id_panel_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "panel_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "panel_role_permissions" ADD CONSTRAINT "panel_role_permissions_permission_id_panel_permissions_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "panel_permissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "panel_user_roles" ADD CONSTRAINT "panel_user_roles_user_id_panel_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "panel_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "panel_user_roles" ADD CONSTRAINT "panel_user_roles_role_id_panel_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "panel_roles"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO panel_roles (id, name, description) VALUES
 ('seed-role-admin', 'Admin', 'Administração completa do sistema');
--> statement-breakpoint
INSERT INTO panel_permissions (id, code, name) VALUES
 ('seed-users-read', 'users:read', 'Leitura de usuários'),
 ('seed-users-write', 'users:write', 'Escrita de usuários'),
 ('seed-roles-read', 'roles:read', 'Leitura de regras'),
 ('seed-roles-write', 'roles:write', 'Escrita de regras');
--> statement-breakpoint
INSERT INTO panel_role_permissions (role_id, permission_id)
 SELECT 'seed-role-admin', id FROM panel_permissions;
--> statement-breakpoint
INSERT INTO panel_user_roles (user_id, role_id)
 SELECT id, 'seed-role-admin' FROM panel_users WHERE role = 'admin' OR email = 'fabriciojbo@gmail.com';
