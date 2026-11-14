import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  type AppointmentDb,
  type AppointmentRecord,
  calendarUrl,
  composeAppointmentEmail,
  composeMyAppointmentsEmail,
  type CustomerDb,
  dayLine,
  linkTokenHash,
  newLinkToken,
  outdatedReason,
  plainName,
  renderAppointmentEmail,
  timeLine,
} from "./appointment-emails";
import type { QueuedMessage } from "./run-queue";

// Saturday, November 21, 2026, 3:00 p. m. in Bogotá.
const START = "2026-11-21T20:00:00+00:00";
const END = "2026-11-21T20:40:00+00:00";

function record(extra: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    status: "confirmed",
    startsAt: START,
    endsAt: END,
    barberName: "Kevin",
    serviceNames: ["Corte", "Barba"],
    customerFirstName: "Camila",
    barbershop: {
      name: "Barbería La Esquina",
      slug: "la-esquina",
      address: "Calle 5 # 38-20",
      locality: "San Fernando",
      cancellationNoticeHours: 2,
    },
    ...extra,
  };
}

function message(
  type: string,
  payload: Record<string, unknown> = { starts_at: START },
): QueuedMessage {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    leaseId: "lease",
    barbershopId: "shop",
    appointmentId: "appt",
    type,
    payload,
    attempts: 1,
    recipient: "camila@example.com",
  };
}

const SITE = "https://www.yapoin.com/";
const MANAGE = "https://www.yapoin.com/c/token";

describe("the link of an email", () => {
  it("is new each time, with the shape of a link of the app", () => {
    const one = newLinkToken();
    expect(one).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(one).not.toBe(newLinkToken());
  });

  it("keeps the hash the app computes (hashLinkToken)", async () => {
    const token = newLinkToken();
    expect(await linkTokenHash(token)).toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
  });
});

describe("names that look like a link", () => {
  it("never reach a greeting or a subject", () => {
    expect(plainName("Camila")).toBe("Camila");
    expect(plainName("J.R.")).toBe("J.R.");
    expect(plainName("https://falso.co/pago")).toBeNull();
    expect(plainName("falso.co")).toBeNull();
    expect(plainName("www.falso.net")).toBeNull();
  });
});

describe("the words", () => {
  it("writes the day and the time in Bogotá", () => {
    expect(dayLine(START)).toBe("sábado 21 de noviembre");
    expect(timeLine(START)).toMatch(/^3:00 p\. ?m\.$/);
  });

  it("adds the appointment to Google Calendar", () => {
    const url = new URL(calendarUrl("Cita en X", START, END, "X, Calle 5"));
    expect(url.searchParams.get("dates")).toBe(
      "20261121T200000Z/20261121T204000Z",
    );
    expect(url.searchParams.get("location")).toBe("X, Calle 5");
  });
});

