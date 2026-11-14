import type { ImageUploadErrorCode } from "@/lib/imagenes/keys";
import type { BookingActionErrorCode } from "@/modulos/agenda/acciones/booking";
import type { AppointmentWriteError } from "@/modulos/agenda/datos/appointment-errors";
import type { ManageRefusal } from "@/modulos/agenda/datos/manage-errors";
import type { BarberRefusal } from "@/modulos/agenda/datos/barber-errors";
import type { OwnerRefusal } from "@/modulos/agenda/datos/owner-appointment-errors";
import type { BlockFormCode } from "@/modulos/agenda/dominio/barber-agenda";
import type { PlatformRefusal } from "@/modulos/suscripciones/datos/platform-errors";
import type {
  PaymentFormCode,
  VoidFormCode,
} from "@/modulos/suscripciones/dominio/platform-forms";
import type { ScheduleActionErrorCode } from "@/modulos/barberias/acciones/barber-schedule";
import type { BarberActionErrorCode } from "@/modulos/barberias/acciones/barbers";
import type { BarbershopErrorCode } from "@/modulos/barberias/dominio/registration";
import type { BookingLinkActionErrorCode } from "@/modulos/barberias/acciones/booking-link";
import type {
  DeleteBarbershopErrorCode,
  NewBarbershopActionErrorCode,
} from "@/modulos/barberias/acciones/barbershops";
import { MAX_BARBERSHOPS_PER_ACCOUNT } from "@/modulos/barberias/dominio/barbershop-rules";
import type { PoliciesActionErrorCode } from "@/modulos/barberias/acciones/policies";
import {
  SLUG_CHANGE_LIMIT,
  SLUG_CHANGE_WINDOW_DAYS,
  SLUG_SET_ASIDE_DAYS,
} from "@/modulos/barberias/dominio/slug";
import type { ShopProfileActionErrorCode } from "@/modulos/barberias/acciones/shop-profile";
import type { ServiceActionErrorCode } from "@/modulos/barberias/acciones/services";
import type { ShopHoursActionErrorCode } from "@/modulos/barberias/acciones/shop-hours";
import type { ClosureActionErrorCode } from "@/modulos/barberias/acciones/holidays";
import type { HolidayKey } from "@/lib/fechas/festivos";
import type { SetupErrorCode as SetupActionErrorCode } from "@/modulos/barberias/acciones/setup";
import type { BarberErrorCode } from "@/modulos/barberias/dominio/barber";
import type { BarberLinkErrorCode } from "@/modulos/barberias/dominio/barber-link";
import type { ServiceErrorCode } from "@/modulos/barberias/dominio/service";
import type { AccountErrorCode } from "@/modulos/cuentas/acciones/account";
import { EMAIL_LINK_HOURS } from "@/modulos/cuentas/dominio/email-link";
import { TRIAL_DAYS } from "@/modulos/suscripciones/dominio/trial";

