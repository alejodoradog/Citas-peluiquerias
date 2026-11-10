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
  panelShare: "/panel/compartir",
  panelMore: "/panel/mas",
  panelServices: "/panel/servicios",
  panelServiceNew: "/panel/servicios/nuevo",
  panelServiceEdit: (id: string) => `/panel/servicios/${id}`,
  panelBarbers: "/panel/barberos",
  panelBarberNew: "/panel/barberos/nuevo",
  panelBarberEdit: (id: string) => `/panel/barberos/${id}`,
  admin: "/admin",
} as const;
