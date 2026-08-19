// ============================================================
// API /api/releases
// Récupère la dernière GitHub Release (artefacts natifs) du repo
// rewardly pour alimenter la page de téléchargement direct.
// Les installateurs Android/Windows/Linux sont produits par
// .github/workflows/release.yml et publiés dans les Releases.
// ============================================================
import { NextResponse } from "next/server";

const GITHUB_REPO = process.env.GITHUB_REPO || "sakrewena-arch/rewardly";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // optionnel (augmente le quota API)

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "rewardly-web",
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=1`,
      { headers, next: { revalidate: 120 } }
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Aucune release disponible" }, { status: 404 });
    }

    const releases = await response.json();
    const release = releases?.[0];
    if (!release?.assets?.length) {
      return NextResponse.json({ error: "Aucun installateur publié" }, { status: 404 });
    }

    // Organiser les assets par plateforme cible
    const assets = release.assets.map((a: any) => ({
      name: a.name,
      size: a.size,
      downloadUrl: a.browser_download_url,
    }));

    const find = (patterns: string[]) =>
      assets.filter((a: any) => patterns.some((p) => a.name.toLowerCase().includes(p)));

    // Prioriser l'APK SIGNÉ : "app-release.apk" passe devant "app-release-unsigned.apk"
    // (Github ne garantit pas l'ordre des assets).
    const android = find([".apk", ".aab"]).sort((a: any, b: any) => {
      const aSigned = a.name.toLowerCase().includes("unsigned") ? 1 : 0;
      const bSigned = b.name.toLowerCase().includes("unsigned") ? 1 : 0;
      return aSigned - bSigned;
    });

    return NextResponse.json({
      tag: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
      notes: release.body,
      android,
      windows: find([".exe"]),
      linux: find([".appimage", ".deb"]),
      macos: find([".dmg"]),
      all: assets,
    });
  } catch (error: any) {
    console.error("releases API error:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des releases" }, { status: 500 });
  }
}