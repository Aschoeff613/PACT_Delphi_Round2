import { NextResponse, type NextRequest } from "next/server";
import { REVIEWER_SESSION_COOKIE } from "@/lib/reviewer-session-constants";

/** The ranking page is the whole app, so everything but /login is protected. */
export async function middleware(request: NextRequest) {
  if (!request.cookies.get(REVIEWER_SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/"]
};
