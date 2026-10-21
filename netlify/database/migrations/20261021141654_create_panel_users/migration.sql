CREATE TABLE "panel_users" (
	"id" text PRIMARY KEY,
	"identity_id" text UNIQUE,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"role" text DEFAULT 'member' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

INSERT INTO panel_users (id, name, email, role, active)
VALUES ('seed-admin', 'Administrador', 'fabriciojbo@gmail.com', 'admin', true)
ON CONFLICT (id) DO NOTHING;
