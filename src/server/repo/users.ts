import type pg from "pg";

export type DbUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

export async function getUserByEmail(
  client: pg.PoolClient,
  email: string,
): Promise<DbUser | null> {
  const emailKey = email.trim().toLowerCase();
  const res = await client.query<DbUser>(
    `select id, email, name, password_hash from users where lower(email) = $1`,
    [emailKey],
  );
  return res.rows[0] ?? null;
}

export async function createUser(
  client: pg.PoolClient,
  input: { email: string; name: string; passwordHash: string },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into users (email, name, password_hash) values ($1, $2, $3) returning id`,
    [input.email, input.name, input.passwordHash],
  );
  return res.rows[0];
}

