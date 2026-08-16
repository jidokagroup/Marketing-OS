/**
 * Fetch with a hard timeout, for handing work to a Netlify background
 * function.
 *
 * A background function is supposed to ack with 202 immediately and keep
 * running after that -- callers only need to wait for the ack. But nothing
 * guarantees that: a plan without background-function support, a cold
 * start, or the function silently running synchronously all leave the
 * response hanging instead of failing fast. Without a timeout, an awaited
 * fetch like that blocks the caller (a Server Action, an API route) for as
 * long as the function takes to finish -- which is exactly what background
 * functions exist to avoid waiting for. Timing out here restores that
 * guarantee: the caller always gets an answer quickly, and a timeout is
 * treated the same as "worker unreachable" so callers fall back to their
 * scheduled sweep instead of hanging the user-facing request.
 */
export async function triggerBackgroundFunction(
  url: string,
  secret: string,
  body?: unknown,
  timeoutMs = 8000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    return res.ok || res.status === 202;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
