// Every app route the code links or redirects to. Top-level segments are
// also reserved as barbershop links (RESERVED_SLUGS, checked by a test).
// The proxy matcher in src/proxy.ts must stay literal, so it repeats them.
export const routes = {
  home: "/",
  signUp: "/registro",
  signIn: "/ingresar",
  recoverPassword: "/recuperar-clave",
  newPassword: "/nueva-clave",
  confirmEmailLink: "/auth/confirm",
  terms: "/terminos",
  privacy: "/privacidad",
  panel: "/panel",
  setup: "/panel/configurar",
  setupTeam: "/panel/configurar/equipo",
  setupBarber: "/panel/configurar/equipo/barbero",
  setupDone: "/panel/configurar/listo",
  // D-34, an appointment of the agenda, and D-38, a new one (task 4.2).
  panelAppointment: (id: string) => `/panel/citas/${id}`,
  panelAppointmentNew: "/panel/citas/nueva",
  panelClients: "/panel/clientes",
  panelClient: (id: string) => `/panel/clientes/${id}`,
  panelShare: "/panel/compartir",
  panelMore: "/panel/mas",
  panelShopHours: "/panel/horario",
  panelHolidays: "/panel/horario/festivos",
  panelPolicies: "/panel/reservas",
  panelShopProfile: "/panel/datos",
  panelBookingLink: "/panel/link",
  panelNewBarbershop: "/panel/sedes/nueva",
  panelServices: "/panel/servicios",
  panelServiceNew: "/panel/servicios/nuevo",
  panelServiceEdit: (id: string) => `/panel/servicios/${id}`,
  panelBarbers: "/panel/barberos",
  panelBarberNew: "/panel/barberos/nuevo",
  panelBarberEdit: (id: string) => `/panel/barberos/${id}`,
  panelBarberSchedule: (id: string) => `/panel/barberos/${id}/horario`,
  panelBarberLink: (id: string) => `/panel/barberos/${id}/link`,
  // A barber's private agenda (task 4.4). The token is the whole credential:
  // only the owner's screen right after issuing it ever holds this path.
  barberAgenda: (token: string) => `/b/${token}`,
  // Task 4.4: one appointment (B-03) and "Bloquear horas" (B-04).
  barberAppointment: (token: string, id: string) => `/b/${token}/citas/${id}`,
  barberBlock: (token: string) => `/b/${token}/bloquear`,
  // A customer's appointment (task 3.4). The token is the whole credential;
  // only its hash is stored (appointments.manage_token_hash).
  manageAppointment: (token: string) => `/c/${token}`,
  // The public booking page of a barbershop (tasks 3.2 and 3.3).
  booking: (slug: string) => `/${slug}`,
  bookingFlow: (slug: string) => `/${slug}/reservar`,
  bookingConfirmed: (slug: string) => `/${slug}/reservar/confirmada`,
  admin: "/admin",
} as const;

// The query a screen reads after its own save sent the owner back to it, to
// say it was saved (D-58, D-60): "?guardado=1".
export const SAVED_PARAM = "guardado";

export type AgendaQueryParams = {
  vista?: "semana";
  dia?: string;
  barbero?: string;
};
// A free space of the agenda: the barber, the day (YYYY-MM-DD) and the time
// (HH:MM, Bogotá) the new appointment starts from.
export type NewAppointmentParams = {
  barbero?: string;
  dia?: string;
  hora?: string;
};

function withQuery(
  path: string,
  query: Record<string, string | undefined>,
): string {
  // Times keep their colon ("hora=10:30"): it is valid in a query.
  const search = Object.entries(query)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(
      ([key, value]) =>
        `${key}=${encodeURIComponent(value).replaceAll("%3A", ":")}`,
    )
    .join("&");
  return search === "" ? path : `${path}?${search}`;
}

// The agenda (task 4.1, D-30 to D-32) says in its query what it shows, so
// "back" and reloading keep it; without one it is today, by day, everyone.
export function agendaHref(query: AgendaQueryParams = {}): string {
  return withQuery(routes.panel, query);
}

// D-38 from a free space of the agenda, or from its "+" button.
export function newAppointmentHref(query: NewAppointmentParams = {}): string {
  return withQuery(routes.panelAppointmentNew, query);
}

// Task 4.4: "Mi agenda" of a barber (B-01, B-02) says in its query the day
// or the week it shows; without one it is today. ?aviso= carries the code
// of a change that could not be saved, so the screen can say why.
export type BarberAgendaParams = {
  vista?: "semana";
  dia?: string;
  aviso?: string;
};

export function barberAgendaHref(
  token: string,
  query: BarberAgendaParams = {},
): string {
  return withQuery(routes.barberAgenda(token), query);
}
