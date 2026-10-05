import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Strażnik: uruchamia się przed każdą stroną.
// - odświeża sesję Supabase (ciasteczka),
// - niezalogowanych odsyła na /login,
// - zalogowanych nie wpuszcza ponownie na /login.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims() weryfikuje token – nie usuwaj tej linii, od niej zależy odświeżanie sesji.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return redirectKeepingCookies(request, response, "/login");
  }
  if (isLoggedIn && isLoginPage) {
    return redirectKeepingCookies(request, response, "/");
  }

  return response;
}

// Przekierowanie, które nie gubi świeżo odświeżonych ciasteczek sesji.
function redirectKeepingCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  response.headers.forEach((value, key) => {
    if (key.toLowerCase().match(/^(cache-control|expires|pragma)$/)) {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}

export const config = {
  // Pomijamy pliki statyczne (obrazki, ikony, pliki Next.js).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
