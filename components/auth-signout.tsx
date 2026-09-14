"use client";

export function AuthSignOut() {
  return (
    <form action="/auth/signout" method="post">
      <button className="ghost-button" type="submit">
        Sign out
      </button>
    </form>
  );
}
