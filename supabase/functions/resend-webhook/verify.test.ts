import { describe, expect, it } from "vitest";
import {
  eventCodeOf,
  notificationIdOf,
  signatureOf,
  verifySvix,
} from "./verify";

// A made-up secret in Svix's format: "whsec_" and 24 random bytes in base64.
const SECRET = `whsec_${btoa("0123456789abcdefghijklmn")}`;
const NOW = 1_800_000_000;
const BODY = '{"type":"email.bounced"}';

async function headers(body = BODY, timestamp = String(NOW), secret = SECRET) {
  return {
    id: "msg_1",
    timestamp,
    signature: `v1,${await signatureOf(secret, "msg_1", timestamp, body)}`,
  };
}

describe("verifySvix", () => {
  it("accepts a delivery signed with the secret", async () => {
    expect(await verifySvix(SECRET, await headers(), BODY, NOW)).toBe(true);
  });

  it("accepts it among several signatures (a rotated secret)", async () => {
    const good = await headers();
    expect(
      await verifySvix(
        SECRET,
        { ...good, signature: `v1,AAAA ${good.signature}` },
        BODY,
        NOW,
      ),
    ).toBe(true);
  });

  it("refuses a changed body, another secret or no signature", async () => {
    expect(await verifySvix(SECRET, await headers(), `${BODY} `, NOW)).toBe(
      false,
    );
    const other = `whsec_${btoa("zzzzzzzzzzzzzzzzzzzzzzzz")}`;
    expect(
      await verifySvix(
        SECRET,
        await headers(BODY, String(NOW), other),
        BODY,
        NOW,
      ),
    ).toBe(false);
    expect(
      await verifySvix(
        SECRET,
        { id: "msg_1", timestamp: String(NOW), signature: null },
        BODY,
        NOW,
      ),
    ).toBe(false);
  });

  it("refuses a delivery more than 5 minutes off, so it cannot be replayed", async () => {
    const old = await headers(BODY, String(NOW - 301));
    expect(await verifySvix(SECRET, old, BODY, NOW)).toBe(false);
  });

  it("refuses everything while the secret is not set up", async () => {
    expect(await verifySvix("", await headers(), BODY, NOW)).toBe(false);
  });
});

describe("the event", () => {
  const ID = "11111111-2222-4333-8444-555555555555";

  it("reads the queue's id from the tags, as an object or a list", () => {
    expect(notificationIdOf({ data: { tags: { notification_id: ID } } })).toBe(
      ID,
    );
    expect(
      notificationIdOf({
        data: { tags: [{ name: "notification_id", value: ID }] },
      }),
    ).toBe(ID);
    expect(
      notificationIdOf({ data: { tags: { notification_id: "x" } } }),
    ).toBeNull();
    expect(notificationIdOf({})).toBeNull();
  });

  it("records only bounces and complaints", () => {
    expect(eventCodeOf({ type: "email.bounced" })).toBe("bounced");
    expect(eventCodeOf({ type: "email.complained" })).toBe("complained");
    expect(eventCodeOf({ type: "email.delivered" })).toBeNull();
  });
});