// "1 hora", "2 horas", "1 día", "15 minutos": a span of time, from minutes,
// in the largest whole unit (D-60).
function duracion(minutos: number): string {
  const [cantidad, una, varias] =
    minutos % 1440 === 0
      ? [minutos / 1440, "día", "días"]
      : minutos % 60 === 0
        ? [minutos / 60, "hora", "horas"]
        : [minutos, "minuto", "minutos"];
  return `${cantidad} ${cantidad === 1 ? una : varias}`;
}

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
    // The booking link card of D-14 and D-62.
    linkReservas: {
      copiar: "Copiar",
      copiado: "Link copiado",
      compartir: "Compartir",
      compartirTexto: (barberia: string) => `Reserva tu cita en ${barberia}`,
    },
    qr: {
      etiqueta: "Código QR del link de reservas",
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
    // The owner's agenda (task 4.1): D-30 to D-33.
    cargando: "Cargando tu agenda…",
    // By weekday: 0 is Sunday.
    dias: [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ],
    diasCortos: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    meses: [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    mesesCortos: [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sept",
      "oct",
      "nov",
      "dic",
    ],
    // "sábado 7 de nov"; today goes "Hoy, sábado 7 de nov".
    fecha: (dia: string, numero: number, mes: string) =>
      `${dia} ${numero} de ${mes}`,
    hoy: (fecha: string) => `Hoy, ${fecha}`,
    // "2 – 8 de noviembre", "30 de noviembre – 6 de diciembre".
    semana: (desde: string, hasta: string) => `${desde} – ${hasta}`,
    diaSemana: (dia: string, numero: number) => `${dia} ${numero}`,
    diaHoy: (dia: string) => `${dia} · hoy`,
    vistas: { etiqueta: "Vista", dia: "Día", semana: "Semana" },
    anterior: { dia: "Día anterior", semana: "Semana anterior" },
    siguiente: { dia: "Día siguiente", semana: "Semana siguiente" },
    irAHoy: "Hoy",
    barberos: {
      etiqueta: "Barbero",
      todos: "Todos",
      // The name of the filter button: what it shows now.
      boton: (actual: string) => `Barbero: ${actual}`,
      agendaDe: (nombre: string) => `Agenda de ${nombre}`,
      inactivo: "Inactivo",
    },
    citas: (cantidad: number) =>
      cantidad === 1 ? "1 cita" : `${cantidad} citas`,
    ayudaEspacio: "toca un espacio libre para crear una cita",
    resumen: (citas: string, ayuda: string) => `${citas} · ${ayuda}`,
    sinCitasHoy: "Aún no tienes citas hoy",
    sinCitas: "Sin citas este día",
    cerrado: "Cerrado",
    diaCerrado: "La barbería no abre este día.",
    // "Mario 2 · Andrés 3" under each day of D-32.
    porBarbero: (nombre: string, cantidad: number) => `${nombre} ${cantidad}`,
    ocupacion: (porcentaje: number) => `${porcentaje} % ocupado`,
    estados: {
      new: "Nueva",
      confirmed: "Confirmada",
      manual: "Manual",
      attended: "Atendida",
      no_show: "No asistió",
    },
    manual: "manual",
    minutos: (minutos: number) => `${minutos} min`,
    // What a card of the grid of D-30 has no room for, read after the
    // customer and the services: "10:00 a. m., Nueva".
    cita: (hora: string, estado: string) => `${hora}, ${estado}`,
    bloqueo: "Bloqueado",
    cierre: "Barbería cerrada",
    libre: (hasta: string) => `Libre hasta las ${hasta}`,
    libreDesde: (hora: string, barbero: string) =>
      `Crear cita a las ${hora} con ${barbero}`,
    ahora: (hora: string) => `Ahora, ${hora}`,
    columnas: "Citas del día por barbero",
    vacia: {
      compartir: {
        titulo: "Comparte tu link para recibir la primera cita",
        cuerpo:
          "Ponlo en tu Instagram, en tu estado de WhatsApp y en el espejo de la barbería.",
        boton: "Compartir mi link",
      },
      barberos: {
        titulo: "Envía a tus barberos su link privado",
        cuerpo: "Así ven su agenda y marcan las citas desde su celular.",
        boton: "Ir a barberos",
      },
      manual: {
        titulo: "¿Alguien llamó o llegó sin cita?",
        boton: "Crear cita manual",
      },
    },
    sinBarberos: "Aún no tienes barberos activos. Agrégalos en Más › Barberos.",
    // D-34 to D-39 (task 4.2).
    detalle: "Detalle de la cita",
    detalleCita: {
      titulo: "Cita",
      cargando: "Cargando la cita…",
      editar: "Editar servicios",
      origen: {
        web: "Reservada por la web",
        manual: "Creada por la barbería",
      },
      // "Reservada por la web · hace 20 min".
      origenCuando: (origen: string, cuando: string) => `${origen} · ${cuando}`,
      haceMinutos: (minutos: number) =>
        minutos < 1 ? "hace un momento" : `hace ${minutos} min`,
      haceHoras: (horas: number) =>
        horas === 1 ? "hace 1 hora" : `hace ${horas} horas`,
      chips: {
        canceladaCliente: "Cancelada por el cliente",
        canceladaBarberia: "Cancelada por la barbería",
      },
      cuando: "Cuándo",
      servicios: "Servicios",
      // "Corte (40 min) + Barba (20 min)".
      servicio: (nombre: string, minutos: number) =>
        `${nombre} (${minutos} min)`,
      barbero: "Barbero",
      valor: "Valor",
      // "Hoy, sábado 7 de nov · 10:40 – 11:40 a. m."
      horario: (dia: string, desde: string, hasta: string) =>
        `${dia} · ${desde} – ${hasta}`,
      cliente: "Cliente",
      verFicha: "Ver ficha",
      correo: "Correo",
      celular: "Celular",
      sinCorreo: "Sin correo",
      sinCelular: "Sin celular",
      historial: (visitas: number, inasistencias: number) =>
        `${visitas === 1 ? "1 visita" : `${visitas} visitas`} · ${
          inasistencias === 1
            ? "1 inasistencia"
            : `${inasistencias} inasistencias`
        }`,
      atendida: "Atendida",
      noAsistio: "No asistió",
      reprogramar: "Reprogramar",
      cancelar: "Cancelar cita",
      noEncontrada: "No encontramos esta cita",
      noEncontradaCuerpo: "Puede que sea de otra sede. Vuelve a la agenda.",
      volverAgenda: "Volver a la agenda",
      hechos: {
        attended: "La cita quedó como atendida.",
        no_show: "La cita quedó como no asistió.",
        cancelled: "Cancelaste la cita. La hora quedó libre.",
        rescheduled: "Cambiaste la cita.",
        services: "Cambiaste los servicios de la cita.",
        created: "Creaste la cita.",
      },
    },
    marcar: {
      titulo: "Marcar cita",
      cuerpo: "Elige cómo terminó la cita. Puedes cambiarlo después.",
      nota: "Con 2 o más inasistencias, la ficha del cliente muestra una alerta.",
    },
    cancelar: {
      titulo: "¿Cancelar esta cita?",
      // "Camila Rojas · hoy 10:40 a. m. La hora queda libre."
      cuerpo: (cliente: string, cuando: string) =>
        `${cliente} · ${cuando}. La hora queda libre.`,
      confirmar: "Cancelar cita",
      enviando: "Cancelando…",
      volver: "Volver",
    },
    servicios: {
      titulo: "Editar servicios",
      guardar: "Guardar servicios",
      enviando: "Guardando…",
      detalle: (minutos: number, precio: string) =>
        `${minutos} min · ${precio}`,
    },
    reprogramar: {
      titulo: "Reprogramar cita",
      actual: "Cita actual",
      barbero: "Barbero",
      dia: "Día",
      horas: (minutos: number) => `Horas libres (${minutos} min)`,
      sinHoras: "No hay horas libres ese día. Prueba otro día u otro barbero.",
      guardar: "Guardar cambio",
      enviando: "Guardando…",
    },
    nueva: {
      titulo: "Nueva cita",
      cliente: "Cliente",
      buscar: "Buscar o escribir nombre",
      resultados: "Clientes encontrados",
      visitas: (correo: string | null, visitas: number) =>
        [correo, visitas === 1 ? "1 visita" : `${visitas} visitas`]
          .filter(Boolean)
          .join(" · "),
      crear: (nombre: string) => `Crear cliente nuevo: “${nombre}”`,
      cambiar: "Cambiar cliente",
      correo: "Correo",
      celular: "Celular",
      sinCorreo: {
        titulo: "Sin correo no hay confirmación ni recordatorio",
        cuerpo: "El cliente no recibe nada. Solo pedimos el nombre.",
      },
      servicios: "Servicios",
      barbero: "Barbero",
      sinBarbero: "Ningún barbero activo hace todos esos servicios.",
      diaHora: "Día y hora",
      elegirHora: "Elige día y hora",
      // "Hoy · 3:00 p. m. (hasta 3:40)".
      horaElegida: (dia: string, desde: string, hasta: string) =>
        `${dia} · ${desde} (hasta ${hasta})`,
      soloLibres: (barbero: string) =>
        `Solo mostramos horas libres de ${barbero}.`,
      listo: "Listo",
      crearCita: "Crear cita",
      enviando: "Creando…",
      total: (servicios: number, minutos: number) =>
        `${servicios === 1 ? "1 servicio" : `${servicios} servicios`} · ${minutos} min`,
    },
    bloquear: {
      titulo: "Bloquear horas",
      quien: "¿A quién?",
      todaLaBarberia: "Toda la barbería",
      ayudaQuien: "Elige “Toda la barbería” para cerrar por unas horas.",
      dia: "Día",
      desde: "Desde",
      hasta: "Hasta",
      motivo: "Motivo",
      enviar: "Bloquear",
      enviando: "Bloqueando…",
      // The warning of D-39: who has appointments in the way.
      conCitas: (quien: string, cantidad: number) =>
        `${quien} tiene ${cantidad === 1 ? "1 cita" : `${cantidad} citas`} en ese horario`,
      conCitasTodos: (cantidad: number) =>
        `Hay ${cantidad === 1 ? "1 cita" : `${cantidad} citas`} en ese horario`,
      unaEnMedio: (cita: string) =>
        `${cita} no se cancela sola. Reprográmala o cancélala primero.`,
      variasEnMedio: (citas: string) =>
        `${citas} no se cancelan solas. Reprográmalas o cancélalas primero.`,
      // "Mateo · 12:20 p. m."
      citaCorta: (cliente: string, hora: string) => `${cliente} · ${hora}`,
    },
    // The sheet of a block in D-30 and D-31.
    bloqueoHoja: {
      titulo: "Horas bloqueadas",
      // "Kevin · 1:00 – 2:00 p. m."
      quien: (quien: string, desde: string, hasta: string) =>
        `${quien} · ${desde} – ${hasta}`,
      quitar: "Quitar bloqueo",
      enviando: "Quitando…",
      terminado: "Este bloqueo ya terminó.",
      abrir: (motivo: string, hora: string) => `${motivo}, ${hora}`,
    },
    rechazos: {
      not_found: "Ya no encontramos esto. Vuelve a la agenda.",
      barber_not_found: "Ese barbero ya no está en tu barbería.",
      customer_not_found: "Ese cliente ya no está. Búscalo de nuevo.",
      customer_name_invalid:
        "Escribe el nombre del cliente (hasta 100 letras).",
      customer_email_invalid: "Revisa el correo: no parece válido.",
      customer_phone_invalid: "Revisa el celular: 10 dígitos, empieza por 3.",
      services_required: "Elige al menos un servicio.",
      services_repeated: "Elige cada servicio una sola vez.",
      service_inactive:
        "Uno de los servicios ya no está activo. Revisa la lista.",
      too_long: "La cita pasaría de 8 horas. Quita algún servicio.",
      barber_inactive:
        "Ese barbero está desactivado y no recibe citas ni bloqueos nuevos.",
      barber_does_not_offer_service:
        "Ese barbero no hace todos esos servicios.",
      slot_invalid: "Elige una hora de la lista.",
      too_early: "Esa hora ya pasó. Elige otra.",
      outside_booking_window: "Solo puedes agendar hasta 30 días adelante.",
      closed: "La barbería no abre ese día.",
      outside_hours: "El barbero no trabaja a esa hora.",
      blocked: "Esas horas están bloqueadas.",
      slot_taken: "Esa hora ya la tomaron. Elige otra, por favor.",
      not_confirmed: "La cita cambió mientras tanto. Revísala de nuevo.",
      not_started: "La cita aún no empieza. Márcala cuando llegue la hora.",
      status_invalid: "No se puede hacer ese cambio a la cita.",
      appointment_closed: "Una cita cancelada no cambia de servicios.",
      overlaps_appointment:
        "Hay citas en ese horario. Reprográmalas o cancélalas primero.",
      overlaps_block: "Ya hay un bloqueo en ese horario.",
      range_invalid: "Revisa el día y las horas del bloqueo.",
      block_ended: "Este bloqueo ya terminó.",
      unknown: "No pudimos guardar el cambio. Intenta de nuevo.",
      invalid: "Revisa los datos marcados.",
      end_before_start: "La hora final va después de la inicial.",
      in_the_past: "Esa hora ya pasó. Elige otra.",
    } satisfies Record<OwnerRefusal | "invalid" | BlockFormCode, string>,
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
        "Ese link venció o ya se usó. Ingresa con tu correo y contraseña; si te falta confirmar el correo, podrás pedir otro link.",
      reenviar: {
        enviar: "Enviarme un link nuevo",
        enviando: "Enviando…",
        enviadoTitulo: "Revisa tu correo",
        enviado:
          "Si te falta confirmar, ya te enviamos un link nuevo. Revisa también la carpeta de spam.",
      },
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
        "Te falta confirmar tu correo. Pide un link nuevo aquí abajo.",
      email_taken:
        "Ya existe una cuenta con ese correo. Ingresa o recupera tu contraseña.",
      rate_limited: "Hiciste muchos intentos seguidos. Espera unos minutos.",
      weak_password: "Esa contraseña es muy fácil de adivinar. Usa otra.",
      same_password: "Usa una contraseña distinta a la anterior.",
      link_expired: "Ese link venció o ya se usó. Pide uno nuevo.",
      captcha_failed:
        "No pudimos confirmar que no eres un robot. Intenta de nuevo en un momento.",
      unknown: "No pudimos completar la acción. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<AccountErrorCode | "invalid", string>,
  },
  panel: {
    cargando: "Cargando tu barbería…",
    prueba: (fecha: string) => `Tu prueba gratis va hasta el ${fecha}.`,
    secciones: {
      clientes: "Clientes",
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
      // Read before the row's visible text: "Editar Corte 40 min $25.000".
      editar: "Editar",
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
      sinServicios: (nombres: string) =>
        `${nombres} no tiene servicios. Tócalo y marca al menos uno.`,
      sinServiciosTodos:
        "Vuelve a tus servicios y marca al menos uno para terminar.",
      volverServicios: "Volver a mis servicios",
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
  mas: {
    titulo: "Más",
    cargando: "Cargando…",
    prueba: (fecha: string) => `Prueba gratis hasta el ${fecha}`,
    pruebaDetalle: "Todo está habilitado durante la prueba.",
    secciones: {
      equipo: "Tu equipo",
      barberia: "Tu barbería",
      dinero: "Dinero",
      cuenta: "Tu cuenta",
    },
    servicios: "Servicios",
    conteoServicios: (total: number) =>
      `${total} ${total === 1 ? "servicio" : "servicios"}`,
    barberos: "Barberos y horarios",
    conteoBarberos: (total: number) =>
      `${total} ${total === 1 ? "barbero" : "barberos"}`,
    datos: "Datos y fotos",
    horario: "Horario",
    festivos: "Festivos y cierres",
    politicas: "Reservas y cancelaciones",
    link: "Link de reservas",
    abono: "Datos de abono",
    cierre: "Cierre del día",
    pronto: "Pronto",
    correo: "Correo de ingreso",
    volver: "Volver a Más",
  },
  // D-62. The link card's buttons are in ui.linkReservas.
  compartir: {
    titulo: "Compartir",
    subtitulo: "Tu link de reservas",
    cargando: "Cargando tu link…",
    bajada:
      "Ponlo en tu Instagram, en tu estado de WhatsApp y en el espejo de la barbería.",
    qrTitulo: "Reserva tu cita aquí",
    descargarQr: "Descargar QR",
    afiche: "Afiche",
    // Under the QR card of the poster.
    aficheAyuda: "Abre la cámara de tu celular y apunta al código",
    falloAfiche:
      "No pudimos crear el afiche. Intenta de nuevo o toma una captura de pantalla.",
    texto: {
      titulo: "Texto listo para enviar",
      copiar: "Copiar texto",
      copiado: "Texto copiado",
    },
    // The link goes without the protocol, as the design writes it.
    mensaje: (barberia: string, link: string) =>
      `¡Ya puedes reservar tu cita en ${barberia} sin escribirnos! Elige servicio, barbero y hora aquí: ${link}`,
  },
  servicios: {
    titulo: "Servicios",
    cargando: "Cargando tus servicios…",
    bajada:
      "Tus clientes pueden elegir varios en la misma cita. La cita dura lo que sumen.",
    agregar: "Agregar servicio",
    inactivos: "Inactivos",
    inactivo: "Inactivo",
    duracion: (minutos: number) => `${minutos} min`,
    detalle: (duracion: string, precio: string) => `${duracion} · ${precio}`,
    vacio: {
      titulo: "Aún no tienes servicios",
      cuerpo: "Agrega lo que ofreces para que tus clientes puedan reservar.",
    },
    nuevo: "Nuevo servicio",
    editar: "Editar servicio",
    campos: { nombre: "Nombre", precio: "Precio", duracion: "Duración" },
    ayudaDuracion: "La duración va de 5 a 240 minutos, de 5 en 5.",
    quien: "¿Quién lo hace?",
    sinBarberos:
      "Aún no tienes barberos activos. Los agregas en Más › Barberos y horarios.",
    activo: "Activo",
    activoAyuda:
      "Si lo desactivas, no aparece al reservar. Las citas ya tomadas se mantienen.",
    guardar: "Guardar",
    guardando: "Guardando…",
    errores: {
      service_name_required: "Escribe el nombre del servicio.",
      service_name_too_long:
        "El nombre es muy largo. Usa máximo 60 caracteres.",
      service_name_taken: "Ya tienes un servicio con ese nombre.",
      service_price_invalid:
        "Escribe el precio en pesos, sin decimales. Ej.: 25.000",
      service_duration_invalid: "Elige una duración de 5 a 240 minutos.",
      barbers_not_saved:
        "Guardamos el servicio, pero no quién lo hace. Ábrelo en Servicios y guárdalo de nuevo.",
      unknown: "No pudimos guardar. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<ServiceActionErrorCode | "invalid", string>,
  },
  barberos: {
    titulo: "Barberos",
    cargando: "Cargando tu equipo…",
    agregar: "Agregar barbero",
    tu: "Tú",
    inactivos: "Inactivos",
    inactivo: "Inactivo",
    horarioBarberia: "Horario de la barbería",
    horarioPropio: "Horario propio",
    conteoServicios: (total: number) =>
      `${total} ${total === 1 ? "servicio" : "servicios"}`,
    // After the separator of D-53, in lowercase as in the design.
    linkActivo: "link activo",
    linkSinEnviar: "link sin enviar",
    linkDesactivado: "link desactivado",
    sinLink: "sin link (eres tú)",
    seFue: (fecha: string) => `Se fue el ${fecha}`,
    // Between the parts of a barber's line in D-53.
    separador: " · ",
    vacio: {
      titulo: "Aún no tienes barberos",
      cuerpo:
        "Agrega a quienes cortan en tu barbería para que tus clientes reserven con ellos.",
    },
    nuevo: "Nuevo barbero",
    editar: "Editar barbero",
    foto: {
      agregar: "Agregar foto",
      cambiar: "Cambiar foto",
      quitar: "Quitar foto",
      quitando: "Quitando foto…",
      subiendo: "Subiendo foto…",
      lista: "Foto lista. Se guarda al tocar Guardar.",
      falloQuitar: "No pudimos quitar la foto. Intenta de nuevo.",
      ayuda: "Tus clientes la ven al elegir con quién reservar.",
      errores: {
        photo_not_image: "Ese archivo no es una foto. Elige una imagen.",
        photo_unreadable:
          "No pudimos abrir esa foto. Prueba con otra o toma una nueva.",
        photo_too_big: "La foto es muy pesada. Prueba con otra.",
        photo_quota:
          "Llegaste al máximo de fotos. Quita alguna que no uses o intenta más tarde.",
        photo_upload_failed:
          "No pudimos subir la foto. Revisa tu conexión e intenta de nuevo.",
      } satisfies Record<ImageUploadErrorCode, string>,
    },
    campos: { nombre: "Nombre visible", correo: "Correo" },
    ayudas: {
      nombre: "Así lo ven tus clientes al reservar.",
      correo: "Para enviarle su link y, si quieres, avisarle de cada reserva.",
    },
    avisos: "Avisos por correo",
    avisosAyuda: "Le llega un correo con cada nueva reserva o cancelación.",
    avisosSinCorreo: "Escribe su correo arriba para poder activarlos.",
    horario: "Horario",
    linkPrivado: "Link privado",
    linkNuevo: "Lo creamos al guardar.",
    linkDueno: "No lo necesitas: ves toda la agenda desde tu cuenta.",
    linkActivoChip: "Activo",
    linkSinEnviarChip: "Sin enviar",
    linkDesactivadoChip: "Desactivado",
    linkEnviado: (fecha: string) => `Enviado el ${fecha}`,
    linkSinEnviarAyuda: "Aún no se lo has enviado",
    servicios: "Servicios que hace",
    sinServicios:
      "Aún no tienes servicios activos. Los agregas en Más › Servicios.",
    // Decision 6 of task 2.2: deactivating a barber does not turn off their
    // link (spec), unlike the copy of the design.
    desactivar: (nombre: string) => `Desactivar a ${nombre}`,
    desactivarAyuda:
      "Deja de aparecer al reservar y no recibe citas nuevas. Sus citas ya tomadas se conservan y su link sigue funcionando.",
    confirmar: {
      titulo: (nombre: string) => `¿Desactivar a ${nombre}?`,
      cuerpo:
        "Deja de aparecer al reservar y no recibe citas nuevas. Sus citas ya tomadas se conservan y con su link las sigue atendiendo. Puedes volver a activarlo cuando quieras.",
      si: (nombre: string) => `Sí, desactivar a ${nombre}`,
      desactivando: "Desactivando…",
      no: "Cancelar",
    },
    inactivoAviso: (fecha: string) => `Inactivo desde el ${fecha}`,
    inactivoDetalle: "No aparece al reservar ni recibe citas nuevas.",
    reactivar: (nombre: string) => `Volver a activar a ${nombre}`,
    reactivando: "Activando…",
    guardar: "Guardar",
    guardando: "Guardando…",
    errores: {
      barber_name_required: "Escribe el nombre del barbero.",
      barber_name_too_long: "El nombre es muy largo. Usa máximo 60 caracteres.",
      barber_services_required: "Marca al menos un servicio.",
      email_invalid: "Revisa el correo. Debe verse como nombre@correo.com.",
      notifications_need_email:
        "Escribe su correo para enviarle avisos, o apaga los avisos.",
      photo_invalid: "No pudimos guardar la foto. Elígela de nuevo.",
      services_not_saved:
        "Guardamos al barbero, pero no sus servicios. Ábrelo en Barberos y guárdalo de nuevo.",
      owner_cannot_deactivate: "Tu propia agenda no se desactiva desde aquí.",
      unknown: "No pudimos guardar. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<BarberActionErrorCode | "invalid", string>,
    // D-56, a barber's private link (task 2.3). There is no "Enviar a …"
    // button until emails arrive (task 5.2): "Compartir" opens WhatsApp or
    // the email app of the phone.
    link: {
      titulo: (nombre: string) => `Link privado de ${nombre}`,
      tituloCargando: "Link privado",
      estadoDesactivado: "Link desactivado",
      cargando: "Cargando el link…",
      alcance: (nombre: string) =>
        `Con este link ${nombre} ve su agenda del día y la semana, marca citas y bloquea sus horas. No ve totales, reportes ni a los demás barberos.`,
      // An inactive barber takes no new blocks (spec).
      alcanceInactivo: (nombre: string) =>
        `Con este link ${nombre} ve su agenda del día y la semana y marca las citas que ya tenía. No ve totales, reportes ni a los demás barberos.`,
      reemplaza: {
        titulo: "Cada link nuevo reemplaza al anterior",
        cuerpo:
          "El anterior deja de funcionar. Guardamos el link de forma segura y no lo podemos volver a mostrar.",
      },
      inactivo: {
        titulo: "Con su link solo atiende las citas que ya tenía",
        cuerpo: "Está inactivo: no aparece al reservar ni recibe citas nuevas.",
      },
      desactivado: {
        titulo: (nombre: string) => `${nombre} no puede entrar`,
        cuerpo:
          "Su link está desactivado. Crea uno nuevo y envíaselo cuando vuelva a necesitarlo.",
      },
      copiarNuevo: "Copiar link nuevo",
      crearNuevo: "Crear link nuevo",
      creando: "Creando el link…",
      desactivar: "Desactivar link",
      desactivarAyuda: (nombre: string) =>
        `Úsalo si ${nombre} perdió el celular o se fue. Deja de funcionar al instante.`,
      // Right after a new link: the only time it is shown.
      nuevo: {
        etiqueta: "Link nuevo",
        titulo: "Este link solo se muestra ahora",
        cuerpo: (nombre: string) =>
          `Envíaselo a ${nombre} ya. Si sales de esta pantalla, tendrás que crear otro.`,
        copiado: "Copiamos el link. Pégalo en el chat o en el correo.",
        copiarOtraVez: "Copiar otra vez",
        compartir: "Compartir",
        compartirTitulo: "Tu agenda en Yapoin",
        compartirTexto: (nombre: string) =>
          `Hola, ${nombre}. Con este link ves tu agenda en Yapoin. No se lo pases a nadie.`,
      },
      confirmarNuevo: {
        titulo: "¿Crear un link nuevo?",
        cuerpo: (nombre: string) =>
          `${nombre} deja de entrar con el que tiene. Tendrás que enviarle el nuevo.`,
        si: "Sí, crear link nuevo",
        no: "Cancelar",
      },
      confirmarDesactivar: {
        titulo: (nombre: string) => `¿Desactivar el link de ${nombre}?`,
        cuerpo: (nombre: string) =>
          `${nombre} deja de entrar a su agenda al instante. Para que vuelva a entrar tendrás que crearle un link nuevo.`,
        si: "Sí, desactivar link",
        desactivando: "Desactivando…",
        no: "Cancelar",
      },
      errores: {
        owner_has_no_link:
          "Tú no necesitas link: ves toda la agenda desde tu cuenta.",
        not_found:
          "No encontramos a este barbero. Vuelve a Barberos e intenta de nuevo.",
        unknown: "No pudimos hacer el cambio. Intenta de nuevo.",
      } satisfies Record<BarberLinkErrorCode, string>,
    },
  },
  // D-55, a barber's own hours (decision 8 of task 2.2).
  horario: {
    titulo: (nombre: string) => `Horario de ${nombre}`,
    tituloCargando: "Horario",
    cargando: "Cargando el horario…",
    usaBarberia: "Usa el horario de la barbería",
    barberiaSinHorario: "La barbería aún no tiene horario.",
    bajada:
      "Su horario va dentro del de la barbería. Puedes partir la jornada en dos tramos.",
    // By weekday: 0 is Sunday.
    dias: [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ],
    // The name of each day's switch; on screen it reads as the day alone.
    trabaja: (dia: string) => `Trabaja el ${dia.toLocaleLowerCase("es-CO")}`,
    descansa: "Descansa",
    tramos: ["Primer tramo", "Segundo tramo"],
    desde: "Desde",
    hasta: "Hasta",
    partir: "Partir la jornada",
    partirDia: (dia: string) =>
      `Partir la jornada del ${dia.toLocaleLowerCase("es-CO")}`,
    quitar: "Quitar",
    quitarDia: (dia: string) =>
      `Quitar el segundo tramo del ${dia.toLocaleLowerCase("es-CO")}`,
    // After hours_outside_shop, what the barbershop opens that day.
    barberiaAbre: (horas: string) => `Ese día la barbería abre ${horas}.`,
    barberiaCerrada: "Ese día la barbería no abre.",
    guardar: "Guardar horario",
    guardando: "Guardando…",
    errores: {
      hours_invalid: "Elige las horas de la lista, de 15 en 15 minutos.",
      hours_too_many: "Máximo dos tramos por día.",
      hours_order: "La hora de «Hasta» debe ser después de la de «Desde».",
      hours_overlap:
        "Los dos tramos se cruzan. El segundo debe empezar después de que termine el primero.",
      hours_outside_shop: "Se sale del horario de la barbería.",
      unknown: "No pudimos guardar el horario. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<ScheduleActionErrorCode | "invalid", string>,
  },
  // D-58. The days, shifts and their buttons are in horario.
  horarioBarberia: {
    titulo: "Horario de la barbería",
    cargando: "Cargando el horario…",
    bajada: "Los barberos trabajan dentro de este horario.",
    // The name of each day's switch; on screen it reads as the day alone.
    abre: (dia: string) => `Abre el ${dia.toLocaleLowerCase("es-CO")}`,
    cerrado: "Cerrado",
    festivos: "Festivos y cierres especiales",
    festivosDetalle: "Festivos cerrados, salvo los que abras",
    guardar: "Guardar horario",
    guardando: "Guardando…",
    guardado: "Guardamos el horario.",
    // Barbers with own hours beyond the barbershop's: theirs are not cut.
    fuera: (nombres: readonly string[]) =>
      `${new Intl.ListFormat("es-CO", { type: "conjunction" }).format(nombres)} ${
        nombres.length === 1 ? "tiene" : "tienen"
      } horas fuera de este horario`,
    fueraDetalle: "En esas horas no recibirán citas. Revisa su horario:",
    errores: {
      hours_invalid: "Elige las horas de la lista, de 15 en 15 minutos.",
      hours_too_many: "Máximo dos tramos por día.",
      hours_order: "La hora de «Hasta» debe ser después de la de «Desde».",
      hours_overlap:
        "Los dos tramos se cruzan. El segundo debe empezar después de que termine el primero.",
      hours_required: "Abre al menos un día de la semana.",
      unknown: "No pudimos guardar el horario. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<ShopHoursActionErrorCode | "invalid", string>,
  },
  // D-59. Dates and hours arrive written ("jueves 24 de diciembre",
  // "2:00 p. m.").
  festivos: {
    titulo: "Festivos y cierres",
    cargando: "Cargando los festivos…",
    festivos: "Festivos de Colombia",
    bajada:
      "Por defecto cerramos. Activa los que abres; usamos tu horario de ese día.",
    // By the keys of src/lib/fechas/festivos.ts.
    nombres: {
      new_year: "Año Nuevo",
      epiphany: "Reyes Magos",
      saint_joseph: "San José",
      holy_thursday: "Jueves Santo",
      good_friday: "Viernes Santo",
      labor_day: "Día del Trabajo",
      ascension: "Ascensión del Señor",
      corpus_christi: "Corpus Christi",
      sacred_heart: "Sagrado Corazón",
      saints_peter_and_paul: "San Pedro y San Pablo",
      chiquinquira: "Virgen de Chiquinquirá",
      independence_day: "Día de la Independencia",
      battle_of_boyaca: "Batalla de Boyacá",
      assumption: "Asunción de la Virgen",
      columbus_day: "Día de la Raza",
      all_saints: "Todos los Santos",
      cartagena_independence: "Independencia de Cartagena",
      immaculate_conception: "Inmaculada Concepción",
      christmas: "Navidad",
    } satisfies Record<HolidayKey, string>,
    cierres: "Cierres especiales",
    sinCierres: "No tienes cierres programados",
    sinCierresDetalle:
      "Agrega uno para cerrar la barbería un día, varios o unas horas.",
    todaLaBarberia: "Toda la barbería",
    // How a closure reads, by its kind (dominio/closures.ts).
    cierre: {
      day: (dia: string) => `${dia} · todo el día`,
      days: (desde: string, hasta: string) => `Del ${desde} al ${hasta}`,
      from: (dia: string, hora: string) => `${dia} · desde ${hora}`,
      until: (dia: string, hora: string) => `${dia} · hasta ${hora}`,
      between: (dia: string, desde: string, hasta: string) =>
        `${dia} · ${desde} – ${hasta}`,
      span: (dia: string, desde: string, otroDia: string, hasta: string) =>
        `Del ${dia}, ${desde}, al ${otroDia}, ${hasta}`,
    },
    // 24:00, the end of a closure that runs to the end of the day.
    medianoche: "medianoche",
    opcionMedianoche: "12:00 a. m. (medianoche)",
    borrar: (cierre: string) => `Borrar el cierre: ${cierre}`,
    agregar: "Agregar cierre",
    agregado: "Agregamos el cierre.",
    guardar: "Guardar",
    guardando: "Guardando…",
    guardado: "Guardamos los festivos.",
    errores: {
      unknown: "No pudimos guardar los festivos. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    },
    // The sheet "Agregar cierre".
    hoja: {
      titulo: "Agregar cierre",
      desdeFecha: "Desde el día",
      hastaFecha: "Hasta el día",
      todoElDia: "Todo el día",
      desdeHora: "Desde la hora",
      hastaHora: "Hasta la hora",
      motivo: "Motivo",
      motivoAyuda: "Por ejemplo, Nochebuena. Tus clientes no lo ven.",
      citas: "Las citas que ya tienes en esas horas se mantienen.",
      guardar: "Agregar cierre",
      guardando: "Agregando…",
      errores: {
        closure_date_invalid: "Elige una fecha.",
        closure_time_invalid: "Elige una hora de la lista.",
        closure_order: "Debe terminar después de empezar.",
        closure_past:
          "Ese cierre ya terminó. Elige una fecha que no haya pasado.",
        closure_too_long: "Máximo 31 días seguidos.",
        closure_reason_too_long: "Usa máximo 200 caracteres.",
        unknown: "No pudimos agregar el cierre. Intenta de nuevo.",
        invalid: "Revisa este dato.",
      } satisfies Record<ClosureActionErrorCode | "invalid", string>,
    },
    // Before removing a closure.
    confirmar: {
      titulo: "¿Borrar este cierre?",
      cuerpo: "Tus clientes podrán volver a reservar en esas horas.",
      si: "Sí, borrar",
      borrando: "Borrando…",
      no: "Cancelar",
      fallo: "No pudimos borrar el cierre. Intenta de nuevo.",
    },
  },
  // D-60.
  politicas: {
    titulo: "Reservas y cancelaciones",
    cargando: "Cargando…",
    anticipacion: "Anticipación mínima para reservar",
    anticipacionAyuda: "Nadie puede reservar para dentro de menos tiempo.",
    // An option of the select, from minutes: "1 hora antes".
    anticipacionOpcion: (minutos: number) =>
      minutos === 0 ? "Sin anticipación" : `${duracion(minutos)} antes`,
    ventana: "Hasta cuándo pueden reservar",
    ventanaValor: (dias: number) => `${dias} días hacia adelante`,
    cancelar: "Pueden cancelar o cambiar hasta",
    cancelarAyuda:
      "Después, el link del correo ya no lo permite y les mostramos tu WhatsApp.",
    // An option of the select, from hours: "2 horas antes".
    cancelarOpcion: (horas: number) =>
      horas === 0 ? "La hora de la cita" : `${duracion(horas * 60)} antes`,
    siempre: "Tú siempre puedes cancelar o cambiar",
    siempreDetalle: "Si tiene correo, le avisamos.",
    guardar: "Guardar",
    guardando: "Guardando…",
    errores: {
      min_booking_notice_invalid: "Elige una de las opciones de la lista.",
      cancellation_notice_invalid: "Elige una de las opciones de la lista.",
      unknown: "No pudimos guardar. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<PoliciesActionErrorCode | "invalid", string>,
  },
  // D-57, Más › Datos y fotos.
  datos: {
    titulo: "Datos y fotos",
    cargando: "Cargando…",
    logo: {
      // The placeholder with the initials, named for screen readers.
      actual: "Logo actual",
      sinLogo: "Sin logo",
      agregar: "Agregar logo",
      cambiar: "Cambiar logo",
      quitar: "Quitar logo",
      quitando: "Quitando logo…",
      subiendo: "Subiendo logo…",
      lista: "Logo listo. Se guarda al tocar Guardar.",
      falloQuitar: "No pudimos quitar el logo. Intenta de nuevo.",
      errores: {
        photo_not_image: "Ese archivo no es una imagen. Elige tu logo.",
        photo_unreadable:
          "No pudimos abrir esa imagen. Prueba con otra o toma una foto.",
        photo_too_big: "La imagen es muy pesada. Prueba con otra.",
        photo_quota:
          "Llegaste al máximo de imágenes. Quita alguna que no uses o intenta más tarde.",
        photo_upload_failed:
          "No pudimos subir la imagen. Revisa tu conexión e intenta de nuevo.",
      } satisfies Record<ImageUploadErrorCode, string>,
    },
    portada: {
      agregar: "Foto de portada · toca para agregarla",
      cambiar: "Foto de portada · toca para cambiar",
      quitar: "Quitar portada",
      quitando: "Quitando portada…",
      subiendo: "Subiendo portada…",
      lista: "Portada lista. Se guarda al tocar Guardar.",
      falloQuitar: "No pudimos quitar la portada. Intenta de nuevo.",
      errores: {
        photo_not_image: "Ese archivo no es una foto. Elige una imagen.",
        photo_unreadable:
          "No pudimos abrir esa foto. Prueba con otra o toma una nueva.",
        photo_too_big: "La foto es muy pesada. Prueba con otra.",
        photo_quota:
          "Llegaste al máximo de fotos. Quita alguna que no uses o intenta más tarde.",
        photo_upload_failed:
          "No pudimos subir la foto. Revisa tu conexión e intenta de nuevo.",
      } satisfies Record<ImageUploadErrorCode, string>,
    },
    campos: {
      nombre: "Nombre de la barbería",
      direccion: "Dirección",
      barrio: "Barrio y ciudad",
      whatsapp: "WhatsApp de la barbería",
    },
    ayudas: {
      nombre: "Cambiarlo no cambia tu link de reservas.",
      whatsapp:
        "Aparece como botón en tu página. Por aquí no enviamos mensajes.",
    },
    ubicacion: {
      titulo: "Ubicación en el mapa",
      ayuda:
        "Tócalo estando en la barbería, cerca de la puerta, para que tus clientes lleguen fácil.",
      usar: "Usar mi ubicación actual",
      buscando: "Buscando tu ubicación…",
      marcada: "Ubicación marcada",
      marcadaDetalle: "Se guarda al tocar Guardar.",
      guardada: "Ubicación guardada",
      ver: "Ver en el mapa",
      // The link opens another tab; screen readers hear it.
      verNuevaPestana: "Ver en el mapa (se abre en otra pestaña)",
      quitar: "Quitar ubicación",
      errores: {
        denied:
          "No tenemos permiso para ver tu ubicación. Actívalo en tu navegador e intenta de nuevo.",
        unavailable:
          "No pudimos encontrar tu ubicación. Intenta de nuevo en un momento.",
        unsupported: "Este navegador no puede darnos tu ubicación.",
      },
    },
    guardar: "Guardar",
    guardando: "Guardando…",
    errores: {
      barbershop_name_required: "Escribe el nombre de tu barbería.",
      barbershop_name_too_long:
        "El nombre es muy largo. Usa máximo 100 caracteres.",
      address_too_long: "La dirección es muy larga. Usa máximo 200 caracteres.",
      locality_too_long: "Es muy largo. Usa máximo 100 caracteres.",
      phone_invalid:
        "Escribe un celular colombiano de 10 dígitos, como 300 123 4567.",
      location_invalid:
        "No pudimos leer la ubicación. Tócala de nuevo o quítala.",
      image_invalid:
        "No pudimos guardar el logo o la portada. Elígelos de nuevo.",
      unknown: "No pudimos guardar. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<ShopProfileActionErrorCode | "invalid", string>,
  },
  // D-61, Más › Link de reservas. The old link keeps leading to the new one
  // (decision P1 of task 2.4), so the design's warning that it stops working
  // became a notice that it keeps working.
  link: {
    titulo: "Link de reservas",
    cargando: "Cargando tu link…",
    actual: "Link actual",
    nuevo: "Link nuevo",
    revisando: "Revisando…",
    disponible: "Disponible",
    // When what was typed becomes another link ("La Esquina" → la-esquina).
    disponibleComo: (link: string) => `Disponible: ${link}`,
    sinRevisar:
      "No pudimos revisar si está libre. Puedes intentar cambiarlo igual.",
    // Decision P12: 90 days, said as months.
    aviso: `Tu link anterior seguirá funcionando ${SLUG_SET_ASIDE_DAYS / 30} meses`,
    avisoDetalle:
      "Los QR y afiches que ya imprimiste llevarán a tu link nuevo. Después, otra barbería podrá tomarlo.",
    cambiar: "Cambiar link",
    cambiando: "Cambiando…",
    cambiado: (link: string) => `Listo, tu link ahora es ${link}`,
    cambiadoDetalle:
      "El QR que descargaste antes sigue sirviendo: lleva a este link hasta la fecha que ves abajo.",
    // Each link the barbershop left that still leads to the new one.
    anteriores: "Tus links anteriores",
    apartado: (link: string, fecha: string) =>
      `Tu link anterior ${link} seguirá llevando al nuevo hasta el ${fecha}. Después, otra barbería podrá tomarlo.`,
    compartir: "Compartir el link nuevo",
    errores: {
      slug_invalid:
        "Usa de 3 a 60 letras o números, sin tildes, y separa las palabras con guiones.",
      slug_reserved: "Ese link lo usa Yapoin. Elige otro.",
      slug_same: "Ese ya es tu link.",
      slug_taken: "Ya está en uso. Prueba con otro.",
      slug_change_limit: `Ya cambiaste tu link ${SLUG_CHANGE_LIMIT} veces en los últimos ${SLUG_CHANGE_WINDOW_DAYS} días. Podrás cambiarlo de nuevo más adelante.`,
      unknown: "No pudimos cambiar el link. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<BookingLinkActionErrorCode | "invalid", string>,
  },
  // Task 2.6: the sede switcher at the top of Más (D-50) and "Nueva sede".
  sedes: {
    // The card with the active sede.
    activa: "Sede activa",
    cambiar: "Cambiar",
    cambiarEtiqueta: "Cambiar de sede",
    nueva: "Nueva sede",
    // Task 2.6b: "Nueva sede" is off at the limit.
    limite: `Puedes tener hasta ${MAX_BARBERSHOPS_PER_ACCOUNT} sedes.`,
    // On the agenda after a deletion.
    eliminada: (nombre: string) => `Eliminamos la sede ${nombre}`,
    // The sheet with every sede.
    hoja: {
      titulo: "Tus sedes",
      // Read after the name of the sede the panel shows.
      actual: "sede activa",
      cambiando: "Cambiando de sede…",
      fallo: "No pudimos cambiar de sede. Intenta de nuevo.",
    },
    nuevaSede: {
      titulo: "Nueva sede",
      cargando: "Cargando…",
      bajada:
        "Tendrá su propio link de reservas, horario, servicios y barberos. Después de crearla la configuras.",
      campos: {
        nombre: "Nombre de la sede",
        whatsapp: "WhatsApp de la sede",
      },
      ayudas: {
        nombre: "Con él armamos el link de reservas de la sede.",
        whatsapp: "Si lo dejas vacío, usamos tu celular.",
      },
      prueba: "La sede nueva comparte tu prueba gratis",
      pruebaHasta: (fecha: string) => `Tu prueba va hasta el ${fecha}.`,
      pruebaVencida:
        "Podrás configurarla, pero recibirá citas desde su primer pago",
      pruebaVencidaDetalle: (fecha: string) =>
        `Tu prueba gratis terminó el ${fecha}.`,
      crear: "Crear sede",
      creando: "Creando sede…",
      // At the limit, instead of the form.
      limiteTitulo: `Ya tienes ${MAX_BARBERSHOPS_PER_ACCOUNT} sedes`,
      limiteDetalle: `Es el máximo por cuenta. Si quieres abrir otra, elimina una desde Más › Datos y fotos.`,
      volver: "Volver a Más",
      errores: {
        barbershop_limit: `Ya tienes ${MAX_BARBERSHOPS_PER_ACCOUNT} sedes, el máximo por cuenta.`,
        barbershop_name_required: "Escribe el nombre de la sede.",
        barbershop_name_too_long:
          "El nombre es muy largo. Usa máximo 100 caracteres.",
        phone_invalid:
          "Escribe un celular colombiano de 10 dígitos, como 300 123 4567.",
        unknown: "No pudimos crear la sede. Intenta de nuevo.",
        invalid: "Revisa este dato.",
      } satisfies Record<NewBarbershopActionErrorCode | "invalid", string>,
    },
    // Task 2.6b, at the end of Datos y fotos (D-57).
    eliminar: {
      seccion: "Zona de peligro",
      boton: "Eliminar esta sede",
      titulo: "Eliminar sede",
      bajada: (nombre: string) =>
        `Se borran de ${nombre} sus servicios, barberos, horarios, clientes y citas. No se puede deshacer.`,
      link: "Su link de reservas deja de funcionar. Por 3 meses nadie más podrá usarlo.",
      campo: "Escribe el nombre de la sede para confirmar",
      confirmar: "Eliminar",
      eliminando: "Eliminando sede…",
      cancelar: "Cancelar",
      errores: {
        name_mismatch: "El nombre no coincide. Escríbelo como aparece arriba.",
        barbershop_changed:
          "Cambiaste de sede en otra pestaña. Recarga la página y revisa cuál vas a eliminar.",
        last_barbershop:
          "Es tu única sede. Para eliminarla necesitas tener otra.",
        has_upcoming_appointments:
          "Esta sede tiene citas próximas. Cancélalas antes de eliminarla.",
        unknown: "No pudimos eliminar la sede. Intenta de nuevo.",
        invalid: "Revisa este dato.",
      } satisfies Record<DeleteBarbershopErrorCode | "invalid", string>,
    },
  },
  // Task 4.3: D-40 Clientes, D-41 the customer's profile and D-42 "Borrar
  // cliente". The error copy is checked against the action's codes in
  // src/modulos/clientes/acciones/customers.ts.
  clientes: {
    titulo: "Clientes",
    cargando: "Cargando tus clientes…",
    total: (n: number) => (n === 1 ? "1 cliente" : `${n} clientes`),
    buscar: {
      etiqueta: "Buscar cliente",
      placeholder: "Buscar por nombre, correo o celular",
    },
    filtros: {
      etiqueta: "Filtrar clientes",
      todos: "Todos",
      inasistencias: "Con inasistencias",
      nuevos: "Nuevos",
    },
    // Days as D-40 and D-41 write them (src/app/(panel)/panel/clientes/format.ts).
    hoy: "hoy",
    mesesCortos: [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ],
    meses: [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    visitas: (n: number) => (n === 1 ? "1 visita" : `${n} visitas`),
    ultima: (dia: string) => `última: ${dia}`,
    proxima: (dia: string, hora: string) => `próxima: ${dia} ${hora}`,
    sinCorreo: "cita manual, sin correo",
    inasistencias: (n: number) =>
      n === 1 ? "1 inasistencia" : `${n} inasistencias`,
    mas: (n: number) =>
      `Ves los primeros ${n}. Busca por nombre, correo o celular para encontrar a los demás.`,
    vacio: {
      titulo: "Aún no tienes clientes",
      cuerpo:
        "Aparecen aquí cuando reservan desde tu link o cuando les creas una cita.",
    },
    sinResultados: {
      titulo: "No encontramos clientes",
      busqueda: (texto: string) =>
        `Nadie coincide con “${texto}”. Revisa cómo lo escribiste.`,
      filtro: "Ningún cliente está en este filtro todavía.",
      verTodos: "Ver todos",
    },
    borrado: "Borramos el cliente y sus datos.",
    // What the appointments of a deleted customer say instead of a name.
    clienteBorrado: "Cliente borrado",
    ficha: {
      titulo: "Cliente",
      cargando: "Cargando el cliente…",
      desde: (mes: string, anio: number) => `Cliente desde ${mes} ${anio}`,
      alerta: {
        // "No llegó el 7 de nov ni el 12 de oct. …"
        cuerpo: (dias: string) =>
          `No llegó ${dias}. Puedes pedirle un abono antes de su próxima cita.`,
        ni: "ni",
        otraVez: "otra vez",
        otrasVeces: (n: number) => `otras ${n} veces`,
      },
      numeros: {
        visitas: "Visitas",
        inasistencias: "Inasistencias",
        total: "En total",
      },
      correo: "Correo",
      celular: "Celular",
      sinCorreo: "Sin correo",
      sinCelular: "Sin celular",
      notas: {
        etiqueta: "Notas",
        guardar: "Guardar notas",
        guardando: "Guardando…",
        guardadas: "Guardamos las notas.",
        errores: {
          notes_too_long: "Las notas pueden tener hasta 1.000 caracteres.",
          unknown: "No pudimos guardar las notas. Intenta de nuevo.",
          invalid: "Revisa este dato.",
        },
      },
      historial: "Historial",
      sinCitas: "Todavía no tiene citas.",
      // "Hoy · 10:20 a. m.", "24 oct · 5:00 p. m."
      cita: (dia: string, hora: string) =>
        `${dia.charAt(0).toLocaleUpperCase("es-CO")}${dia.slice(1)} · ${hora}`,
      detalle: (servicios: string, barbero: string) =>
        `${servicios} · ${barbero}`,
      estados: {
        confirmed: "Confirmada",
        attended: "Atendida",
        no_show: "No asistió",
        cancelled_by_customer: "Cancelada por cliente",
        cancelled_by_barbershop: "Cancelada por barbería",
      },
      // "Nueva cita para Diego": the first name.
      nuevaCita: (nombre: string) =>
        `Nueva cita para ${nombre.trim().split(/\s+/)[0]}`,
    },
    borrar: {
      boton: "Borrar cliente",
      titulo: (nombre: string) => `¿Borrar a ${nombre}?`,
      cuerpo:
        "Borramos su nombre, correo, celular y notas. Sus citas quedan en tus cuentas como “Cliente borrado”. No se puede deshacer.",
      confirmar: "Borrar cliente",
      borrando: "Borrando…",
      volver: "Volver",
      errores: {
        has_upcoming_appointments:
          "Tiene citas próximas. Cancélalas en la agenda antes de borrarlo.",
        customer_not_found: "Este cliente ya no está. Vuelve a la lista.",
        unknown: "No pudimos borrar el cliente. Intenta de nuevo.",
        invalid: "Revisa este dato.",
      },
    },
  },
  // The public booking page (tasks 3.2 and 3.3, C-01 to C-08, C-17, C-18).
  reservas: {
    tituloPestana: (barberia: string) => `Reservar en ${barberia}`,
    cargando: "Cargando…",
    perfil: {
      portada: "Foto de portada de la barbería",
      logo: (barberia: string) => `Logo de ${barberia}`,
      abiertoHoy: (desde: string, hasta: string) =>
        `Abierto hoy · ${desde} – ${hasta}`,
      cerradoHoy: "Cerrado hoy",
      reservar: "Reservar cita",
      whatsapp: "WhatsApp",
      comoLlegar: "Cómo llegar",
      servicios: "Servicios",
      verServicios: (cantidad: number) => `Ver los ${cantidad} servicios`,
      horario: "Horario",
      cerrado: "Cerrado",
      rango: (desde: string, hasta: string) =>
        `${desde} a ${String(hasta).toLocaleLowerCase("es-CO")}`,
      festivos: "Festivos",
      festivosCerrado: "Cerrado, salvo los que la barbería abre",
      ubicacion: "Ubicación",
      reservasCon: "Reservas con",
      politicaDatos: "Política de datos de la barbería",
    },
    dias: [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ],
    diasCortos: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    hoy: "Hoy",
    suspendida: {
      titulo: "Por ahora no recibimos reservas en línea",
      bajada:
        "Escríbenos por WhatsApp y te agendamos. Si ya tienes una cita, sigue en pie.",
      bajadaSinWhatsapp:
        "Comunícate directamente con la barbería. Si ya tienes una cita, sigue en pie.",
      whatsapp: "Escribir por WhatsApp",
    },
    noExiste: {
      titulo: "No encontramos esta barbería",
      bajada: "Revisa el link. Puede que la barbería lo haya cambiado.",
      conoceYapoin: "¿Tienes una barbería? Conoce Yapoin",
    },
    volver: "Volver",
    continuar: "Continuar",
    minutos: (minutos: number) => `${minutos} min`,
    servicios: {
      titulo: "¿Qué te vas a hacer?",
      bajada: "Puedes elegir varios. La cita dura lo que sumen.",
      resumen: (cantidad: number, minutos: number) =>
        `${cantidad} ${cantidad === 1 ? "servicio" : "servicios"} · ${minutos} min`,
      ninguno: "Elige al menos un servicio",
      maximo: "Puedes elegir hasta 5 servicios por cita.",
      vacio: "Esta barbería todavía no tiene servicios para reservar.",
    },
    barbero: {
      titulo: "¿Con quién?",
      bajada:
        "Solo aparecen los barberos que hacen todos los servicios que elegiste.",
      primero: "El primero disponible",
      primeroDetalle: "Te mostramos más horas",
      hoyDesde: (hora: string) => `Hoy desde las ${hora}`,
      desde: (dia: string, hora: string) => `${dia} desde las ${hora}`,
      sinHoras: "Sin horas libres en los próximos 30 días",
      nadie: {
        titulo: "Nadie hace todos estos servicios en una sola cita",
        bajada: "Cambia los servicios para ver los barberos.",
        accion: "Cambiar servicios",
      },
    },
    hora: {
      titulo: "¿Cuándo?",
      dias: "Días con horas libres",
      partes: { morning: "Mañana", afternoon: "Tarde", evening: "Noche" },
      cerrado: (dia: string) => `${dia}, sin horas libres`,
      eligeHora: "elige una hora",
      elDia: (dia: string) => `el ${dia}`,
      sinHoras: (quien: string, dia: string) =>
        `${quien} no tiene horas libres ${dia}`,
      sinHorasNadie: (dia: string) => `No hay horas libres ${dia}`,
      proxima: (dia: string, hora: string) =>
        `La próxima hora libre es el ${dia} a las ${hora}.`,
      ninguna: "No hay horas libres en los próximos 30 días.",
      ir: (dia: string) => `Ir al ${dia}`,
      otroBarbero: "Ver otro barbero",
      tomada: {
        titulo: "Esa hora ya la tomaron. Elige otra, por favor.",
        detalle: (hora: string) =>
          `Alguien reservó las ${hora} mientras llenabas tus datos. Tus datos quedan guardados.`,
      },
    },
    datos: {
      titulo: "Tus datos",
      cambiar: "Cambiar",
      guardados: "Usamos los datos que guardaste en este celular",
      noEres: (nombre: string) => `¿No eres ${nombre}?`,
      borrar: "Borrar mis datos",
      nombre: "Nombre",
      correo: "Correo",
      correoAyuda: "Con tu correo la barbería reconoce tus citas.",
      celular: "Celular",
      celularAyuda: "Solo para que la barbería te pueda llamar.",
      celularEjemplo: "300 123 4567",
      aceptas: "Al reservar aceptas la",
      politica: "política de datos",
      deLaBarberia: "de la barbería.",
      total: "Total en la barbería",
      confirmar: "Confirmar reserva",
      confirmando: "Reservando…",
      serviciosCambiaron: "Elegir los servicios de nuevo",
    },
    confirmada: {
      titulo: (nombre: string | null) =>
        nombre ? `¡Listo, ${nombre}!` : "¡Listo!",
      bajada:
        "Tu cita quedó reservada. Toma una captura de esta pantalla para tenerla a mano.",
      cuando: "Cuándo",
      servicios: "Servicios",
      con: "Con",
      asignado: (barbero: string) =>
        `El primero disponible: te asignamos a ${barbero}`,
      donde: "Dónde",
      pagas: "Pagas en la barbería",
      abono: "Abono",
      abonoBajada:
        "Si la barbería te pide un abono para apartar tu cita, estos son sus datos.",
      metodos: {
        nequi: "Nequi",
        daviplata: "Daviplata",
        bre_b: "Llave Bre-B",
        bank_transfer: "Transferencia",
      } as Record<string, string>,
      calendario: "Agregar a mi calendario",
      cancelar:
        "¿No puedes ir? Escríbele a la barbería por WhatsApp para cancelar o cambiar tu cita.",
      calendarioTitulo: (barberia: string) => `Cita en ${barberia}`,
      reservarOtra: "Reservar otra cita",
      // Task 3.4: until the confirmation email, the link is given here.
      gestionar: "Cancelar o cambiar mi cita",
      gestionarAyuda: (horas: number) =>
        `¿No puedes ir? Con este botón cancelas o cambias tu cita, hasta ${duracion(horas * 60)} antes. Este celular lo recuerda: también lo encuentras en la página de la barbería.`,
    },
    // C-09 to C-13 and C-16 (task 3.4): the customer's appointment, from its
    // private link.
    gestionar: {
      tituloPestana: "Tu cita",
      titulo: (nombre: string) => (nombre ? `Tu cita, ${nombre}` : "Tu cita"),
      confirmada: "Confirmada",
      cambiada: "Listo, cambiamos tu cita.",
      cambiar: "Cambiar día u hora",
      cancelar: "Cancelar cita",
      plazo: (horas: number) =>
        `Puedes cancelar o cambiar hasta ${duracion(horas * 60)} antes de la cita. Después, escríbele a la barbería.`,
      fueraDePlazo: {
        titulo: "Ya no puedes cancelar ni cambiar desde aquí",
        detalle: (horas: number) =>
          `La barbería permite hacerlo hasta ${duracion(horas * 60)} antes. Escríbeles si no puedes ir.`,
      },
      hoy: (cuando: string) =>
        `Hoy, ${cuando.charAt(0).toLocaleLowerCase("es-CO")}${cuando.slice(1)}`,
      escribir: "Escribir a la barbería",
      hoja: {
        titulo: "¿Cancelar tu cita?",
        detalle: (cuando: string, barbero: string) =>
          `${cuando} con ${barbero}. La hora queda libre para otra persona.`,
        si: "Sí, cancelar mi cita",
        cancelando: "Cancelando…",
        no: "No, mantenerla",
        cerrar: "Cerrar",
      },
      cancelada: {
        estado: "Cancelada por cliente",
        titulo: "Cancelaste tu cita",
        reservarOtra: "Reservar otra cita",
      },
      reprogramar: {
        volver: "Volver a tu cita",
        tienes: (cuando: string) => `Hoy tienes: ${cuando}`,
        liberada: "Si eliges otra hora, la anterior queda libre.",
        boton: "Cambiar mi cita",
        cambiando: "Cambiando…",
        sinHoras: (barbero: string, dia: string) =>
          `${barbero} no tiene horas libres ${dia}.`,
        sinHorasMes: (barbero: string) =>
          `${barbero} no tiene horas libres en los próximos 30 días. Escríbele a la barbería.`,
      },
      vencido: {
        titulo: "Este link ya no sirve",
        detalle:
          "La cita ya pasó, se canceló o el link cambió. Si tienes otra cita, usa el link de esa cita.",
        ir: "Ir a la barbería",
        inicio: "Ir a Yapoin",
      },
      // C-01: the appointments this phone remembers.
      aviso: {
        titulo: (cuando: string) => `Tienes una cita el ${cuando}`,
        ver: "Ver mi cita",
      },
      errores: {
        link_invalid: "Este link ya no sirve.",
        too_late: "Ya no puedes cancelar ni cambiar desde aquí.",
        not_accepting:
          "La barbería no está recibiendo cambios ahora. Escríbeles por WhatsApp.",
        slot_gone: "Esa hora ya no está libre. Elige otra.",
        same_time: "Tu cita ya está a esa hora. Elige otra.",
        services_changed:
          "La barbería cambió los servicios de tu cita, así que no puedes moverla desde aquí. Escríbeles por WhatsApp.",
        unknown: "No pudimos hacer el cambio. Intenta de nuevo.",
        invalid: "No pudimos hacer el cambio. Intenta de nuevo.",
      } satisfies Record<ManageRefusal | "invalid", string>,
    },
    errores: {
      name_required: "Escribe tu nombre.",
      name_too_long: "El nombre es muy largo. Usa máximo 100 caracteres.",
      name_invalid: "Escribe tu nombre en una sola línea.",
      email_invalid: "Escribe un correo válido, como nombre@correo.com.",
      phone_invalid: "Escribe un celular de Colombia de 10 dígitos.",
      services_changed:
        "La barbería cambió sus servicios. Elígelos de nuevo, por favor.",
      captcha_failed:
        "No pudimos confirmar que no eres un robot. Intenta de nuevo en un momento.",
      too_many_upcoming:
        "Ya tienes 5 citas por venir en esta barbería. Cancela una o escríbele a la barbería.",
      too_many_from_ip:
        "Se hicieron muchas reservas seguidas desde esta conexión. Intenta de nuevo en un rato.",
      unknown: "No pudimos reservar tu cita. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<BookingActionErrorCode | "invalid", string>,
  },
  barbero: {
    // "Mi agenda" of a barber, by their private link (task 4.4): B-01 to B-06.
    tituloPestana: "Mi agenda",
    cargando: "Cargando tu agenda…",
    encabezado: (barberia: string) => `${barberia} · Mi agenda`,
    hola: (nombre: string) => `Hola, ${nombre}`,
    resumen: {
      sinCitas: "Hoy no tienes citas",
      citas: (cantidad: number) =>
        cantidad === 1 ? "Hoy tienes 1 cita" : `Hoy tienes ${cantidad} citas`,
      proxima: (citas: string, hora: string) =>
        `${citas} · la próxima a las ${hora}`,
    },
    vistas: { etiqueta: "Vista", hoy: "Hoy", semana: "Semana" },
    sinCitasDia: "No tienes citas este día.",
    marcar: {
      atendida: "Atendida",
      noAsistio: "No asistió",
      // The name a screen reader hears, starting with the visible word.
      atendidaDe: (cliente: string) => `Atendida, ${cliente}`,
      noAsistioDe: (cliente: string) => `No asistió, ${cliente}`,
      guardando: "Guardando…",
    },
    quitar: "Quitar",
    quitarDe: (bloqueo: string) => `Quitar, ${bloqueo}`,
    bloquearHoras: "Bloquear horas",
    soloTuyo: "Este link es solo tuyo. No lo compartas.",
    // B-02.
    descansas: "Descansas",
    horario: (desde: string, hasta: string) => `${desde} – ${hasta}`,
    // "15 de noviembre", the ends of the week of B-02.
    diaDeMes: (dia: number, mes: string) => `${dia} de ${mes}`,
    pausada: {
      titulo: "La barbería está pausada",
      detalle:
        "Tu agenda es solo de lectura y no entran reservas nuevas. Las citas tomadas siguen en pie.",
    },
    // B-03.
    cita: {
      titulo: "Cita",
      volver: "Volver a mi agenda",
      cuando: "Cuándo",
      servicios: "Servicios",
      visitas: "Visitas",
      servicio: (nombre: string, minutos: number) =>
        `${nombre} (${minutos} min)`,
      cuandoLinea: (dia: string, horas: string) => `${dia} · ${horas}`,
      visitasLinea: (visitas: number, inasistencias: number) =>
        `${visitas} · ${
          inasistencias === 0
            ? "sin inasistencias"
            : inasistencias === 1
              ? "1 inasistencia"
              : `${inasistencias} inasistencias`
        }`,
    },
    // B-04.
    bloquear: {
      titulo: "Bloquear horas",
      cerrar: "Cerrar",
      dia: "Día",
      desde: "Desde",
      hasta: "Hasta",
      motivo: "Motivo",
      // What the owner's agenda shows too; "other" is saved without one.
      motivos: {
        lunch: "Almuerzo",
        leave: "Permiso",
        errand: "Diligencia",
        other: "Otro",
      },
      aviso:
        "Solo puedes bloquear horas sin citas. Si tienes una cita en ese rango, pídele al dueño que la mueva.",
      enviar: "Bloquear",
      enviando: "Bloqueando…",
    },
    // B-05.
    vencido: {
      titulo: "Este link ya no funciona",
      detalle:
        "La barbería lo cambió o lo desactivó. Pídele al dueño que te envíe el nuevo.",
    },
    errores: {
      link_invalid: "Este link ya no funciona.",
      read_only: "La barbería está pausada: tu agenda es solo de lectura.",
      not_yours: "Eso ya no está en tu agenda.",
      not_confirmed: "Esa cita ya estaba marcada o cancelada.",
      too_early: "Esa cita todavía no empieza.",
      barber_inactive: "La barbería te desactivó: ya no puedes bloquear horas.",
      overlaps_appointment:
        "Tienes una cita en ese rango. Pídele al dueño que la mueva.",
      overlaps_block: "Ya tienes un bloqueo en ese rango.",
      range_invalid: "Revisa el día y las horas.",
      end_before_start: "La hora final debe ser después de la inicial.",
      in_the_past: "Esa hora ya pasó. Elige una más tarde.",
      unknown: "No pudimos guardar el cambio. Intenta de nuevo.",
      invalid: "Revisa este dato.",
    } satisfies Record<BarberRefusal | BlockFormCode | "invalid", string>,
  },
  plataforma: {
    // The platform panel of the super admin (task 5.4): P-01 to P-06.
    titulo: "Barberías",
    cargando: "Cargando…",
    verMetricas: "Métricas",
    buscar: {
      etiqueta: "Buscar barbería",
      placeholder: "Buscar barbería, dueño o correo",
    },
    filtros: {
      etiqueta: "Estado",
      todas: "Todas",
      prueba: "En prueba",
      activas: "Activas",
      porVencer: "Por vencer",
      vencidas: "Vencidas",
      suspendidas: "Suspendidas",
      conteo: (nombre: string, cantidad: number) => `${nombre} · ${cantidad}`,
    },
    estados: {
      trial: "En prueba",
      active: "Activa",
      expiring: "Por vencer",
      grace: "Vencida · en gracia",
      expired: "Vencida",
      suspended: "Suspendida",
      awaiting: "Sin primer pago",
    },
    // "Chapinero, Bogotá · vence 24 nov 2026".
    linea: (lugar: string | null, vence: string) =>
      lugar ? `${lugar} · vence ${vence}` : `Vence ${vence}`,
    sinResultados: "No hay barberías con esa búsqueda.",
    sinBarberias: "No hay barberías en este estado.",
    ficha: {
      volver: "Volver a las barberías",
      venceEl: (fecha: string, cuando: string) =>
        `Vence el ${fecha} · ${cuando}`,
      cuando: (dias: number) =>
        dias === 0
          ? "hoy"
          : dias === 1
            ? "mañana"
            : dias > 1
              ? `en ${dias} días`
              : dias === -1
                ? "hace 1 día"
                : `hace ${-dias} días`,
      dueno: "Dueño",
      correo: "Correo",
      celular: "Celular / WhatsApp",
      link: "Link",
      sinDato: "—",
      citasEn: (mes: string) => `Citas en ${mes}`,
      barberos: "Barberos",
      registro: "Registro",
      pagos: "Pagos",
      sinPagos: "Aún no tiene pagos.",
      pagoLinea: (fecha: string, valor: string) => `${fecha} · ${valor}`,
      pagoDetalle: (referencia: string) => `1 mes · ref. ${referencia}`,
      anulado: (motivo: string) => `Anulado: ${motivo}`,
      registrarPago: "Registrar pago",
      extender: "Extender prueba",
      suspender: "Suspender",
      reactivar: "Reactivar",
      anular: "Anular",
      anularDe: (fecha: string) => `Anular el pago del ${fecha}`,
      hecho: {
        pago: "Pago registrado.",
        anulado: "Pago anulado.",
        suspendida: "Barbería suspendida.",
        reactivada: "Barbería reactivada.",
        extendida: "Prueba extendida.",
      },
    },
    pago: {
      titulo: "Registrar pago",
      cerrar: "Cerrar",
      valor: "Valor recibido",
      periodo: "Periodo",
      unMes: "1 mes",
      // Decision P1: one payment is one month at the plan's price.
      ayudaPeriodo: "Cada pago cubre un mes, al precio del plan.",
      medio: "Medio",
      medios: {
        bre_b: "Llave Bre-B",
        nequi: "Nequi",
        daviplata: "Daviplata",
        bank_transfer: "Transferencia",
      },
      referencia: "Referencia del comprobante",
      fecha: "Fecha del pago",
      quedaHasta: "Queda activa hasta",
      aTiempo: (vence: string) =>
        `Pagó antes de vencer: el mes se suma a la fecha de vencimiento (${vence}). Si hubiera pagado vencida, contaría desde el día del pago.`,
      tarde: (vence: string) =>
        `Pagó vencida (venció el ${vence}): el mes cuenta desde el día del pago.`,
      enviar: "Registrar y activar",
      enviando: "Registrando…",
    },
    extender: {
      titulo: "Extender prueba",
      pruebaHasta: "Prueba hasta",
      dias: "Días extra",
      diasOpcion: (dias: number) => `${dias} días`,
      nuevaFecha: "Nueva fecha",
      enviar: "Extender prueba",
      enviando: "Extendiendo…",
    },
    suspender: {
      titulo: (barberia: string) => `¿Suspender ${barberia}?`,
      detalle:
        "Su página deja de recibir reservas nuevas y muestra su WhatsApp. El panel queda en solo lectura. No se borra nada y las citas tomadas se respetan.",
      avisoTitulo: "Para reactivarla, registra un pago",
      aviso: "Todo vuelve a funcionar al instante.",
      enviar: "Suspender ahora",
      enviando: "Suspendiendo…",
      volver: "Volver",
    },
    reactivar: {
      titulo: (barberia: string) => `¿Reactivar ${barberia}?`,
      detalle:
        "Vuelve a recibir reservas y su panel deja de estar en solo lectura. No cambia ninguna fecha: si su vigencia ya venció, registra un pago.",
      enviar: "Reactivar ahora",
      enviando: "Reactivando…",
      volver: "Volver",
    },
    anular: {
      titulo: "Anular pago",
      detalle: (fecha: string, valor: string) =>
        `El pago del ${fecha} por ${valor} deja de contar y la fecha de vencimiento se recalcula. Queda en el historial, con el motivo.`,
      motivo: "Motivo",
      enviar: "Anular pago",
      enviando: "Anulando…",
      volver: "Volver",
    },
    metricas: {
      titulo: "Métricas",
      activas: "Activas",
      prueba: "En prueba",
      vencidas: "Vencidas",
      suspendidas: "Suspendidas",
      ingresoMes: "Ingreso del mes",
      mesAnterior: "Mes anterior",
      delMes: (valor: string, pagos: number) =>
        `${valor} · ${pagos === 1 ? "1 pago registrado" : `${pagos} pagos registrados`}`,
      anterior: (valor: string, pagos: number) =>
        `${valor} · ${pagos === 1 ? "1 pago" : `${pagos} pagos`}`,
    },
    errores: {
      not_allowed: "Solo el equipo de la plataforma puede hacer esto.",
      payment_required:
        "Su vigencia ya venció: registra un pago para reactivarla.",
      not_found: "Esto ya cambió. Vuelve a abrir la ficha.",
      invalid: "Revisa este dato.",
      unknown: "No pudimos guardar el cambio. Intenta de nuevo.",
      reference_required: "Escribe la referencia del comprobante.",
      reference_too_long: "Usa máximo 100 caracteres.",
      reason_required: "Escribe por qué lo anulas.",
      reason_too_long: "Usa máximo 200 caracteres.",
    } satisfies Record<
      PlatformRefusal | PaymentFormCode | VoidFormCode | "invalid",
      string
    >,
  },
  // The links that already circulate (the QR, the poster, the barber's
  // link) while their pages are built: tasks 3.2 and 4.4.
  proximamente: {
    reservas: {
      tituloPestana: "Reservas",
      cargando: "Cargando…",
      titulo: (barberia: string) => `Muy pronto podrás reservar en ${barberia}`,
      bajada:
        "Estamos terminando la página de reservas. Vuelve en unos días o escríbele a la barbería.",
    },
    barbero: {
      titulo: "Muy pronto verás tus citas aquí",
      bajada:
        "Guarda este link: con él vas a ver tus citas del día sin crear una cuenta.",
    },
    conoceYapoin: "¿Tienes una barbería? Conoce Yapoin",
  },
  noEncontrado: {
    titulo: "No encontramos esta página",
    bajada: "Puede que el link esté incompleto o que ya no exista.",
    volver: "Volver a la agenda",
    inicio: "Ir al inicio",
  },
  errorGeneral: {
    titulo: "Algo salió mal",
    bajada: "No pudimos cargar esta página.",
    reintentar: "Intentar de nuevo",
  },
} as const;
