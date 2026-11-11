import type { ImageUploadErrorCode } from "@/lib/imagenes/keys";
import type { AppointmentWriteError } from "@/modulos/agenda/datos/appointment-errors";
import type { ScheduleActionErrorCode } from "@/modulos/barberias/acciones/barber-schedule";
import type { BarberActionErrorCode } from "@/modulos/barberias/acciones/barbers";
import type { BarbershopErrorCode } from "@/modulos/barberias/dominio/registration";
import type { PoliciesActionErrorCode } from "@/modulos/barberias/acciones/policies";
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
