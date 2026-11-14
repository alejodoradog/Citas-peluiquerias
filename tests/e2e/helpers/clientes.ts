import { expect, type Page } from "@playwright/test";
import {
  addDays,
  fromBogota,
  toBogotaDate,
} from "../../../src/lib/fechas/fechas";
import { textos } from "../../../src/ui/textos";
import { seedAppointment } from "./agenda";
import { createBookableShop, signedInClient } from "./supabase";

// The customers of the Clientes tests (task 4.3), made with the owner's own
// session, as the panel would (RLS applies). Their appointments, past ones
// included, go in with the server key (seedAppointment, task 4.2b):
// - Diego Prada: 2 visits (Corte, then Corte + Barba: $65.000) and 2
//   no-shows, all past, so his profile shows the alert;
// - Laura Vélez: an appointment tomorrow at 4:00 p. m.;
// - Juan Pérez: no email, 1 visit;
// - Camila Rojas: no appointment.
export async function createShopWithCustomers(tag: string) {
  const shop = await createBookableShop(tag);
  const client = await signedInClient(shop.owner.email, shop.owner.password);
  const { data: customers, error } = await client
    .from("customers")
    .insert([
      {
        barbershop_id: shop.id,
        full_name: "Diego Prada",
        email: "diego.prada@correo.com",
        phone: "+573012223344",
        notes: "Prefiere a Ana.",
      },
      {
        barbershop_id: shop.id,
        full_name: "Laura Vélez",
        email: "laura.velez@correo.com",
      },
      {
        barbershop_id: shop.id,
        full_name: "Juan Pérez",
        phone: "+573015556677",
      },
      {
        barbershop_id: shop.id,
        full_name: "Camila Rojas",
        email: "camila.rojas@correo.com",
      },
    ])
    .select("id, full_name");
  if (error) throw error;
  const idOf = (name: string) =>
    customers.find((customer) => customer.full_name === name)!.id;

  const today = toBogotaDate(new Date());
  const appointments: {
    customer: string;
    day: number;
    time: string;
    services: string[];
    status: "confirmed" | "attended" | "no_show";
  }[] = [
    {
      customer: "Diego Prada",
      day: -30,
      time: "10:00",
      services: [shop.services.corte],
      status: "attended",
    },
    {
      customer: "Diego Prada",
      day: -20,
      time: "17:00",
      services: [shop.services.corte, shop.services.barba],
      status: "attended",
    },
    {
      customer: "Diego Prada",
      day: -12,
      time: "11:00",
      services: [shop.services.corte],
      status: "no_show",
    },
    {
      customer: "Diego Prada",
      day: -4,
      time: "10:20",
      services: [shop.services.corte],
      status: "no_show",
    },
    {
      customer: "Juan Pérez",
      day: -8,
      time: "09:00",
      services: [shop.services.corte],
      status: "attended",
    },
    {
      customer: "Laura Vélez",
      day: 1,
      time: "16:00",
      services: [shop.services.corte],
      status: "confirmed",
    },
  ];
  for (const appointment of appointments) {
    await seedAppointment({
      barbershopId: shop.id,
      customerId: idOf(appointment.customer),
      barberId: shop.barbers.ana,
      startsAt: fromBogota(addDays(today, appointment.day), appointment.time),
      serviceIds: appointment.services,
      status: appointment.status,
    });
  }

  return {
    ...shop,
    customers: {
      diego: idOf("Diego Prada"),
      laura: idOf("Laura Vélez"),
      juan: idOf("Juan Pérez"),
      camila: idOf("Camila Rojas"),
    },
  };
}

// A customer and their appointments, read with the owner's session.
export async function customerSnapshot(
  owner: { email: string; password: string },
  customerId: string,
) {
  const client = await signedInClient(owner.email, owner.password);
  const [customer, appointments] = await Promise.all([
    client
      .from("customers")
      .select("full_name, email, phone, notes, anonymized_at")
      .eq("id", customerId)
      .maybeSingle(),
    client
      .from("appointments")
      .select("id, status, price_cop")
      .eq("customer_id", customerId),
  ]);
  if (customer.error) throw customer.error;
  if (appointments.error) throw appointments.error;
  return { customer: customer.data, appointments: appointments.data };
}

// Signs the owner in from /ingresar and waits for the agenda.
export async function signInOwner(
  page: Page,
  owner: { email: string; password: string },
) {
  const ingreso = textos.cuentas.ingreso;
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: ingreso.campos.email })
    .fill(owner.email);
  await page
    .getByLabel(ingreso.campos.password)
    .filter({ visible: true })
    .fill(owner.password);
  await page.getByRole("button", { name: ingreso.enviar }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
}
