import { prisma } from "@repo/database";
import { deployPlaybook } from "./deployer";

const STARTER_KIT_SLUG = "starter-kit";

export async function deployStarterKit(
    targetOrgId: string,
    targetWorkspaceId: string,
    userId: string
): Promise<void> {
    const playbook = await prisma.playbook.findFirst({
        where: { slug: STARTER_KIT_SLUG, status: "PUBLISHED" },
        include: {
            versions: {
                orderBy: { version: "desc" },
                take: 1
            }
        }
    });

    if (!playbook || playbook.versions.length === 0) {
        console.warn("[StarterKit] No published starter-kit playbook found, skipping");
        return;
    }

    const existing = await prisma.playbookInstallation.findUnique({
        where: {
            playbookId_targetOrgId: {
                playbookId: playbook.id,
                targetOrgId
            }
        }
    });

    if (existing) {
        console.log("[StarterKit] Already installed for org", targetOrgId);
        return;
    }

    const latestVersion = playbook.versions[0]!;

    await deployPlaybook({
        playbookId: playbook.id,
        versionNumber: latestVersion.version,
        targetOrgId,
        targetWorkspaceId,
        userId,
        cleanSlugs: true
    });

    console.log("[StarterKit] Deployed to org", targetOrgId);
}
