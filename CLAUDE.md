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
  su sistema de gestión, y la comparación la hace él. Primer bar: **Archi**
  (así, sin e: en la hoja Bares dice ARCHI; en notas viejas figura "Archie".
  El código reconoce las dos formas, `mismoBar_`).
- La primera versión (compras, ventas por trago, pases, bajas y control de
  faltantes) se sacó y quedó guardada en `archivo/stockbares-v1-control/`.
- **Un solo stock por día.** Flujo (cargan el **Encargado** y **Noel**):
  fecha → Barra o Cocina → **Top 10** (recuento rápido: solo los marcados) o
  **Completo** (todos, a fin de mes) → en Completo, la **familia** (Vermuts,
  Vinos…) → lista de esos productos con casillero, unidad y contenido
  (botellas con +¼ +½ +¾) y al lado el **equivalente en litros/kilos**
  (cantidad × contenido) → Guardar. Si la fecha ya tiene stock, se abre ese
  mismo con lo cargado; se guardan solo los cambios (vale el último de cada
  producto en esa fecha). Inicio e Historial: una tarjeta por día, por
  familia, con litros. La tarjeta muestra solo lo que se contó ese día: la
  categoría que no se contó no aparece; si fue Top 10, solo los 10 (con
  "falta" en los que no); si fue Completo, toda la categoría.
- **Cerrar:** el encargado (o Noel) cierra el stock del día desde la carga o
  la tarjeta, con "¿Estás seguro…?". Cerrado = nadie lo modifica; la
  planilla rechaza cargas en un día cerrado. Solo **Noel** reabre y borra un
  día entero. Hoja **Cierres** en la planilla. Ignacio no es usuario de la app.
- **Catálogo** (hoja de la planilla, la arman Ignacio y Noel ahí mismo, es lo
  más rápido): Producto | Categoría (Barra/Cocina; "Bebidas"/"Comida" viejos
  se leen como Barra/Cocina) | Grupo ("Top 10" o cualquier otra cosa = no;
  máximo 10 por categoría) | Unidad | Familia | Contenido ("750 cc", "1 l",
  "5 kg"; un número solo = cc). **El orden de familias y productos en la app
  y en el Resumen es el de esta hoja.** Desde la app (Config) también se crean
  productos: piden familia (obligatoria, se elige o se crea), Top 10 sí/no,
  unidad y contenido (lista "Cantidades" de Config). En Config, una lista
  desplegable por Top 10 y por familia. Tiene el botón "Abrir la planilla" en
  Config (no en Inicio). Reabrir y borrar día también los exige el Apps
  Script (`QUIEN_PUEDE_BORRAR`); cerrar, `PUEDEN_CERRAR`. Josefina
  quedó con los mismos permisos que Noel salvo borrar.
- Noel mira el stock en la planilla: hoja **Conteos** (un renglón por
  producto contado) y hoja **Resumen**, que el Apps Script rearma después de
  cada cambio (Categoría, Familia, Top 10, Producto, Contenido, Unidad y
  después las fechas en columnas, la más nueva primero;
  al lado de cada fecha una columna "Dif." contra el conteo anterior de ese
  producto: bajas en rojo, y con fondo rojo si bajó más de `BAJA_FUERTE`
  = 30 %; la fecha dice "(cerrado)" si el día está cerrado).
  Hoja **Config**: unidades y cantidades.
- **Una planilla (y un Apps Script) por bar**, todas de Noel. El link de
  instalación lleva uno o varios pares `vincular=<exec>&bar=<Nombre>` más
  `quien=<Persona>`; Noel recibe un link con todos sus bares y ve un selector
  arriba. La persona del link manda siempre. Si un link trae una planilla que
  el celular ya tenía con otro nombre, se renombra (así pasó Hugo → Archie).
- En el celular: caché `stockbares_bar_<bar>_cache_v2`, pendientes
  `stockbares_pendientes_v2` (la v1 quedó sin usar).
