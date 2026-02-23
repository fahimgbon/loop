export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function errorJson(status: number, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

export function requireMethod(method: string, actual: string) {
  if (method !== actual) {
    throw new Response("Method Not Allowed", { status: 405 });
  }
}

