import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { createUser, getUserByEmail } from "@/src/server/repo/users";
import { listWorkspaceMembers, upsertMembership } from "@/src/server/repo/workspaces";
import bcrypt from "bcryptjs";

export async function GET(_: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const members = await withClient((client) => listWorkspaceMembers(client, session.workspaceId));
  return json({
    members: members.map((member) => ({
      userId: member.user_id,
      role: member.role,
      name: member.name,
      email: member.email,
    })),
  });
}

const postSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");
  if (session.role !== "admin") return errorJson(403, "Admin only");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const added = await withClient(async (client) => {
    await client.query("begin;");
    try {
      const email = parsed.data.email.trim().toLowerCase();
      let user = await getUserByEmail(client, email);
      let created = false;

      if (!user) {
        const name = parsed.data.name?.trim();
        const password = parsed.data.password;
        if (!name || !password) {
          await client.query("rollback;");
          return { error: "New users require name and password" as const };
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const createdUser = await createUser(client, {
          email,
          name,
          passwordHash,
        });
        user = await getUserByEmail(client, email);
        if (!user) {
          await client.query("rollback;");
          return { error: "Could not create user" as const };
        }
        created = true;
        if (!createdUser.id) {
          await client.query("rollback;");
          return { error: "Could not create user" as const };
        }
      }

      await upsertMembership(client, {
        workspaceId: session.workspaceId,
        userId: user.id,
        role: parsed.data.role,
      });

      await client.query("commit;");
      return {
        ok: true as const,
        created,
        user: {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: parsed.data.role,
        },
      };
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });

  if (!("ok" in added) || !added.ok) {
    return errorJson(400, "error" in added ? added.error ?? "Could not add member" : "Could not add member");
  }

  return json({ ok: true, created: added.created, user: added.user });
}
