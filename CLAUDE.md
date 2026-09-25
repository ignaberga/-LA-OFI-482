# CLAUDE.md — La Ofi 482 (proyectos de oficina)

## Qué es este proyecto

Ignacio es **contador público** y trabaja en un estudio contable. En este
repositorio viven apps simples para la oficina, hechas con la misma idea que
la app de gastos de **La Emilia SAS** (repo `ignaberga/LA-EMILIA-SAS`), que ya
funciona bien en tres celulares.

**Cada app va en su propia carpeta**, con su `index.html`, su
`apps-script/Code.gs` y su propio `KEY_PREFIX`. La raíz tiene un `index.html`
que es solo un menú con links a cada app.

| Carpeta | App |
|---|---|
| `stockbares/` | Stock de los bares de Noel (jefe de Ignacio). Ver abajo. |
| `archivo/` | Versiones viejas guardadas por si se quieren recuperar. |
| `molde/` | Molde de ingresos y gastos (copia de La Emilia sin nada del campo), base para apps nuevas. |

Para una app nueva: copiar `molde/` a una carpeta nueva, cambiarle el
`KEY_PREFIX` y adaptarla. Antes de cambiar nada, preguntarle a Ignacio qué
quiere armar.

## Stock de bares (`stockbares/`)

- Pedido de **Noel** (dueño de los bares, jefe de Ignacio). **Solo registra el
  stock contado a una fecha**: las compras y las ventas Noel ya las tiene en
  su sistema de gestión, y la comparación la hace él. Primer bar: **Archie**.
- La primera versión (compras, ventas por trago, pases, bajas y control de
  faltantes) se sacó y quedó guardada en `archivo/stockbares-v1-control/`.
- **Un solo stock por día.** Flujo (cargan el **Encargado** y **Noel**):
  fecha → Barra o Cocina → Top 10 o Resto → lista de esos productos con su
  casillero y la unidad (botellas con botones +¼ +½ +¾) → Guardar. Si la
  fecha ya tiene stock, se abre ese mismo con lo cargado para completar o
  corregir; se guardan solo los cambios (nuevos renglones en Conteos, vale
  el último de cada producto en esa fecha). Inicio e Historial muestran una
  tarjeta por día (ABIERTO/CERRADO, cuánto falta).
- **Cerrar:** el encargado (o Noel) cierra el stock del día desde la carga o
  la tarjeta, con "¿Estás seguro…?". Cerrado = nadie lo modifica; la
  planilla rechaza cargas en un día cerrado. Solo **Noel** reabre y borra un
  día entero. Hoja **Cierres** en la planilla. Ignacio no es usuario de la app.
- **Noel** arma los productos en Config: nombre, categoría (Barra/Cocina; las primeras pruebas se guardaron como
  Bebidas/Comida y se leen con el nombre nuevo, sin renombrar la planilla),
  grupo (Top 10, máximo 10 por categoría, o Resto) y unidad. En Config cada grupo (Barra · Top 10,
  etc.) es una lista desplegable. Tiene el botón "Abrir la planilla" en
  Config (no en Inicio). Reabrir y borrar día también los exige el Apps
  Script (`QUIEN_PUEDE_BORRAR`); cerrar, `PUEDEN_CERRAR`. Josefina
  quedó con los mismos permisos que Noel salvo borrar.
- Noel mira el stock en la planilla: hoja **Conteos** (un renglón por
  producto contado) y hoja **Resumen**, que el Apps Script rearma después de
  cada cambio (productos en filas, fechas en columnas, la más nueva primero;
  al lado de cada fecha una columna "Dif." contra el conteo anterior de ese
  producto: bajas en rojo, y con fondo rojo si bajó más de `BAJA_FUERTE`
  = 30 %; la fecha dice "(cerrado)" si el día está cerrado).
  Hoja **Catálogo**: los productos. Hoja **Config**: las unidades.
