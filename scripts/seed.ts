import "./loadEnv";

import bcrypt from "bcryptjs";
import pg from "pg";

import { LOOP_DEMO_ANNOUNCEMENTS, LOOP_DEMO_PRD, LOOP_DEMO_REVIEW, LOOP_DEMO_SUGGESTION } from "@/src/server/demo/immersiveDemo";
import { getEnv } from "@/src/server/env";
import { upsertArtifactPermission } from "@/src/server/repo/artifactPermissions";
import { upsertFolderBySlug } from "@/src/server/repo/folders";
import { encodeSuggestionPayload } from "@/src/server/services/feedbackSuggestionService";
import { slugify } from "@/src/server/slug";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

type SeedUser = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "member";
};

type SeedArtifact = {
  title: string;
  templateSlug: string;
  status: "draft" | "active";
  contentByTitle: Record<string, string>;
};

type SeedBlock = {
  id: string;
  title: string | null;
  type: string;
  content_md: string;
  position: number;
};

function getSeedConfig() {
  return {
    workspaceSlug: process.env.SEED_WORKSPACE_SLUG ?? "demo",
    workspaceName: process.env.SEED_WORKSPACE_NAME ?? "Demo Workspace",
    users: [
      {
        name: process.env.SEED_ADMIN_NAME ?? "Avery Brooks",
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@loop.local",
        password: process.env.SEED_ADMIN_PASSWORD ?? "admin",
        role: "admin" as const,
      },
      {
        name: "Hannah Park",
        email: "hannah@loop.local",
        password: "demo",
        role: "member" as const,
      },
      {
        name: "Marcus Chen",
        email: "marcus@loop.local",
        password: "demo",
        role: "member" as const,
      },
      {
        name: "Priya Nair",
        email: "priya@loop.local",
        password: "demo",
        role: "member" as const,
      },
    ],
  };
}

const RESEARCH_ARTIFACT: SeedArtifact = {
  title: "Voice-first validation study",
  templateSlug: "research-question",
  status: "draft",
  contentByTitle: {
    "Research question":
      "How much faster can a PM get to a credible first draft when they speak an idea instead of writing from a blank page?",
    "Context and motivation":
      "The current planning workflow fragments early product thinking across voice notes, Slack, and docs. This study tests whether Loop can cut through that setup friction.",
    Hypothesis:
      "If the first step is voice capture instead of blank-document writing, teams will create more artifacts and request feedback earlier in the process.",
    "Method / approach":
      "- Recruit 6 PM/design/engineering triads.\n- Compare voice-first capture against traditional doc-first drafting.\n- Measure time to first shareable artifact and first reviewer response.",
    "Data and evidence":
      "| Signal | Baseline | Demo target |\n|---|---|---|\n| Time to first draft | 42 min | 12 min |\n| Time to first async response | 26 hours | 6 hours |\n| Accepted suggestions per artifact | 0.8 | 2.0 |",
    Findings:
      "Early interviews suggest the biggest value is not transcription quality on its own, but the confidence to share an imperfect idea sooner.",
    "Validity risks":
      "- Participants may over-index on novelty.\n- The demo still uses mocked routing and suggestion generation.\n- Teams may behave differently once the workflow becomes routine.",
    "Open questions":
      "- Does suggestion mode increase trust enough to change review behavior?\n- Which roles should get viewer vs editor defaults?",
  },
};