- **Planilla central** (en preparación, octubre 2026): una planilla "Sistema
  Bares" con el **único** Apps Script (`apps-script/Central.gs`) para todos
  los bares (van a ser ~10, de distintos dueños; Noel es el contador de
  todos). La crea Ignacio con su cuenta y después se le pasa a Noel (al
  pasarla, Noel la vuelve a implementar y cambian los links: hacerlo antes
  de mandar links a los encargados). Hojas: **Bares** (Bar | Planilla |
  WhatsApp del dueño), **Personas** (Persona | Rol Administrador/Encargado |
  Bares "Todos" o nombres | Clave | Link), **Compras <Bar>** (una por bar:
  el detalle de compras de **Cuccina**, el sistema de gestión — no Fudo —,
  pegado tal cual) y **Equivalencias** (Nombre en compras | Producto del
  stock, o "No es stock"). Las planillas de cada bar quedan solo con datos
  (el código las abre por ID).
  Link: `…/stockbares/#central=<exec>&clave=<clave>`, lo arma el menú
  "Stock bares → Armar links de instalación" con la dirección /exec guardada
  en la hoja **Ajustes** (B1; la pide la primera vez; "Cambiar la dirección
  del código" la cambia y rearma todos los links con las mismas claves). No
  se usa `ScriptApp.getService().getUrl()`: devolvía la de una
  implementación archivada. Actualizar siempre con Gestionar
  implementaciones → Nueva versión, nunca "Nueva implementación". La clave dice persona, rol y
  bares; el encargado solo entra a su bar (lo controla el Apps Script). Los
  links viejos (`vincular`) siguen andando; un link central encima de uno
  viejo pasa los bares y los pendientes a la central. En el celular:
  `stockbares_central`, `stockbares_rol`. `Code.gs` es el script viejo por
  bar (Archie y Hugo lo tienen pegado hasta que se cambie).
- **Precios (desde 17/10/2026):** precio = **total con impuestos ÷
  cantidad** ("Precio Total" en Archie/Hugo, "TOTAL" en Felicidad e
  Industrias). Si la medida de la compra es **Litro** (o Kilo) y el
  producto se cuenta en botellas, el precio de la botella = precio por
  litro × Contenido del catálogo. De cada producto vale la **última compra**
  de cada proveedor; lo bonificado (total 0) y las notas de crédito no
  cuentan. **Solo bebidas** (decisión de Ignacio, en todos los reportes):
  en los que traen Familia (Archie, Hugo) solo cuenta lo de familia BARRA
  (BARRA COMPRAS, BARRA VENTAS, PRE PRODUCIDOS BARRA), y en todos los
  bares solo los productos de **Barra** del catálogo llevan precio (los de
  Cocina, como los de Archie, quedan sin precio ni proveedor en los
  pedidos y no cuentan en "sin precio"). Felicidad e Industrias no trae
  Familia: es bebida lo que está en el catálogo de algún bar (código o
  nombre/Equivalencias) o se le compra a un proveedor de "Proveedores de
  bebida". **Al cargar compras, lo que no es bebida ni se guarda** en las
  hojas Compras/Proveedores (`filtroBebidas_`; la ventana dice cuántos
  renglones quedaron afuera). Se precalcula en la hoja **Precios** de la central al cargar
  compras (menú "Recalcular precios" si se editan a mano): la app no lee
  todas las compras en cada pedido. Búsqueda: por **código** (columna 7 del
  Catálogo) en las hojas de compras donde figura ese bar (los códigos son
  de ese Cuccina), si no por nombre o Equivalencias; si hay compras con
  proveedor no se mezclan las "Sin proveedor". Reportes: Archie/Hugo
  "Detalle de Compras" (con Familia y U. Medida: solo cuenta lo de familia
  BARRA para "nuevos"). Felicidad e Industrias, **dos reportes** del mismo
  período (Cuccina no deja sacar proveedor y bar juntos): (1) "DETALLE DE
  COMPRAS … TOTALES POR: FECHA" desglosado **por bar** (2 renglones de
  título; GRUPO2 = fecha, SUBGRUPO2 = bar, trae CODIGO, no trae proveedor)
  → hoja "Compras Felicidad e Industrias": de ahí sale **el precio** (la
  última compra por fecha); (2) el mismo reporte desglosado **por
  proveedor** (GRUPO2 = proveedor, sin fechas) → hoja "Proveedores
  Felicidad e Industrias": **solo** para saber a quién se le compra cada
  código; de ahí no sale ningún precio ni producto (sus precios serían
  promedios del período; decisión de Ignacio, 17/10/2026). Si a un código
  se le compra a varios proveedores, el producto aparece con cada uno (el
  que más se compró primero) y el mismo último precio. Las columnas GRUPO
  se reconocen por lo que dicen (fecha, bar o proveedor), por separado en
  cada tanda cargada (cada carga repite sus títulos).