describe("renderAppointmentEmail", () => {
  const data = (extra = {}) => ({
    appointment: record(),
    manageUrl: MANAGE,
    oldStartsAt: null,
    siteUrl: SITE,
    ...extra,
  });

  it("reminds the customer, with Confirmo, Cancelar, the calendar and the link", () => {
    const email = renderAppointmentEmail("appointment_reminder", data())!;
    expect(email.subject).toMatch(
      /^Tu cita en Barbería La Esquina: sábado 21 de noviembre a las 3:00 p\. ?m\.$/,
    );
    expect(email.text).toContain("Hola, Camila.");
    expect(email.text).toContain("Corte + Barba con Kevin.");
    expect(email.text).toContain("Dirección: Calle 5 # 38-20, San Fernando.");
    expect(email.text).toContain(`Sí, ahí estaré: ${MANAGE}?confirmo=1`);
    expect(email.text).toContain(`No puedo ir: cancelar: ${MANAGE}?cancelar=1`);
    expect(email.text).toContain(`Ver o cambiar mi cita: ${MANAGE}`);
    expect(email.text).toContain("hasta 2 horas antes");
    expect(email.html).toContain("calendar.google.com");
    expect(email.text).toContain(
      "Recibes este correo por una cita en Barbería La Esquina, Calle 5 # 38-20, San Fernando.",
    );
  });

  it("never sends a reminder without its link", () => {
    expect(
      renderAppointmentEmail("appointment_reminder", data({ manageUrl: null })),
    ).toBeNull();
  });

  it("escapes what the barbershop wrote", () => {
    const email = renderAppointmentEmail(
      "appointment_reminder",
      data({
        appointment: record({
          barbershop: { ...record().barbershop, name: '<b>"X"</b>' },
        }),
      }),
    )!;
    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("&lt;b&gt;&quot;X&quot;&lt;/b&gt;");
  });

  it("tells the customer the barbershop cancelled, with a way to book again", () => {
    const email = renderAppointmentEmail(
      "appointment_cancelled",
      data({ manageUrl: null }),
    )!;
    expect(email.subject).toBe("Barbería La Esquina canceló tu cita");
    expect(email.text).toContain(
      "Reservar otra hora: https://www.yapoin.com/la-esquina",
    );
  });

  it("tells the customer the barbershop moved it, from when to when", () => {
    const email = renderAppointmentEmail(
      "appointment_rescheduled",
      data({ oldStartsAt: "2026-11-20T15:00:00+00:00" }),
    )!;
    expect(email.subject).toBe("Barbería La Esquina cambió la hora de tu cita");
    expect(email.text).toMatch(
      /Tu cita pasó del viernes 20 de noviembre a las 10:00 a\. ?m\. al sábado 21 de noviembre a las 3:00 p\. ?m\., con Kevin\./,
    );
    expect(email.text).toContain(`Ver mi cita: ${MANAGE}`);
  });

  it("greets without a name that looks like a link, and keeps the subject on one line", () => {
    const email = renderAppointmentEmail(
      "barber_new_booking",
      data({
        manageUrl: null,
        appointment: record({
          customerFirstName: "falso.co/pago",
          barberName: "Kevin\r\nBcc: x@y.z",
        }),
      }),
    )!;
    expect(email.subject).toMatch(/^Nueva cita: Un cliente, /);
    expect(email.text).not.toContain("falso.co");
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("tells the barber about a new appointment and a cancellation, without links", () => {
    const fresh = renderAppointmentEmail(
      "barber_new_booking",
      data({ manageUrl: null }),
    )!;
    expect(fresh.text).toContain("Hola, Kevin.");
    expect(fresh.text).toMatch(/Camila tiene cita contigo el sábado/);
    expect(fresh.html).not.toContain("/c/");
    const gone = renderAppointmentEmail(
      "barber_booking_cancelled",
      data({ manageUrl: null }),
    )!;
    expect(gone.text).toContain("Ese espacio vuelve a estar libre.");
  });
});

describe("outdatedReason", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");

  it("drops a reminder of an appointment that moved, was cancelled or started", () => {
    const payload = { starts_at: START };
    expect(
      outdatedReason("appointment_reminder", payload, record(), now),
    ).toBeNull();
    expect(
      outdatedReason(
        "appointment_reminder",
        { starts_at: "2026-11-22T20:00:00Z" },
        record(),
        now,
      ),
    ).toBe("outdated");
    expect(
      outdatedReason(
        "appointment_reminder",
        payload,
        record({ status: "cancelled_by_customer" }),
        now,
      ),
    ).toBe("outdated");
    expect(
      outdatedReason(
        "appointment_reminder",
        payload,
        record(),
        Date.parse(START),
      ),
    ).toBe("outdated");
  });

  it("sends a cancellation only while the appointment stays cancelled", () => {
    expect(
      outdatedReason(
        "appointment_cancelled",
        {},
        record({ status: "cancelled_by_barbershop" }),
        now,
      ),
    ).toBeNull();
    expect(outdatedReason("appointment_cancelled", {}, record(), now)).toBe(
      "outdated",
    );
    expect(
      outdatedReason(
        "barber_booking_cancelled",
        {},
        record({ status: "cancelled_by_customer" }),
        now,
      ),
    ).toBeNull();
  });
});

describe("composeAppointmentEmail", () => {
  function fakeDb(found: AppointmentRecord | null = record()) {
    const db: AppointmentDb = {
      appointment: vi.fn(async () => found),
      issueLink: vi.fn(async () => {}),
    };
    return db;
  }
  const env = { siteUrl: SITE };
  const now = Date.parse("2026-11-20T12:00:00Z");

  it("keeps the hash of the link before sending the reminder", async () => {
    const db = fakeDb();
    const email = await composeAppointmentEmail(
      message("appointment_reminder"),
      db,
      env,
      now,
    );
    expect(db.appointment).toHaveBeenCalledWith("shop", "appt");
    const text = "text" in email ? email.text : "";
    const token = /\/c\/([A-Za-z0-9_-]{43})\?confirmo=1/.exec(text)?.[1];
    expect(token).toBeDefined();
    expect(db.issueLink).toHaveBeenCalledWith(
      "shop",
      "appt",
      await linkTokenHash(token!),
    );
  });

  it("issues no link for the barber's notices", async () => {
    const db = fakeDb();
    await composeAppointmentEmail(message("barber_new_booking"), db, env, now);
    expect(db.issueLink).not.toHaveBeenCalled();
  });

  it("cancels an email whose appointment is gone or changed", async () => {
    expect(
      await composeAppointmentEmail(
        message("appointment_reminder"),
        fakeDb(null),
        env,
        now,
      ),
    ).toEqual({ cancel: "no_appointment" });
    const db = fakeDb(record({ status: "cancelled_by_barbershop" }));
    expect(
      await composeAppointmentEmail(
        message("appointment_reminder"),
        db,
        env,
        now,
      ),
    ).toEqual({ cancel: "outdated" });
    expect(db.issueLink).not.toHaveBeenCalled();
  });
});

describe("composeMyAppointmentsEmail", () => {
  const customer = {
    firstName: "Camila",
    hasUpcoming: true,
    barbershop: {
      name: "Barbería La Esquina",
      slug: "la-esquina",
      address: "Calle 5 # 38-20",
      locality: null,
    },
  };
  function fakeDb(found: typeof customer | null = customer) {
    const db: CustomerDb = {
      customer: vi.fn(async () => found),
      issueCustomerLink: vi.fn(async () => {}),
    };
    return db;
  }
  const mine = (payload: Record<string, unknown>) => ({
    ...message("customer_appointments", payload),
    appointmentId: null,
  });
  const id = "c0000000-0000-4000-8000-000000000001";

  it("sends the link to the customer's appointments, keeping only its hash", async () => {
    const db = fakeDb();
    const email = await composeMyAppointmentsEmail(
      mine({ customer_id: id }),
      db,
      { siteUrl: SITE },
    );
    const text = "text" in email ? email.text : "";
    expect(email).toMatchObject({
      subject: "Tus citas en Barbería La Esquina",
    });
    const token = /\/la-esquina\/mis-citas\/([A-Za-z0-9_-]{43})/.exec(
      text,
    )?.[1];
    expect(token).toBeDefined();
    expect(db.issueCustomerLink).toHaveBeenCalledWith(
      "shop",
      id,
      await linkTokenHash(token!),
    );
    expect(text).toContain("El link sirve por 24 horas.");
  });

  it("sends nothing for a customer gone or with nothing upcoming", async () => {
    expect(
      await composeMyAppointmentsEmail(
        mine({ customer_id: id }),
        fakeDb(null),
        {
          siteUrl: SITE,
        },
      ),
    ).toEqual({ cancel: "no_customer" });
    expect(
      await composeMyAppointmentsEmail(
        mine({ customer_id: id }),
        fakeDb({ ...customer, hasUpcoming: false }),
        { siteUrl: SITE },
      ),
    ).toEqual({ cancel: "outdated" });
    expect(
      await composeMyAppointmentsEmail(mine({ customer_id: "x" }), fakeDb(), {
        siteUrl: SITE,
      }),
    ).toEqual({ cancel: "no_customer" });
  });
});
