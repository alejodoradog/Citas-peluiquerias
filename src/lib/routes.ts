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
