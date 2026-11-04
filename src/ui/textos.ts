export const textos = {
  inicio: {
    titulo: "Barberías",
    descripcion: "Agendamiento de citas para barberías en Colombia.",
    crearCuenta: "Crear cuenta gratis",
    ingresar: "Ingresar",
  },
  agenda: {
    errores: {
      horaTomada: "Esa hora ya la tomaron. Elige otra, por favor.",
      desconocido: "No pudimos guardar la cita. Intenta de nuevo.",
    },
  },
  cuentas: {
    marca: "Barberías",
    registro: {
      titulo: "Crea la cuenta de tu barbería",
      bajada: "Tienes 20 días gratis para probar todo. No pedimos tarjeta.",
      campos: {
        ownerName: "Tu nombre",
        barbershopName: "Nombre de la barbería",
        phone: "Tu celular",
        email: "Correo",
        password: "Contraseña",
      },
      ayudas: {
        phone:
          "Será también el WhatsApp de tu barbería. Lo puedes cambiar después.",
        email: "Con este correo ingresas y recuperas tu contraseña.",
        password: "Mínimo 8 caracteres.",
      },
      enviar: "Crear cuenta",
      enviando: "Creando tu cuenta…",
      revisaCorreo:
        "Te enviamos un correo para confirmar tu cuenta. Ábrelo para entrar.",
      yaTienes: "¿Ya tienes cuenta?",
      ingresa: "Ingresa",
    },
    ingreso: {
      titulo: "Ingresa a tu barbería",
      campos: { email: "Correo", password: "Contraseña" },
      enviar: "Ingresar",
      enviando: "Ingresando…",
      olvidaste: "¿Olvidaste tu contraseña?",
      sinCuenta: "¿Aún no tienes cuenta?",
      crear: "Crea una gratis",
      sinAcceso:
        "Esta cuenta no tiene acceso. Si crees que es un error, escríbenos.",
    },
    recuperar: {
      titulo: "Recupera tu acceso",
      bajada:
        "Escribe el correo de tu cuenta. Te enviamos un link para crear una contraseña nueva.",
      campos: { email: "Correo" },
      enviar: "Enviar link",
      enviando: "Enviando…",
      enviado:
        "Si ese correo tiene una cuenta, ya te llegó el link. Revisa también la carpeta de spam.",
      linkVencido: "Ese link venció o ya se usó. Pide uno nuevo aquí.",
      volver: "Volver a ingresar",
    },
    confirmar: {
      titulo: "Crea tu contraseña nueva",
      bajada: "Toca el botón para continuar.",
      continuar: "Continuar",
      continuando: "Abriendo…",
    },
    nuevaClave: {
      titulo: "Crea tu contraseña nueva",
      campos: {
        password: "Contraseña nueva",
        confirmation: "Repite la contraseña",
      },
      ayudas: { password: "Mínimo 8 caracteres." },
      enviar: "Guardar contraseña",
      enviando: "Guardando…",
      sinSesion: "Ese link venció o ya se usó.",
      pedirOtro: "Pedir un link nuevo",
      cargando: "Revisando tu link…",
    },
    salir: "Cerrar sesión",
    errores: {
      owner_name_required: "Escribe tu nombre.",
      owner_name_too_long: "El nombre es muy largo. Usa máximo 100 caracteres.",
      barbershop_name_required: "Escribe el nombre de tu barbería.",
      barbershop_name_too_long:
        "El nombre es muy largo. Usa máximo 100 caracteres.",
      phone_invalid:
        "Escribe un celular colombiano de 10 dígitos, como 300 123 4567.",
      email_invalid: "Revisa el correo. Debe verse como nombre@correo.com.",
      password_required: "Escribe tu contraseña.",
      password_too_short: "La contraseña debe tener mínimo 8 caracteres.",
      password_too_long: "La contraseña es muy larga.",
      password_mismatch: "Las contraseñas no coinciden.",
      invalid_credentials: "El correo o la contraseña no coinciden.",
      email_taken:
        "Ya existe una cuenta con ese correo. Ingresa o recupera tu contraseña.",
      rate_limited: "Hiciste muchos intentos seguidos. Espera unos minutos.",
      weak_password: "Esa contraseña es muy fácil de adivinar. Usa otra.",
      same_password: "Usa una contraseña distinta a la anterior.",
      link_expired: "Ese link venció o ya se usó. Pide uno nuevo.",
      unknown: "No pudimos completar la acción. Intenta de nuevo.",
    },
  },
  panel: {
    cargando: "Cargando tu barbería…",
    saludo: (nombre: string) => `Hola, ${nombre}`,
    prueba: (fecha: string) => `Tu prueba gratis va hasta el ${fecha}.`,
    tuLink: "Link de reservas",
    proximo:
      "Lo siguiente es agregar tus servicios y tus barberos. Esa parte llega muy pronto.",
  },
  admin: {
    titulo: "Panel de plataforma",
    cargando: "Cargando…",
    saludo: (nombre: string) => `Hola, ${nombre}`,
    proximo: "Aquí verás las barberías, sus pagos y su estado.",
  },
  errorGeneral: {
    titulo: "Algo salió mal",
    bajada: "No pudimos cargar esta página.",
    reintentar: "Intentar de nuevo",
  },
} as const;

export type ErrorCode = keyof typeof textos.cuentas.errores;
