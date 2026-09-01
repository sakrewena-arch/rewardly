import { NextResponse } from "next/server";
import { sendReminderNotificationsAction } from "@/actions/reminder-actions";

export const dynamic = "force-dynamic";

/**
 * Route CRON : envoie les notifications de rappel automatiques.
 * Protégée par un secret (CRON_SECRET) — à configurer dans Vercel/GitHub.
 *
 * Appelée par :
 *  - GitHub Actions (workflow reminders.yml) toutes les heures
 *  - Vercel Cron (si configuré) : https://rewardly.website/api/notifications/reminders
 *
 * Usage : GET /api/notifications/reminders?secret=CRON_SECRET
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const result = await sendReminderNotificationsAction();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Reminders cron error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'envoi des rappels" },
      { status: 500 }
    );
  }
}