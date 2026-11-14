# 0008 Correo con Resend en vez de Amazon SES

Fecha: 2026-11-13 · Tareas: 5.1, 5.2, 5.3 y 6.4 · Estado: **propuesta**. La redactó Claude Code y falta que el fundador la acepte.

Cambia solo el proveedor de correo de la decisión 0007 (punto 6, "Correo con SES" y sus filas de costos, riesgos y secretos). El resto de la 0007 sigue igual:
- dos correos por cita;
- la cola en la base de datos con pg_cron y una Edge Function;
- el módulo de envío aislado;
- Supabase y Vercel en `us-east-1` / `iad1`.

Mientras no se acepte, `CLAUDE.md` sigue nombrando Amazon SES.

## Contexto

- **El fundador anticipa que no podrá usar Amazon SES** (2026-11-13) y que lo más probable es usar Resend. La razón se anota aquí al aceptar.
- **Ya en la 0007 Resend fue la alternativa descartada por precio:** con 1.000 sedes costaba ~5 veces más que SES.
- **Lo que no cambia con el proveedor:** la 5.1 (la cola, sin duplicados, y su proceso cada minuto) no depende de él. El proveedor entra en la 5.2, en un solo módulo.

## Decisión propuesta

| # | Tema | Propuesta |
| --- | --- | --- |
| 1 | Proveedor | **Resend**, para los correos de citas, los avisos de suscripción y los de Supabase Auth. |
| 2 | Región | **North Virginia (`us-east-1`)**, la misma de Supabase y Vercel. La región decide desde dónde sale el correo. Los datos de la cuenta (registros y metadatos) viven en EE. UU. en cualquier caso. |
| 3 | Plan | **Free** en desarrollo y pruebas: 3.000 al mes y 100 al día. **Pro, US$20 al mes** (50.000 correos), desde el piloto. **Scale** cuando se pase de unos 100.000 correos al mes. |
| 4 | Envío de la cola | La Edge Function llama a la API HTTP de Resend con la llave en sus secretos. Usa el envío por lotes (hasta 100 correos por llamada), porque el límite de llamadas por segundo es el mismo en todos los planes. La `dedupe_key` de la cola sigue impidiendo duplicados. Si Resend acepta una llave de idempotencia por envío, se usa también (a confirmar en la 5.2). |
| 5 | Auth | Supabase Auth envía por el **SMTP de Resend** (integración oficial de Resend con Supabase), con el mismo remitente. El correo por defecto de Supabase solo sirve para el equipo del proyecto, unos 2 por hora. |
| 6 | Dominio | Se verifica el dominio en Resend con los registros SPF y DKIM que da Resend, más DMARC. Van en Cloudflare en modo "DNS only", como el resto (0007, punto 2). Remitente, por ejemplo, `citas@yapoin.com`. |
| 7 | Rebotes y quejas | Resend suprime solo los rebotes permanentes, en todos los planes. Un webhook firmado avisa rebotes y quejas, y la app marca ese correo para no volver a encolarlo. Las alertas siguen siendo las de la 0007: rebotes por encima del 2% y quejas por encima del 0,1%. |
| 8 | Salida | El módulo de envío es una interfaz pequeña (`send(message)`), así que volver a SES u otro proveedor es cambiar ese módulo y su secreto, no la cola. |

## Costos

Con el volumen de la 0007: 2.400 correos por sede al mes (1.200 citas, dos correos por cita). Los precios de Resend son los de su página del 2026-11-13.

| Sedes | Correos al mes | Resend | Amazon SES Essentials (0007) |
| --- | --- | --- | --- |
| 10 (piloto) | 24.000 | **US$20** (Pro, 50.000) | ≈US$4 |
| 50 | 120.000 | **≈US$53** (Pro 100.000 por US$35, más 20.000 a US$0,90 por cada 1.000) | ≈US$19 |
| 600 | 1,44 M | **US$825** (Scale, 1,5 M) | ≈US$230 |
| 1.000 | 2,4 M | **US$1.150** (Scale, 2,5 M) | ≈US$384 |

- **Con pocas sedes la diferencia es chica:** unos US$16 a US$34 al mes. A escala, Resend cuesta unas 3 veces lo de SES.
- **Con 1.000 sedes** el correo pasa a ser la mayor parte del costo de infraestructura. Ahí hay que revisar de nuevo: volver a SES, pasar a Enterprise o mandar menos correos.
- **Los clientes sin correo no reciben nada,** así que el costo real será algo menor.
- **El plan Free no alcanza para el piloto:** 10 sedes mandan unos 800 correos al día, y el tope es 100.

## Riesgos

- **Precio a escala:** ver "Costos". Al aceptar, se agrega a la tabla "Cuándo escalar" de la 0007 un punto de revisión del gasto en correo, que el fundador fija.
- **El límite de llamadas por segundo no sube con el plan.** Con el envío por lotes, 100 correos por llamada, alcanza de sobra: 1.000 sedes mandan unos 80.000 al día. Si no, se pide a soporte.
- **Un proveedor más chico que AWS:** si falla, la cola guarda los correos y los reintenta, y el módulo aislado permite cambiar de proveedor.
- **El piloto ya es un gasto fijo:** US$20 al mes desde el piloto, contra centavos con SES.

## Qué pasa si se acepta

1. **`CLAUDE.md` y la 0007:** "Amazon SES" pasa a "Resend", con un PR `docs-` avisado al socio.
2. **El fundador:**
   - crea la cuenta de Resend (Free alcanza para empezar);
   - agrega el dominio en `us-east-1`;
   - pone los registros en Cloudflare.

   Claude Code lo guía. La llave nunca va al repositorio.
3. **5.2:** la llave va a los secretos de la Edge Function de `barberias-dev`, y el SMTP de Resend a la configuración de Auth de `barberias-dev`. Las dos cosas las hace el fundador.
4. **Antes del piloto:** pasar a Pro.

## Fuentes

- [Precios de Resend](https://resend.com/pricing) y [explicación de precios](https://resend.com/docs/knowledge-base/what-is-resend-pricing).
- [Regiones de Resend](https://resend.com/docs/dashboard/domains/regions).
- [Resend con Supabase](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase) y [SMTP propio en Supabase Auth](https://supabase.com/docs/guides/auth/auth-smtp).
- [IP dedicadas de Resend](https://resend.com/docs/knowledge-base/how-do-dedicated-ips-work).
