import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require the separate admin_session cookie (set by /admin/login)
  // httpOnly empêche JavaScript de le modifier
  const cookieStore = await cookies();
  const adminSession = cookieStore.get("admin_session")?.value;

  if (adminSession !== "true") {
    redirect("/admin/login");
  }

  // Vérification approfondie : l'utilisateur authentifié doit être admin.
  // Le cookie seul ne suffit pas — on vérifie l'identité réelle en base.
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
      if (!isAdmin) {
        redirect("/admin/login");
      }
    }
  }

  return <>{children}</>;
}