- **Vinos:** si el catálogo de un bar no tiene ninguna familia de vinos
  (Hugo: los vinos no se cuentan), los vinos de sus compras no aparecen en
  "Nuevos en las compras". Vino = comprado por **Unidad** y con la cepa en
  el nombre o de una bodega/distribuidora de vinos (`esVino_`). Sus precios
  igual quedan en la hoja Precios (le sirven a Archie, que sí cuenta vinos).
- **Nombres (decisión de octubre 2026):** en **todos** los bares el nombre
  del producto en el stock es **igual** al del reporte de compras de
  Cuccina, aunque el nombre tenga mal la medida (ej. "Fernet Branca 1000cc"
  que en realidad es de 750): la medida buena va en la columna
  **Contenido** del Catálogo, que es la que usa la app para los litros. Un
  solo catálogo por bar sirve para el stock y para los pedidos. Archie y
  Hugo tienen cada uno su propio Cuccina (hojas "Compras Archie" y "Compras
  Hugo"); los otros ~8 bares (sociedades Industrias SRL y Felicidad SRL)
  comparten un mismo Cuccina, así que tienen **un solo reporte de compras**
  para todos (una hoja "Compras …" con otro nombre: sirve para precios pero
  no dispara "Nuevos en las compras", que solo mira "Compras <Bar>").
  Equivalencias queda como red de seguridad. Por ahora **solo bebidas**. Lo
  que aparece en "Compras <Bar>" y no está en el catálogo ni en
  Equivalencias le sale al Administrador como "Nuevos en las compras"
  (Pedidos y Config) con tres opciones: Es nuevo (formulario de producto
  con el nombre; si se cambia el nombre se anota la equivalencia), Es el
  mismo que… (acción `equiv_set`) o No es stock.
- **Bares de Felicidad SRL e Industrias SRL** (comparten Cuccina):
  Brunchería, Capitán, Apartamento y Billy Beer (después Dada Güemes,
  Vinatería…). Sus catálogos salieron de "INVENTARIOS_FELICIDAD.xlsx"
  (solo bebidas e insumos de barra, familias = secciones del inventario,
  columna 7 "Código Cuccina", que es la que usa la búsqueda de precios).
  Precios: los dos reportes de arriba. Al principio se usó la hoja
  "COMPRAS…" de ese Excel (resumen sin fechas) y, como ahí los nombres no
  coincidían con los inventarios, Equivalencias se armó **por código**
  (mismo nombre de compras → producto de cada bar; un nombre puede ir en
  varios renglones). Hugo: catálogo de
  "INVENTARIO_HUGO_actualizado.xlsx" + equivalencias de sus compras viejas.
- **Cargar compras** (menú "Stock bares → Cargar compras (Excel de
  Cuccina)"): ventana donde Ignacio elige el destino (Archie, Hugo,
  Felicidad e Industrias, o las "Compras …" que haya), el Excel y la hoja
  (sugiere "depurado" o la que empieza con "COMPRAS"). El Excel se lee en
  la ventana (SheetJS de cdnjs) y `cargarCompras` lo **agrega** a la hoja
  "Compras <destino>" sin repetir renglones (casilla para reemplazar). Así
  no se pierden precios viejos y gana lo más nuevo. Para los destinos que
  no son un bar (Felicidad e Industrias) pide **los dos Excel**: 1. el
  reporte por bar y 2. el reporte por proveedor (va a "Proveedores
  <destino>"); controla que no estén al revés (el primero tiene que traer
  fechas; el segundo, proveedores). La casilla de borrar vale para los
  dos. Google no deja escribir fuera de los renglones/columnas de una hoja
  (una nueva tiene 1000 × 26): el código agrega lo que falte (`lugar_`).
- (Hasta el 17/10/2026 el precio era el "Precio Unitario" del reporte; se
  cambió a total con impuestos ÷ cantidad, ver Precios.)
