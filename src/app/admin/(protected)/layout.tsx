import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

  return <>{children}</>;
}