async function main() {
  const env = getEnv();
  const seed = getSeedConfig();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("begin;");

    const workspaceId = await ensureWorkspace(client, {
      slug: seed.workspaceSlug,
      name: seed.workspaceName,
    });

    const userIds = new Map<string, string>();
    for (const user of seed.users) {
      const userId = await ensureUser(client, user);
      userIds.set(user.email.toLowerCase(), userId);
      await ensureMembership(client, {
        workspaceId,
        userId,
        role: user.role,
      });
    }

    const adminId = mustGetUserId(userIds, seed.users[0].email);
    const hannahId = mustGetUserId(userIds, "hannah@loop.local");
    const marcusId = mustGetUserId(userIds, "marcus@loop.local");
    const priyaId = mustGetUserId(userIds, "priya@loop.local");

    for (const template of defaultTemplates) {
      await client.query(
        `insert into templates (workspace_id, slug, name, schema_json, created_by)
         values ($1, $2, $3, $4::jsonb, $5)
         on conflict (workspace_id, slug)
         do update set name = excluded.name, schema_json = excluded.schema_json, updated_at = now()`,
        [workspaceId, template.slug, template.name, JSON.stringify(template.schema), adminId],
      );

      await upsertFolderBySlug(client, {
        workspaceId,
        slug: slugify(template.name),
        name: template.name,
        schemaJson: template.schema,
        createdBy: adminId,
      });
    }

    await ensureWelcomeArtifact(client, { workspaceId, userId: adminId });

    const primaryArtifact = await ensureArtifactFromTemplate(client, {
      workspaceId,
      userId: adminId,
      title: LOOP_DEMO_PRD.title,
      templateSlug: "prd",
      status: "active",
      contentByTitle: {
        Context: LOOP_DEMO_PRD.sections.context,
        Problem: LOOP_DEMO_PRD.sections.problem,
        "Target users": LOOP_DEMO_PRD.sections.targetUsers,
        "Proposed solution": LOOP_DEMO_PRD.sections.proposedSolution,
        "Non-goals": LOOP_DEMO_PRD.sections.nonGoals,
        "Success metrics": LOOP_DEMO_PRD.sections.successMetrics,
        Risks: LOOP_DEMO_PRD.sections.risks,
        Assumptions: LOOP_DEMO_PRD.sections.assumptions,
        "Open questions": LOOP_DEMO_PRD.sections.openQuestions,
        Dependencies: LOOP_DEMO_PRD.sections.dependencies,
        "Rollout notes": LOOP_DEMO_PRD.sections.rolloutNotes,
      },
    });

    await ensureArtifactFromTemplate(client, {
      workspaceId,
      userId: adminId,
      title: RESEARCH_ARTIFACT.title,
      templateSlug: RESEARCH_ARTIFACT.templateSlug,
      status: RESEARCH_ARTIFACT.status,
      contentByTitle: RESEARCH_ARTIFACT.contentByTitle,
    });

    await upsertArtifactPermission(client, {
      workspaceId,
      artifactId: primaryArtifact.id,
      userId: adminId,
      role: "editor",
      grantedBy: adminId,
    });
    await upsertArtifactPermission(client, {
      workspaceId,
      artifactId: primaryArtifact.id,
      userId: hannahId,
      role: "editor",
      grantedBy: adminId,
    });
    await upsertArtifactPermission(client, {
      workspaceId,
      artifactId: primaryArtifact.id,
      userId: marcusId,
      role: "viewer",
      grantedBy: adminId,
    });
    await upsertArtifactPermission(client, {
      workspaceId,
      artifactId: primaryArtifact.id,
      userId: priyaId,
      role: "viewer",
      grantedBy: adminId,
    });

    const proposedSolutionBlock = findBlock(primaryArtifact.blocks, "Proposed solution");
    const dependenciesBlock = findBlock(primaryArtifact.blocks, "Dependencies");
    if (!proposedSolutionBlock || !dependenciesBlock) {
      throw new Error("Demo artifact is missing expected PRD blocks");
    }

    const reviewRequestId = await ensureReviewRequest(client, {
      workspaceId,
      artifactId: primaryArtifact.id,
      title: LOOP_DEMO_REVIEW.title,
      questions: LOOP_DEMO_REVIEW.questions,
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: adminId,
    });

    await ensureReviewTarget(client, reviewRequestId, proposedSolutionBlock.id);
    await ensureReviewTarget(client, reviewRequestId, dependenciesBlock.id);

    const hannahContributionId = await ensureTextContribution(client, {
      workspaceId,
      sourceRef: "demo-review-hannah",
      artifactId: primaryArtifact.id,
      blockId: proposedSolutionBlock.id,
      text: LOOP_DEMO_REVIEW.responseText,
      intent: "feedback",
      intentConfidence: 0.92,
      extractedJson: { keywords: ["slack", "suggestion", "author", "review"] },
      createdBy: hannahId,
    });
    await ensureReviewResponse(client, reviewRequestId, hannahContributionId, hannahId);

    const marcusContributionId = await ensureTextContribution(client, {
      workspaceId,
      sourceRef: "demo-review-marcus",
      artifactId: primaryArtifact.id,
      blockId: dependenciesBlock.id,
      text: LOOP_DEMO_REVIEW.dependencyQuestion,
      intent: "question",
      intentConfidence: 0.88,
      extractedJson: { keywords: ["slack", "routing", "request"] },
      createdBy: marcusId,
    });
    await ensureReviewResponse(client, reviewRequestId, marcusContributionId, marcusId);

    const originalParagraph = firstParagraph(proposedSolutionBlock.content_md);
    await ensureFeedbackItem(client, {
      workspaceId,
      artifactId: primaryArtifact.id,
      blockId: proposedSolutionBlock.id,
      contributionId: hannahContributionId,
      createdBy: hannahId,
      type: "suggestion",
      summary: LOOP_DEMO_SUGGESTION.summary,
      detailMd: encodeSuggestionPayload({
        kind: "suggestion",
        reviewRequestId,
        contributionId: hannahContributionId,
        originalText: originalParagraph,
        suggestedText: LOOP_DEMO_SUGGESTION.suggestedText,
        applyMode: "replace",
      }),
    });

    await ensureFeedbackItem(client, {
      workspaceId,
      artifactId: primaryArtifact.id,
      blockId: dependenciesBlock.id,
      contributionId: marcusContributionId,
      createdBy: marcusId,
      type: "question",
      summary: "Question on Dependencies",
      detailMd: encodeSuggestionPayload({
        kind: "question",
        reviewRequestId,
        contributionId: marcusContributionId,
        originalText: "",
        suggestedText: LOOP_DEMO_REVIEW.dependencyQuestion,
        applyMode: "append",
      }),
    });

    await ensureTextContribution(client, {
      workspaceId,
      sourceRef: "demo-inbox-follow-up-note",
      artifactId: null,
      blockId: null,
      text:
        "Follow-up thought: the request flow should probably support project-management-tool links in addition to Slack so the artifact can reference delivery work without another manual step.",
      intent: "idea",
      intentConfidence: 0.73,
      extractedJson: { keywords: ["project", "management", "slack", "artifact"] },
      createdBy: priyaId,
    });

    for (const announcement of LOOP_DEMO_ANNOUNCEMENTS) {
      await ensureAnnouncement(client, {
        workspaceId,
        title: announcement.title,
        bodyMd: announcement.bodyMd,
        source: announcement.source,
        sourceRef: announcement.sourceRef,
        createdBy: adminId,
      });
    }

    await client.query("commit;");
    process.stdout.write(
      [
        "Seed complete.",
        `- Workspace: ${seed.workspaceSlug}`,
        `- Admin: ${seed.users[0].email} (password: ${seed.users[0].password})`,
        `- Reviewers: hannah@loop.local / demo, marcus@loop.local / demo, priya@loop.local / demo`,
      ].join("\n") + "\n",
    );
  } catch (err) {
    await client.query("rollback;");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureWorkspace(
  client: pg.PoolClient,
  input: { slug: string; name: string },
) {
  const existing = await client.query<{ id: string }>(
    `select id from workspaces where slug = $1`,
    [input.slug],
  );
  if (existing.rowCount) return existing.rows[0].id;

  const created = await client.query<{ id: string }>(
    `insert into workspaces (slug, name) values ($1, $2) returning id`,
    [input.slug, input.name],
  );
  return created.rows[0].id;
}

async function ensureUser(client: pg.PoolClient, input: SeedUser) {
  const emailKey = input.email.toLowerCase();
  const existing = await client.query<{ id: string }>(
    `select id from users where lower(email) = $1`,
    [emailKey],
  );
  const passwordHash = await bcrypt.hash(input.password, 10);

  if (existing.rowCount) {
    await client.query(
      `update users set name = $1, password_hash = $2, updated_at = now() where id = $3`,
      [input.name, passwordHash, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const created = await client.query<{ id: string }>(
    `insert into users (email, name, password_hash) values ($1, $2, $3) returning id`,
    [input.email, input.name, passwordHash],
  );
  return created.rows[0].id;
}

async function ensureMembership(
  client: pg.PoolClient,
  input: { workspaceId: string; userId: string; role: "admin" | "member" },
) {
  await client.query(
    `insert into workspace_memberships (workspace_id, user_id, role)
     values ($1, $2, $3::workspace_role)
     on conflict (workspace_id, user_id) do update set role = excluded.role`,
    [input.workspaceId, input.userId, input.role],
  );
}

async function ensureWelcomeArtifact(
  client: pg.PoolClient,
  input: { workspaceId: string; userId: string },
) {
  const existing = await client.query<{ id: string }>(
    `select id from artifacts where workspace_id = $1 and title = $2`,
    [input.workspaceId, "Welcome to Loop"],
  );
  if (existing.rowCount) return existing.rows[0].id;

  const artifact = await ensureArtifactFromTemplate(client, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    title: "Welcome to Loop",
    templateSlug: "prd",
    status: "active",
    contentByTitle: {
      Context: "Loop captures early product thinking and turns it into structured artifacts, requests, and suggestions.",
      Problem: "Ideas, feedback, and follow-up questions are usually scattered across too many tools.",
      "Target users": "- Product teams\n- Design partners\n- Engineering reviewers",
      "Proposed solution":
        "Use the capture flow for fast voice-first drafting, then open the stakeholder-alignment artifact to see the fully seeded review experience.",
      "Success metrics": "- First artifact in under 3 minutes\n- Feedback in the same source of truth",
      Risks: "- Live integrations are mocked in this demo\n- Final routing behavior is still being refined",
      Assumptions: "- Teams prefer low-friction async collaboration\n- Suggestion mode builds trust",
      "Open questions": "- Which routing defaults make the most sense?\n- Which templates need to be first-class?",
      Dependencies: "- Slack integration\n- Speech-to-text provider",
      "Rollout notes": "Use this workspace as a guided demo and portfolio-style walkthrough of the full Loop experience.",
    },
  });

  return artifact.id;
}

async function ensureArtifactFromTemplate(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    userId: string;
    title: string;
    templateSlug: string;
    status: "draft" | "active";
    contentByTitle: Record<string, string>;
  },
): Promise<{ id: string; blocks: SeedBlock[] }> {
  const builtin = defaultTemplates.find((template) => template.slug === input.templateSlug);
  if (!builtin) throw new Error(`Missing default template: ${input.templateSlug}`);

  const template = await client.query<{ id: string }>(
    `select id from templates where workspace_id = $1 and slug = $2`,
    [input.workspaceId, input.templateSlug],
  );
  const folder = await client.query<{ id: string; structure_version: number }>(
    `select id, structure_version from artifact_folders where workspace_id = $1 and slug = $2`,
    [input.workspaceId, slugify(builtin.name)],
  );

  const existing = await client.query<{ id: string }>(
    `select id from artifacts where workspace_id = $1 and title = $2`,
    [input.workspaceId, input.title],
  );

  let artifactId = existing.rows[0]?.id ?? null;
  if (!artifactId) {
    const created = await client.query<{ id: string }>(
      `insert into artifacts (workspace_id, template_id, folder_id, folder_schema_version, title, status, created_by)
       values ($1, $2, $3, $4, $5, $6::artifact_status, $7)
       returning id`,
      [
        input.workspaceId,
        template.rows[0]?.id ?? null,
        folder.rows[0]?.id ?? null,
        folder.rows[0]?.structure_version ?? null,
        input.title,
        input.status,
        input.userId,
      ],
    );
    artifactId = created.rows[0].id;
  } else {
    await client.query(
      `update artifacts
       set template_id = $1,
           folder_id = $2,
           folder_schema_version = $3,
           status = $4::artifact_status,
           updated_at = now()
       where id = $5`,
      [
        template.rows[0]?.id ?? null,
        folder.rows[0]?.id ?? null,
        folder.rows[0]?.structure_version ?? null,
        input.status,
        artifactId,
      ],
    );
  }

  let blocks = await listSeedBlocks(client, artifactId);
  if (blocks.length === 0) {
    let position = 1;
    for (const block of builtin.schema.defaultBlocks) {
      await client.query(
        `insert into artifact_blocks (artifact_id, type, title, content_md, position, meta, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)`,
        [
          artifactId,
          block.type,
          block.title ?? null,
          block.contentMd ?? "",
          position,
          JSON.stringify({ ...(block.meta ?? {}), origin_key: block.key ?? `${block.type}-${position}` }),
          input.userId,
        ],
      );
      position += 1;
    }
    blocks = await listSeedBlocks(client, artifactId);
  }

  for (const block of blocks) {
    const nextContent = input.contentByTitle[block.title ?? ""];
    if (typeof nextContent !== "string") continue;
    await client.query(
      `update artifact_blocks set content_md = $1, updated_by = $2, updated_at = now() where id = $3`,
      [nextContent, input.userId, block.id],
    );
  }

  await client.query(`update artifacts set updated_at = now() where id = $1`, [artifactId]);
  return { id: artifactId, blocks: await listSeedBlocks(client, artifactId) };
}

async function listSeedBlocks(client: pg.PoolClient, artifactId: string) {
  const res = await client.query<SeedBlock>(
    `select id, title, type, content_md, position
     from artifact_blocks
     where artifact_id = $1
     order by position asc`,
    [artifactId],
  );
  return res.rows;
}

async function ensureReviewRequest(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    title: string;
    questions: string[];
    dueAt: string | null;
    createdBy: string;
  },
) {
  const existing = await client.query<{ id: string }>(
    `select id from review_requests where workspace_id = $1 and artifact_id = $2 and title = $3 limit 1`,
    [input.workspaceId, input.artifactId, input.title],
  );

  if (existing.rowCount) {
    await client.query(
      `update review_requests
       set questions = $1::jsonb, due_at = $2, status = 'open', updated_at = now()
       where id = $3`,
      [JSON.stringify(input.questions), input.dueAt, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const created = await client.query<{ id: string }>(
    `insert into review_requests (workspace_id, artifact_id, title, questions, due_at, created_by, status)
     values ($1, $2, $3, $4::jsonb, $5, $6, 'open')
     returning id`,
    [input.workspaceId, input.artifactId, input.title, JSON.stringify(input.questions), input.dueAt, input.createdBy],
  );
  return created.rows[0].id;
}

async function ensureReviewTarget(client: pg.PoolClient, reviewRequestId: string, blockId: string) {
  await client.query(
    `insert into review_request_targets (review_request_id, block_id)
     values ($1, $2)
     on conflict do nothing`,
    [reviewRequestId, blockId],
  );
}

async function ensureTextContribution(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    sourceRef: string;
    artifactId: string | null;
    blockId: string | null;
    text: string;
    intent: "idea" | "feedback" | "question";
    intentConfidence: number;
    extractedJson: Record<string, unknown> | null;
    createdBy: string | null;
  },
) {
  const existing = await client.query<{ id: string }>(
    `select id from contributions where workspace_id = $1 and source_ref = $2 limit 1`,
    [input.workspaceId, input.sourceRef],
  );

  if (existing.rowCount) {
    await client.query(
      `update contributions
       set artifact_id = $1,
           block_id = $2,
           text_content = $3,
           transcript = $3,
           intent = $4::contribution_intent,
           intent_confidence = $5,
           extracted_json = $6::jsonb,
           created_by = $7
       where id = $8`,
      [
        input.artifactId,
        input.blockId,
        input.text,
        input.intent,
        input.intentConfidence,
        input.extractedJson ? JSON.stringify(input.extractedJson) : null,
        input.createdBy,
        existing.rows[0].id,
      ],
    );
    return existing.rows[0].id;
  }

  const created = await client.query<{ id: string }>(
    `insert into contributions (
       workspace_id, artifact_id, block_id, source, source_ref, text_content, transcript,
       intent, intent_confidence, extracted_json, created_by
     ) values (
       $1, $2, $3, 'web_text', $4, $5, $5,
       $6::contribution_intent, $7, $8::jsonb, $9
     ) returning id`,
    [
      input.workspaceId,
      input.artifactId,
      input.blockId,
      input.sourceRef,
      input.text,
      input.intent,
      input.intentConfidence,
      input.extractedJson ? JSON.stringify(input.extractedJson) : null,
      input.createdBy,
    ],
  );
  return created.rows[0].id;
}

async function ensureReviewResponse(
  client: pg.PoolClient,
  reviewRequestId: string,
  contributionId: string,
  userId: string,
) {
  const existing = await client.query<{ id: string }>(
    `select id from review_responses where review_request_id = $1 and contribution_id = $2 limit 1`,
    [reviewRequestId, contributionId],
  );
  if (existing.rowCount) return existing.rows[0].id;

  const created = await client.query<{ id: string }>(
    `insert into review_responses (review_request_id, contribution_id, user_id)
     values ($1, $2, $3)
     returning id`,
    [reviewRequestId, contributionId, userId],
  );
  return created.rows[0].id;
}

async function ensureFeedbackItem(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    blockId: string;
    contributionId: string;
    createdBy: string;
    type: "suggestion" | "question";
    summary: string;
    detailMd: string;
  },
) {
  const existing = await client.query<{ id: string }>(
    `select id
     from feedback_items
     where workspace_id = $1 and artifact_id = $2 and block_id = $3 and created_from_contribution_id = $4
     limit 1`,
    [input.workspaceId, input.artifactId, input.blockId, input.contributionId],
  );

  if (existing.rowCount) {
    await client.query(
      `update feedback_items
       set type = $1::feedback_type,
           severity = 'low',
           status = 'open',
           summary = $2,
           detail_md = $3,
           created_by = $4,
           resolved_by = null,
           resolved_at = null,
           resolution_note_md = null
       where id = $5`,
      [input.type, input.summary, input.detailMd, input.createdBy, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const created = await client.query<{ id: string }>(
    `insert into feedback_items (
       workspace_id, artifact_id, block_id, type, severity, status,
       summary, detail_md, created_by, created_from_contribution_id
     ) values (
       $1, $2, $3, $4::feedback_type, 'low', 'open',
       $5, $6, $7, $8
     ) returning id`,
    [
      input.workspaceId,
      input.artifactId,
      input.blockId,
      input.type,
      input.summary,
      input.detailMd,
      input.createdBy,
      input.contributionId,
    ],
  );
  return created.rows[0].id;
}

async function ensureAnnouncement(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    title: string;
    bodyMd: string;
    source: "announcement" | "google_meet" | "slack";
    sourceRef: string;
    createdBy: string | null;
  },
) {
  const existing = await client.query<{ id: string }>(
    `select id from announcements where workspace_id = $1 and source_ref = $2 limit 1`,
    [input.workspaceId, input.sourceRef],
  );

  if (existing.rowCount) {
    await client.query(
      `update announcements
       set title = $1, body_md = $2, source = $3::announcement_source, created_by = $4
       where id = $5`,
      [input.title, input.bodyMd, input.source, input.createdBy, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const created = await client.query<{ id: string }>(
    `insert into announcements (workspace_id, title, body_md, source, source_ref, created_by)
     values ($1, $2, $3, $4::announcement_source, $5, $6)
     returning id`,
    [input.workspaceId, input.title, input.bodyMd, input.source, input.sourceRef, input.createdBy],
  );
  return created.rows[0].id;
}

function findBlock(blocks: SeedBlock[], title: string) {
  return blocks.find((block) => block.title === title) ?? null;
}

function firstParagraph(markdown: string) {
  return markdown.split(/\n\s*\n/)[0]?.trim() ?? markdown.trim();
}

function mustGetUserId(map: Map<string, string>, email: string) {
  const userId = map.get(email.toLowerCase());
  if (!userId) throw new Error(`Missing seeded user: ${email}`);
  return userId;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
