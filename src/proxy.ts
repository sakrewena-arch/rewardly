import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl === "https://placeholder.supabase.co") {
    return response;
  }

  const pathname = request.nextUrl.pathname;

  // ============================================================
  // MODE MAINTENANCE
  // Si activé, rediriger toutes les pages utilisateur vers /maintenance
  // (sauf /admin et /maintenance eux-mêmes)
  // ============================================================
  const isAdminPage = pathname.startsWith("/admin");
  const isMaintenancePage = pathname.startsWith("/maintenance");
  const isOfflinePage = pathname.startsWith("/offline");
  const isStaticFile = pathname.startsWith("/_next") || pathname.startsWith("/images") || /\.(svg|png|jpg|jpeg|gif|webp|jfif)$/.test(pathname);

  if (!isAdminPage && !isMaintenancePage && !isOfflinePage && !isStaticFile) {
    try {
      // Vérifier le mode maintenance (fetch direct vers Supabase REST)
      const maintenanceResponse = await fetch(
        `${supabaseUrl}/rest/v1/system_settings?key=eq.maintenance_mode&select=value`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey}`,
          },
          next: { revalidate: 15 },
        }
      );

      if (maintenanceResponse.ok) {
        const data = await maintenanceResponse.json();
        const isMaintenanceOn = data?.[0]?.value === true || data?.[0]?.value === "true";
        if (isMaintenanceOn) {
          return NextResponse.redirect(new URL("/maintenance", request.url));
        }
      }
    } catch {
      // En cas d'erreur, continuer normalement
    }
  }

  // ============================================================
  // PAGES AUTH
  // Seules les pages d'authentification sont gérées ici.
  // ============================================================
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password");

  if (!isAuthPage) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If authenticated and trying to access auth pages, redirect to dashboard
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Matcher toutes les pages web (nécessaire pour le mode maintenance),
     * mais ignorer les fichiers statiques et assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|jfif)$).*)",
  ],
};
