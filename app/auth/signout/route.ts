import { NextResponse } from "next/server";
import { clearReviewerSession } from "@/lib/reviewer-session";

export async function POST(request: Request) {
  await clearReviewerSession();

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}
