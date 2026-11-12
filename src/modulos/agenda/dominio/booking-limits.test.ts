import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ipLimitKey,
  MAX_BOOKINGS_PER_IP_HOUR,
  MAX_UPCOMING_WEB_PER_CUSTOMER,
} from "./booking-limits";

// The same numbers in TypeScript and in the migration that enforces them.
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261112300000_add_booking_limits.sql",
  ),
  "utf8",
);

function constant(name: string): number {
  const match = new RegExp(
    `function private\\.${name}\\(\\)[\\s\\S]*?select (\\d+)`,
  ).exec(sql);
  return Number(match?.[1]);
}

describe("booking limits", () => {
  it("match the database", () => {
    expect(constant("max_bookings_per_ip_hour")).toBe(MAX_BOOKINGS_PER_IP_HOUR);
    expect(constant("max_upcoming_web_per_customer")).toBe(
      MAX_UPCOMING_WEB_PER_CUSTOMER,
    );
  });

  it("are the founder's", () => {
    expect(MAX_BOOKINGS_PER_IP_HOUR).toBe(10);
    expect(MAX_UPCOMING_WEB_PER_CUSTOMER).toBe(5);
  });
});

describe("ipLimitKey", () => {
  it("counts an IPv4 address as it is", () => {
    expect(ipLimitKey("181.52.10.7")).toBe("181.52.10.7");
    expect(ipLimitKey(" 181.52.10.7 ")).toBe("181.52.10.7");
  });

  it("counts IPv4 written inside IPv6 as the IPv4 address", () => {
    expect(ipLimitKey("::ffff:181.52.10.7")).toBe("181.52.10.7");
    expect(ipLimitKey("::FFFF:181.52.10.7")).toBe("181.52.10.7");
    expect(ipLimitKey("::ffff:b534:a07")).toBe("181.52.10.7");
    expect(ipLimitKey("0:0:0:0:0:ffff:b534:a07")).toBe("181.52.10.7");
  });

  it("counts an IPv6 address by its /64 network", () => {
    expect(ipLimitKey("2800:e2:1:5:aaaa:bbbb:cccc:dddd")).toBe(
      "2800:e2:1:5::/64",
    );
  });

  it("gives every address of the same /64 the same key", () => {
    const keys = [
      "2800:e2:1:5::1",
      "2800:00e2:0001:0005:ffff:ffff:ffff:ffff",
      "2800:E2:1:5:1234:5678:9abc:def0",
    ].map(ipLimitKey);
    expect(new Set(keys)).toEqual(new Set(["2800:e2:1:5::/64"]));
  });

  it("keeps different /64 networks apart", () => {
    expect(ipLimitKey("2800:e2:1:5::1")).not.toBe(ipLimitKey("2800:e2:1:6::1"));
  });

  it("expands compressed zeros in the network half", () => {
    expect(ipLimitKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipLimitKey("::1")).toBe("0:0:0:0::/64");
  });

  it("counts what it does not recognize as it came", () => {
    expect(ipLimitKey("no-es-una-ip")).toBe("no-es-una-ip");
    expect(ipLimitKey("1:2:3")).toBe("1:2:3");
    expect(ipLimitKey("1::2::3")).toBe("1::2::3");
  });
});
