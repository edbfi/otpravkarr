import { redirect } from "@sveltejs/kit";
import { appendAuditLog } from "$lib/db/repositories/audit";
import { deleteSession } from "$lib/db/repositories/sessions";
import { AuditAction } from "$lib/db/types";
import { SESSION_COOKIE_NAME, sessionCookieDeleteOptions } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, locals, request, url, getClientAddress }) => {
  const sessionType = locals.session?.type;
  const sessionId = cookies.get(SESSION_COOKIE_NAME);

  if (sessionId) {
    deleteSession(sessionId);
  }

  cookies.delete(SESSION_COOKIE_NAME, sessionCookieDeleteOptions(url));

  if (locals.admin) {
    appendAuditLog({
      actor: locals.admin.username,
      action: AuditAction.ADMIN_LOGOUT,
      ipAddress: getClientAddress(),
    });
  }

  const redirectTo = sessionType === "user" ? "/" : "/login";
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("application/json")) {
    // Same Content-Type as Kit's json(), which SvelteKit 3 deprecates; Bun's
    // Response.json would otherwise add a charset parameter.
    return Response.json(
      { ok: true, redirectTo },
      { headers: { "content-type": "application/json" } },
    );
  }

  throw redirect(303, redirectTo);
};