- **Una planilla (y un Apps Script) por bar**, todas de Noel. El link de
  instalación lleva uno o varios pares `vincular=<exec>&bar=<Nombre>` más
  `quien=<Persona>`; Noel recibe un link con todos sus bares y ve un selector
  arriba. La persona del link manda siempre. Si un link trae una planilla que
  el celular ya tenía con otro nombre, se renombra (así pasó Hugo → Archie).
- En el celular: caché `stockbares_bar_<bar>_cache_v2`, pendientes
  `stockbares_pendientes_v2` (la v1 quedó sin usar).
- La planilla de prueba es de la cuenta de Ignacio; la definitiva la tiene
  que crear Noel con su cuenta (el Apps Script funciona a nombre de quien lo
  implementa).

## Cómo trabajar con Ignacio

- **Ignacio no sabe programar.** Claude hace todos los cambios e Ignacio los
  prueba en el celular. Explicaciones en castellano simple (rioplatense) y sin
  jerga técnica.
- **Preguntar todo antes de actuar.** Antes de cambiar código, publicar o tocar
  datos, explicar qué se va a hacer y esperar su confirmación.
- Si GitHub Pages está activado, cualquier push a `main` **publica la app al
  instante** en todos los teléfonos. Nunca publicar sin el OK explícito de
  Ignacio. Con el OK, se publica directo en `main` (no quiere versiones de
  prueba aparte).
- Antes de publicar, probar el cambio en Chromium (Playwright) simulando la
  planilla, incluido el caso sin señal.
- Pensar cada pantalla para alguien que usa el celular apurado y con poca
  señal: menos pasos es mejor.
- Si algo puede hacer perder datos cargados, avisarlo claramente y primero.

## La idea (lo que se trae de La Emilia)

1. **Un solo archivo por app** (`<carpeta>/index.html`): HTML, CSS y JS juntos, sin librerías,
   sin build, sin servidor. Se publica con GitHub Pages y se instala como
   acceso directo en la pantalla de inicio (no es app de tienda). Se actualiza
   sola.
2. **La planilla de Google es la base de datos real**, compartida por todos los
   teléfonos, a través de un **Apps Script** (`apps-script/Code.gs`, copia de
   respaldo del que está pegado en la planilla):
   - La app lee con `GET ?action=get_all`.
   - Escribe con `POST` y lee la respuesta `{ok:true}`. Acciones: `add`,
     `delete`, `config_add`, `config_remove`. Todas se pueden repetir sin
     duplicar (se busca por ID antes de agregar).
   - Un candado (`LockService`) evita que dos celulares se pisen.
   - Nunca una acción que borre la planilla entera y la reemplace con lo de un
     celular (en La Emilia existió `resync_all` y se sacó por eso).
3. **Funciona sin señal:**
   - Copia local en el celular (`localStorage`) para abrir al instante.
   - **Cola de pendientes**: cada cambio se guarda primero en el celular y se
     manda en orden, con reintentos (cada 30 s, al volver la señal y al abrir
     la app), hasta que la planilla confirma. Al leer la planilla, los
     pendientes se aplican encima, así nada desaparece. Cartel en Inicio con la
     cantidad de pendientes.
   - Una respuesta vacía o incompleta de la planilla **nunca pisa** los datos
     del teléfono (ver `fetchAllFromSheet`).
4. **Link de instalación:** la dirección `/exec` del Apps Script viaja en el
   link: `…/-LA-OFI-482/<carpeta>/#vincular=<dirección>&quien=<Nombre>` (en
   stockbares además `&bar=<Nombre del bar>`). Ese
   link queda grabado en el ícono de la pantalla de inicio, así el celular no
   se desvincula nunca (en iPhone, Safari y el ícono guardan datos por
   separado, e iOS puede borrar datos de sitios poco visitados). No borrar el
   `#…` ni agregar un manifest con `start_url`. Los links los arma Claude en el
   chat cuando Ignacio pasa la dirección `/exec`; nunca se guardan en el repo.
5. **Persona fija por celular:** cada teléfono elige una vez quién lo usa y no
   lo vuelve a preguntar (o "preguntar cada vez").
6. **Listas configurables** desde la pestaña Config (categorías, clientes,
   proveedores, unidades, formas de pago), guardadas en la hoja "Config".
