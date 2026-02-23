import { withClient } from "@/src/server/db";
import { createArtifactFromTemplate } from "@/src/server/services/artifactService";
import { getContributionForWorkspace, linkContributionToArtifact } from "@/src/server/repo/contributions";
import { listBlocks, updateBlockContent } from "@/src/server/repo/artifacts";

export async function renderContributionToArtifact(input: {
  workspaceId: string;
  contributionId: string;
  createdBy: string;
  title: string;
  templateSlug?: string;
  folderId?: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const contribution = await getContributionForWorkspace(client, input.workspaceId, input.contributionId);
      if (!contribution) return null;

      const created = await createArtifactFromTemplate({
        workspaceId: input.workspaceId,
        createdBy: input.createdBy,
        templateSlug: input.templateSlug,
        folderId: input.folderId,
        title: input.title,
      });

      const blocks = await listBlocks(client, created.artifactId);
      const body = (contribution.transcript ?? contribution.text_content ?? "").trim();
      if (body) {
        const target = pickTargetBlock(blocks, contribution.intent);
        const content = `### Captured input\n\n${body}\n`;
        if (target) {
          await updateBlockContent(client, {
            workspaceId: input.workspaceId,
            blockId: target.id,
            contentMd: content,
            userId: input.createdBy,
          });
        }
      }

      await linkContributionToArtifact(client, {
        workspaceId: input.workspaceId,
        contributionId: input.contributionId,
        artifactId: created.artifactId,
      });

      await client.query("commit;");
      return { artifactId: created.artifactId };
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

function pickTargetBlock(
  blocks: Array<{ id: string; type: string; title: string | null }>,
  intent: string,
) {
  const byType = (t: string) => blocks.find((b) => b.type.toLowerCase() === t.toLowerCase());
  const byTitle = (re: RegExp) => blocks.find((b) => (b.title ?? "").toLowerCase().match(re));

  if (intent === "risk") return byType("risk") ?? byTitle(/risk/);
  if (intent === "assumption") return byType("assumption") ?? byTitle(/assumption/);
  if (intent === "question") return byType("question") ?? byTitle(/question/);
  if (intent === "idea") return byTitle(/proposed solution/) ?? byTitle(/solution/) ?? blocks[0];
  if (intent === "feedback") return byTitle(/context/) ?? blocks[0];
  return blocks[0];
}
