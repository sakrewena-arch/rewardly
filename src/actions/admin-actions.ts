/*
 * admin-actions.ts — BARREL.
 * Les actions admin sont réparties par domaine (chacun porte sa directive
 * "use server") :
 *   - helpers      : utilisateurs/role (requireAdmin)
 *   - analytics    : statistiques
 *   - users        : gestion des utilisateurs
 *   - finance      : dépôts & retraits
 *   - plans        : packs
 *   - tasks        : tâches
 *   - submissions  : validation des soumissions
 *   - categories   : catégories de tâches
 *   - services     : commandes de services
 *   - settings     : paramètres système & moyens de paiement
 */
export * from "./admin-actions-helpers";
export * from "./admin-actions-analytics";
export * from "./admin-actions-users";
export * from "./admin-actions-finance";
export * from "./admin-actions-plans";
export * from "./admin-actions-tasks";
export * from "./admin-actions-submissions";
export * from "./admin-actions-categories";
export * from "./admin-actions-services";
export * from "./admin-actions-settings";

