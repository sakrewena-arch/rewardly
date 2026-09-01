-- ============================================================
-- REWARDLY - NOTIFICATIONS DE RAPPEL (août 2026)
-- ============================================================
-- Les notifications de rappel ("Effectuez vos tâches aujourd'hui",
-- "Passez au plan supérieur", "Dépôt en attente") sont générées côté
-- application (Server Action generateDailyRemindersAction + cron
-- sendReminderNotificationsAction) avec déduplication par jour.
--
-- Cette migration ajoute une colonne `reference` sur notifications pour
-- permettre une déduplication robuste (clé unique métier, ex: date).
-- IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_reference
  ON public.notifications(reference);