7. **Borrar siempre pide confirmación** ("¿Estás seguro…?", mostrando qué se
   borra).
8. **Copia de seguridad** descargable en un archivo desde Config.

## Cómo adaptar el molde

Arriba del `<script>` de cada `index.html` está el bloque **AJUSTES DEL PROYECTO**:

- `APP_NAME`, `APP_SUB`: nombre y subtítulo.
- `PEOPLE`: quiénes cargan (hoy tiene nombres de ejemplo).
- `KEY_PREFIX`: prefijo de lo que se guarda en el celular (`oficina_` en el
  molde, `stockbares_` en stock de bares).
- `DEFAULT_CATS`: categorías de arranque (deben coincidir con
  `DEFAULT_CONFIG` en `apps-script/Code.gs`).

Además cambiar `<title>` y `apple-mobile-web-app-title` en el `<head>`.

Si la nueva app no es de ingresos y gastos (por ejemplo horas, tareas,
cobranzas), conservar la parte de datos (planilla + Apps Script + cola de
pendientes + copia local + link de instalación) y cambiar los campos y las
pantallas. Los campos que se agreguen tienen que ir igual en la app
(`saveBtn`), en `movimientoToRow_`, `MOV_HEADERS` y `readMovimientos_` del
Apps Script.

## Reglas firmes

- **La dirección `/exec` del Apps Script nunca va en el repositorio** (ni en el
  código, ni en commits, ni en issues). Es la llave de los datos y el repo es
  público.
- **Cada app necesita su propio `KEY_PREFIX`.** Todas las apps publicadas en
  `ignaberga.github.io` (La Emilia incluida) comparten el mismo lugar de
  guardado en el teléfono. Si dos apps usan las mismas claves, se mezclan y se
  pisan los datos. Nunca usar `la_emilia_`.
- **Mantener un solo archivo, simple y sin dependencias externas.**
- **Una vez que la gente empezó a cargar, no cambiar la forma en que se guardan
  los datos** (campos, claves de `localStorage`, `KEY_PREFIX`, acciones del
  Apps Script) sin avisarle a Ignacio: puede romper la planilla o dejar datos
  huérfanos.
- **Actualizar la app nunca debe borrar datos.** No cambiar la dirección web
  del sitio una vez instalada (para el navegador sería otro sitio).
- Los valores ya guardados en la planilla no se renombran desde el código.
- **Textos de la app en castellano rioplatense y con tildes.**
- Ninguna sincronización puede borrar datos en forma masiva, ni en la app ni en
  la planilla.

## Apps Script

El `apps-script/Code.gs` de cada app se pega en la planilla (Extensiones → Apps Script). Al
principio del archivo están los pasos. Para actualizarlo: pegar, guardar y
**Gestionar implementaciones → Nueva versión** (nunca "Nueva implementación",
que cambia el link). Mantener el archivo del repo igual al de la planilla.

## Publicar

Para que la app se pueda abrir en el celular hay que activar GitHub Pages una
vez: en GitHub, Settings → Pages → Branch `main` / carpeta raíz → Save. Queda
en https://ignaberga.github.io/-LA-OFI-482/ y cada app en su carpeta
(ej. `…/-LA-OFI-482/stockbares/`). No cambiar el nombre de las carpetas una
vez instaladas. Guiar a Ignacio paso a
paso cuando llegue el momento.

## Historial de decisiones

- Septiembre 2026: se creó el repo con el molde copiado de La Emilia (versión
  con cola de pendientes, link de instalación, persona fija por celular,
  confirmación al borrar). Las personas y categorías pasaron a un bloque de
  ajustes arriba del código, y las claves del celular usan el prefijo
  `oficina_`.
- Septiembre 2026: primera app real, **stock de bares** (`stockbares/`), pedida
  por Noel. El molde pasó a `molde/` y cada app nueva va en su carpeta.
- Septiembre 2026: Noel pidió que la app de stock sea solo para cargar el
  conteo a una fecha (Bebidas/Comida, Top 10/Resto). Lo anterior pasó a
  `archivo/`. El bar es Archie.
