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
  panel: "/panel",
  admin: "/admin",
} as const;