- **Pedidos** (solo con la planilla central; los hacen encargados y Noel):
  fecha y Barra/Cocina → proveedor → productos con precio de costo (o "sin
  precio") y total que se va sumando. **En los pedidos aparecen los
  productos del catálogo y además, en Barra, las bebidas que ese bar compró
  y no están en el catálogo** (`compras_pedido` en get_all; decisión de
  Ignacio, 18/10/2026: el stock es solo el catálogo, los pedidos no). Si se
  compran por litro y el nombre trae la medida ("1000cc"), se piden por
  botella. Bebida: en Archie/Hugo, familia BARRA; en Felicidad e Industrias
  (sin Familia), lo que se le compra a un proveedor de la hoja
  **"Proveedores de bebida"** de la central (alcanza una parte del nombre;
  se corrige a mano). Fletes, servicios, eventos, "No es stock" y los vinos
  de los bares que no cuentan vinos no aparecen → Revisar → **"Enviar
  pedido"** → cartel "Pedido realizado con éxito" (sin señal: "guardado en
  el celular"). **Sin WhatsApp** (decisión de Noel, 17/10/2026). Todos van
  a la hoja **Pedidos de la planilla central** (acción `pedido_add`): Fecha
  | Bar | Pedido | Categoría | Proveedor | Producto | Cantidad | Unidad |
  Precio | Subtotal | Persona | Nota | Cargado | **Estado** | ID, con
  filtro. Estado (lista: En espera / Recibido / Cancelado) lo pone Noel por
  renglón y pinta el renglón amarillo / verde / rojo; la app lo muestra en
  "Pedidos hechos". **Modificar / Borrar pedido** (18/10/2026): desde la
  tarjeta, solo mientras todo esté "En espera" (Recibido o Cancelado queda
  fijo); el encargado solo los suyos, el Administrador cualquiera. Modificar
  vuelve al armado con las cantidades y "Guardar cambios" reemplaza los
  renglones (`pedido_edit`); Borrar los saca de la planilla
  (`pedido_delete`). Los pedidos viejos que quedaron en la hoja Pedidos de
  cada bar se siguen viendo (no se modifican). El borrador queda en el celular
  (`stockbares_bar_<bar>_pedido_borrador`).
- **Velocidad (17/10/2026, pedido de Ignacio):**
  - Planilla central: memoria rápida de Google (CacheService) para
    Personas y Bares (10 min) y los precios de cada bar (6 h, clave con la
    huella del catálogo y un número de versión de precios). Se borra sola
    al editar a mano la central (`onEdit`) y cuando el código cambia algo
    (cargar compras, equivalencias, armar links). Si una clave o un bar no
    está en la memoria, se mira la planilla (alguien recién agregado entra
    enseguida). No se lee dos veces lo mismo en un pedido; pedidos y
    equivalencias no abren la planilla del bar; la planilla del bar se abre
    antes del candado. Resumen sin releer lo ya leído y con las "Dif." de
    una vez (`getRangeList`). Medido con la planilla simulada: leer un bar
    pasó de 56 a 19 llamadas.
  - A la app van los últimos **60 días** de stock (`DIAS_A_LA_APP`; la
    respuesta trae `desde`); lo de antes queda en Conteos y Resumen, y el
    Historial lo avisa. Un pendiente de un día más viejo que `desde` no se
    da por hecho: se vuelve a mandar (la planilla no lo repite).
  - App: dibuja solo la pestaña que se ve y el detalle de cada tarjeta al
    abrirla (las abiertas siguen abiertas al actualizar); si lo leído no
    cambió, no redibuja; primero manda lo pendiente y después lee; después
    de mandar no relee enseguida (a los 20 s); tiempo máximo de 30 s para
    leer y 45 s para mandar; el cartel amarillo de "sin enviar" aparece si
    no se pudo mandar o si tarda más de 10 s (mientras tanto arriba dice
    "Enviando…"); quien tiene varios bares tiene los otros leídos de fondo
    (los que hace más de 15 min que no se leen). En un celular lento con
    Apartamento (153 productos, 60 días): dibujar pasó de 620 ms a 11 ms y
    abrir de 2,2 s a 0,5 s.
- **Versión de la app:** `APP_VERSION` en `stockbares/index.html` tiene que
  ser igual a `stockbares/version.json`. Al abrir, la app lee version.json
  y si cambió se recarga sola (una vez por versión, con `?v=`). **Al
  publicar un cambio de la app, subir los dos números.** Mientras lee la
  planilla muestra "Actualizando…"; si el código de la planilla falla, el
  cartel muestra el motivo.
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
