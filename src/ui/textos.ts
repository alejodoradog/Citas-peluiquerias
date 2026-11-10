import type { AppointmentWriteError } from "@/modulos/agenda/datos/appointment-errors";
import type { BarbershopErrorCode } from "@/modulos/barberias/dominio/registration";
import type { SetupErrorCode as SetupActionErrorCode } from "@/modulos/barberias/acciones/setup";
import type { BarberErrorCode } from "@/modulos/barberias/dominio/barber";
import type { ServiceErrorCode } from "@/modulos/barberias/dominio/service";
import type { AccountErrorCode } from "@/modulos/cuentas/acciones/account";
import { EMAIL_LINK_HOURS } from "@/modulos/cuentas/dominio/email-link";
import { TRIAL_DAYS } from "@/modulos/suscripciones/dominio/trial";

// Error copy lives with each module and is keyed by the codes its actions
// return (decision 0005), plus "invalid" for anything a schema did not name.

export const textos = {
  marca: "Yapoin",
  inicio: {
    titulo: "Tu barbería recibe citas sola, desde un link",
    bajada:
      "Tus clientes reservan a cualquier hora en menos de un minuto. Tú ves la agenda de todos tus barberos en el celular.",
    beneficios: [
      "Menos mensajes contestando horarios",
      "Recordatorios por correo para que no te dejen plantado",
      "Configuras todo en 10 minutos, sin descargar nada",
    ],
    descripcion:
      "Agenda de citas para barberías en Colombia: tus clientes reservan solos desde un link.",
    crearCuenta: "Crear cuenta gratis",
    ingresar: "Ingresar",
    nota: `${TRIAL_DAYS} días gratis. No pedimos tarjeta.`,
  },
  ui: {
    opcional: "(opcional)",
    cargando: "Cargando…",
    paso: (actual: number, total: number) => `Paso ${actual} de ${total}`,
    navegacion: {
      etiqueta: "Principal",
      agenda: "Agenda",
      clientes: "Clientes",
      compartir: "Compartir",
      mas: "Más",
    },
    nuevaCita: "Nueva cita",
    volver: "Volver",
    cerrar: "Cerrar",
    copiar: {
      fallo: "No pudimos copiar. Selecciona el texto y cópialo a mano:",
    },
    compartir: {
      copiado: "Copiamos el link. Pégalo donde lo quieras compartir.",
    },
    qr: {
      falloDescarga:
        "No pudimos descargar el QR. Intenta de nuevo o toma una captura de pantalla.",
    },
  },
  legal: {
    terminos: { titulo: "Términos de uso" },
    privacidad: { titulo: "Política de datos" },
    enPreparacion:
      "Estamos terminando este documento. Muy pronto lo vas a encontrar aquí.",
    volver: "Volver al inicio",
  },
  agenda: {
    errores: {
      slot_taken: "Esa hora ya la tomaron. Elige otra, por favor.",
      unknown: "No pudimos guardar la cita. Intenta de nuevo.",
    } satisfies Record<AppointmentWriteError, string>,
  },
  barberias: {
    errores: {
      owner_name_required: "Escribe tu nombre.",
      owner_name_too_long: "El nombre es muy largo. Usa máximo 100 caracteres.",
      barbershop_name_required: "Escribe el nombre de tu barbería.",
      barbershop_name_too_long:
        "El nombre es muy largo. Usa máximo 100 caracteres.",
      phone_invalid:
        "Escribe un celular colombiano de 10 dígitos, como 300 123 4567.",
    } satisfies Record<BarbershopErrorCode, string>,
  },
  cuentas: {
    registro: {
      titulo: "Crea la cuenta de tu barbería",
      bajada: `Tienes ${TRIAL_DAYS} días gratis para probar todo. No pedimos tarjeta.`,
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
      legal: {
        antes: "Al crear la cuenta aceptas los ",
        terminos: "términos de uso",
        y: " y la ",
        privacidad: "política de datos",
        despues: ".",
      },
      enviar: "Crear cuenta",
      enviando: "Creando tu cuenta…",
      revisaCorreo: {
        titulo: "Revisa tu correo",
        cuerpo: (correo: string) =>
          `Te enviamos un link a ${correo} para confirmar tu cuenta. Si ese correo ya tenía cuenta, ingresa o recupera tu contraseña.`,
        avisoTitulo: "¿No te llegó?",
        avisoCuerpo: `Revisa la carpeta de spam. El link vence en ${EMAIL_LINK_HOURS} horas.`,
        irAIngresar: "Ir a ingresar",
      },
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
      correoConfirmado: {
        titulo: "Listo, tu correo quedó confirmado.",
        cuerpo: "Ingresa con tu correo y contraseña.",
      },
      linkVencido:
        "Ese link venció o ya se usó. Ingresa con tu correo y contraseña; si te falta confirmar el correo, te enviamos otro link.",
    },
    recuperar: {
      titulo: "Recupera tu acceso",
      bajada:
        "Escribe el correo de tu cuenta. Te enviamos un link para crear una contraseña nueva.",
      campos: { email: "Correo" },
      enviar: "Enviar link",
      enviando: "Enviando…",
      enviadoTitulo: "Revisa tu correo",
      enviado:
        "Si ese correo tiene una cuenta, ya te llegó el link. Revisa también la carpeta de spam.",
      linkVencido: "Ese link venció o ya se usó. Pide uno nuevo aquí.",
      volver: "Volver a ingresar",
    },
    confirmar: {
      titulo: "Ya casi",
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
      email_invalid: "Revisa el correo. Debe verse como nombre@correo.com.",
      password_required: "Escribe tu contraseña.",
      password_too_short: "La contraseña debe tener mínimo 8 caracteres.",
      password_too_long: "La contraseña es muy larga.",
      password_mismatch: "Las contraseñas no coinciden.",
      invalid_credentials: "El correo o la contraseña no coinciden.",
      email_not_confirmed:
        "Te falta confirmar tu correo. Te enviamos un link nuevo; revisa también la carpeta de spam.",
      email_taken:
        "Ya existe una cuenta con ese correo. Ingresa o recupera tu contraseña.",
      rate_limited: "Hiciste muchos intentos seguidos. Espera unos minutos.",
      weak_password: "Esa contraseña es muy fácil de adivinar. Usa otra.",
      same_password: "Usa una contraseña distinta a la anterior.",
      link_expired: "Ese link venció o ya se usó. Pide uno nuevo.",
      unknown: "No pudimos completar la acción. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<AccountErrorCode | "invalid", string>,
  },
  panel: {
    cargando: "Cargando tu barbería…",
    saludo: (nombre: string) => `Hola, ${nombre}`,
    prueba: (fecha: string) => `Tu prueba gratis va hasta el ${fecha}.`,
    tuLink: "Link de reservas",
    proximo:
      "Aquí vas a ver tu agenda del día. Mientras tanto, comparte tu link con tus clientes.",
    secciones: {
      clientes: "Clientes",
      compartir: "Compartir tu link",
      mas: "Más",
    },
    pronto: {
      titulo: "Muy pronto",
      cuerpo: "Esta sección llega en las próximas semanas.",
      volver: "Volver a la agenda",
    },
  },
  admin: {
    titulo: "Panel de plataforma",
    cargando: "Cargando…",
    saludo: (nombre: string) => `Hola, ${nombre}`,
    proximo: "Aquí verás las barberías, sus pagos y su estado.",
  },
  asistente: {
    servicios: {
      barra: "Tus servicios",
      paso: "Paso 2 de 3",
      titulo: "¿Qué servicios ofreces?",
      bajada:
        "Te sugerimos los típicos. Toca uno para cambiar precio o duración, o desmárcalo.",
      ofrecer: (nombre: string) => `Ofrecer ${nombre}`,
      editar: (nombre: string) => `Editar ${nombre}`,
      duracion: (minutos: number) => `${minutos} min`,
      agregar: "Agregar otro servicio",
      continuar: "Continuar",
      pie: "Podrás cambiarlos cuando quieras en Más › Servicios.",
      ninguno: "Marca al menos un servicio para continuar.",
    },
    servicio: {
      editar: "Editar servicio",
      nuevo: "Nuevo servicio",
      campos: { nombre: "Nombre", precio: "Precio", duracion: "Duración" },
      ayudaDuracion: "La duración va de 5 a 240 minutos, de 5 en 5.",
      guardar: "Guardar",
      quitar: "Quitar este servicio",
    },
    equipo: {
      barra: "Tu equipo",
      paso: "Paso 3 de 3",
      titulo: "¿Quiénes cortan en tu barbería?",
      bajada:
        "Cada barbero recibe un link privado para ver su agenda. No necesita cuenta ni contraseña.",
      yoCorto: "Yo también corto",
      yoCortoAyuda: "Tu agenda aparece junto a la de los demás.",
      tu: "Tú",
      resumen: (servicios: number) =>
        `Horario de la barbería · ${servicios} ${servicios === 1 ? "servicio" : "servicios"}`,
      agregar: "Agregar barbero",
      terminar: "Terminar",
      terminando: "Guardando…",
      despues: "Lo hago después",
    },
    barbero: {
      agregar: "Agregar barbero",
      editar: "Editar barbero",
      fotoDespues: "La foto la agregas después en Más › Barberos.",
      campos: { nombre: "Nombre visible", correo: "Correo" },
      ayudas: {
        nombre: "Así lo ven tus clientes al reservar.",
        correo:
          "Para enviarle su link y, si quieres, avisarle de cada reserva.",
      },
      servicios: "Servicios que hace",
      horario: "Horario",
      usaHorario: "Usa el horario de la barbería",
      horarioPropio:
        "Si trabaja otro horario, lo cambias después en Más › Barberos.",
      guardar: "Guardar barbero",
      quitar: "Quitar barbero",
    },
    listo: {
      titulo: "¡Tu barbería ya recibe citas!",
      tituloSinBarberos: "Tu barbería está casi lista",
      prueba: (fecha: string) =>
        `Tu prueba gratis va hasta el ${fecha}. Comparte este link con tus clientes.`,
      sinBarberos: "Agrega al menos un barbero para recibir citas.",
      link: "Link de reservas",
      copiar: "Copiar",
      copiado: "Link copiado",
      compartir: "Compartir",
      compartirTexto: (barberia: string) => `Reserva tu cita en ${barberia}`,
      qr: "Código QR del link de reservas",
      descargarQr: "Descargar QR para imprimir",
      agenda: "Ir a mi agenda",
    },
    horario: {
      dias: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      rango: (desde: string, hasta: string) =>
        `${desde} a ${String(hasta).toLocaleLowerCase("es-CO")}`,
    },
    errores: {
      service_name_required: "Escribe el nombre del servicio.",
      service_name_too_long:
        "El nombre es muy largo. Usa máximo 60 caracteres.",
      service_name_taken: "Ya tienes un servicio con ese nombre.",
      service_price_invalid:
        "Escribe el precio en pesos, sin decimales. Ej.: 25.000",
      service_duration_invalid: "Elige una duración de 5 a 240 minutos.",
      barber_name_required: "Escribe el nombre del barbero.",
      barber_name_too_long: "El nombre es muy largo. Usa máximo 60 caracteres.",
      barber_services_required: "Marca al menos un servicio.",
      email_invalid: "Revisa el correo. Debe verse como nombre@correo.com.",
      setup_invalid: "Revisa tus servicios y tu equipo e intenta de nuevo.",
      unknown: "No pudimos guardar. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<
      ServiceErrorCode | BarberErrorCode | SetupActionErrorCode | "invalid",
      string
    >,
  },
  errorGeneral: {
    titulo: "Algo salió mal",
    bajada: "No pudimos cargar esta página.",
    reintentar: "Intentar de nuevo",
  },
} as const;
