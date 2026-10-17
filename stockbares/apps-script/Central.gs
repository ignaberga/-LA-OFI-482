// ============================================================
// STOCK DE BARES - Codigo CENTRAL (uno solo para todos los bares)
// ============================================================
// Va pegado en UNA planilla, la central ("Sistema Bares"). Las planillas
// de cada bar quedan solo con datos, sin codigo: este codigo las abre y
// les escribe. Cuando haya que actualizar algo, se pega aca y anda para
// todos los bares.
//
// Hojas de la planilla central (se crean solas):
//   - "Bares": un renglon por bar. Bar | Planilla (el link de la planilla
//     del bar) | WhatsApp del dueño (a quien le llegan los pedidos para
//     aprobar, con codigo de pais: 5493511234567).
//   - "Personas": quien usa la app. Persona | Rol (Administrador o
//     Encargado) | Bares ("Todos" o el nombre del bar; varios separados
//     por coma) | Clave | Link de instalacion. La Clave y el Link los arma
//     el menu "Stock bares > Armar links de instalacion".
//   - "Compras <Bar>" (una por bar, ej. "Compras Archie"): se pega el
//     detalle de compras de Cuccina de ese bar, tal cual sale. Se usan las
//     columnas Fecha Documento, Razon Social (proveedor), Descripcion y
//     Precio Unitario (columna H). De cada producto vale la ultima compra,
//     de cualquier bar (los proveedores son los mismos). Lo bonificado al
//     100 % y las notas de credito no cuentan como precio.
//   - "Compras Felicidad e Industrias" (o cualquier "Compras ..."): el
//     reporte de compras de los bares que comparten Cuccina, desglosado
//     por bar (GRUPO2 = fecha, SUBGRUPO2 = bar, CODIGO, DENOMINACION).
//     De ahi sale el precio (el de la ultima compra). No trae proveedor.
//   - "Proveedores Felicidad e Industrias": el mismo reporte desglosado
//     por proveedor (GRUPO2 = proveedor). Solo sirve para saber a quien se
//     le compra cada codigo: de ahi no sale ningun precio ni producto.
//   - "Equivalencias": Nombre en compras | Producto del stock. Para cuando
//     Cuccina lo llama distinto que el stock (el nombre que vale es el del
//     stock). Un mismo nombre de compras puede ir en varios renglones (uno
//     por cada producto de distintos bares). "No es stock" = no preguntar
//     mas por ese (flete, etc.).
//
// En la planilla de cada bar este codigo usa (y crea si faltan): Conteos,
// Catalogo, Resumen, Config, Cierres y Pedidos.
//
// Seguridad: cada persona entra con su Clave (va dentro de su link). Un
// encargado solo puede leer y escribir el bar que tiene en "Bares", y solo
// puede cargar stock, cerrarlo y hacer pedidos. Los Administradores pueden
// todo en todos los bares.
//
// Para que la app ande rapido, lo que casi no cambia (Personas, Bares y
// los precios de cada bar) queda en una memoria rapida de Google
// (CacheService) un rato. Se borra sola cuando se edita la planilla
// central a mano (onEdit) o cuando el codigo cambia algo.
//
// Este archivo es una copia de respaldo: el que funciona de verdad es el
// pegado en la planilla central. La direccion /exec NUNCA va en el
// repositorio.
//
// COMO INSTALARLO DESDE CERO:
// 1. Crear la planilla "Sistema Bares".
// 2. Extensiones > Apps Script. Borrar lo que haya, pegar este archivo
//    completo y guardar.
// 3. Implementar > Nueva implementacion > tipo "Aplicacion web".
//      - Ejecutar como: Yo
//      - Quien tiene acceso: Cualquier usuario
//    Autorizar los permisos que pide Google.
// 4. Volver a la planilla y recargarla: aparece el menu "Stock bares".
//    Completar las hojas Bares y Personas y usar "Armar links de
//    instalacion" (la primera vez pide la URL /exec de la implementacion:
//    queda guardada en la hoja Ajustes).
//
// COMO ACTUALIZARLO (sin que cambien los links):
// 1. Extensiones > Apps Script, borrar todo, pegar este archivo y guardar.
// 2. Arriba, al lado de "Ejecutar", elegir la funcion "autorizar" y tocar
//    Ejecutar. Si Google pide permisos, aceptarlos (es la cuenta propia).
// 3. Implementar > Gestionar implementaciones > lapiz > Version: "Nueva
//    version" > Implementar. (NO "Nueva implementacion".)
// ============================================================

const APP_URL = "https://ignaberga.github.io/-LA-OFI-482/stockbares/";

const ROL_ADMIN = "Administrador";
const ROL_ENCARGADO = "Encargado";
// Que puede hacer cada rol (acciones que manda la app).
const ACCIONES_ROL = {
  "Administrador": ["add", "cerrar", "reabrir", "delete_dia", "delete_carga", "replace_carga", "product_set",
    "product_remove", "config_add", "config_remove", "pedido_add", "equiv_set"],
  "Encargado": ["add", "cerrar", "pedido_add"]
};

const SHEET_BARES = "Bares";
const SHEET_PERSONAS = "Personas";
const SHEET_EQUIV = "Equivalencias";
const EQUIV_HEADERS = ["Nombre en compras", "Producto del stock"];
const NO_ES_STOCK = "No es stock";
const BARES_HEADERS = ["Bar", "Planilla", "WhatsApp del dueño"];
const PERSONAS_HEADERS = ["Persona", "Rol", "Bares", "Clave", "Link de instalación"];

const SHEET_CONTEOS = "Conteos";
const SHEET_CATALOGO = "Catálogo";
const SHEET_RESUMEN = "Resumen";
const SHEET_CONFIG = "Config";
const SHEET_CIERRES = "Cierres";
const SHEET_PEDIDOS = "Pedidos";

const CONTEO_HEADERS = ["ID","Fecha","Categoría","Grupo","Producto","Cantidad","Unidad","Persona","Nota","Cargado","Carga"];
const CATALOGO_HEADERS = ["Producto","Categoría","Grupo","Unidad","Familia","Contenido"];
const CONFIG_HEADERS = ["Tipo","Valor"];
const CIERRES_HEADERS = ["Fecha","Cerrado por","Cuándo"];
const PEDIDO_HEADERS = ["ID","Fecha","Pedido","Categoría","Proveedor","Producto","Cantidad","Unidad","Precio","Subtotal","Persona","Nota","Cargado"];

const DEFAULT_CONFIG = {
  unidades: ["Botellas","Kilos","Unidades"],
  cantidades: ["500 cc","700 cc","750 cc","1 l","1,5 l"]
};

const RESUMEN_FECHAS = 20;
const BAJA_FUERTE = 0.3;
// Cuantos renglones de pedidos (los mas nuevos) se mandan a la app.
const PEDIDOS_A_LA_APP = 400;
// Cuantos dias de stock (los mas nuevos) se mandan a la app. Los de antes
// quedan en la planilla (Conteos y Resumen); asi el celular no se llena.
const DIAS_A_LA_APP = 60;
// Memoria rapida: Personas y Bares hasta 10 minutos; precios de cada bar
// hasta 6 horas (se borran antes si cambia algo).
const CACHE_SEG = 600;
const CACHE_PRECIOS_SEG = 21600;

// La planilla del bar con la que se esta trabajando en este pedido de la app.
let SS = null;
function ss_() { return SS; }
function central_() { return SpreadsheetApp.getActiveSpreadsheet(); }

// ------------------------------------------------------------
// Planilla central: bares, personas y precios
// ------------------------------------------------------------
function hojaCentral_(name, headers) {
  const c = central_();
  let sh = c.getSheetByName(name);
  if (!sh) {
    sh = c.insertSheet(name);
    if (headers) {
      sh.appendRow(headers);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
  }
  return sh;
}

function filasCentral_(name) {
  const sh = central_().getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1);
}

// Memoria rapida (CacheService). Si falla, se lee la planilla como siempre.
// Lo que ya se pidio en este pedido de la app queda en CACHE_LEIDO_.
let CACHE_LEIDO_ = {};
function cache_() { try { return CacheService.getScriptCache(); } catch (e) { return null; } }
function cacheGet_(k) {
  if (k in CACHE_LEIDO_) return CACHE_LEIDO_[k];
  const c = cache_();
  if (!c) return null;
  try { const v = c.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
// Trae varias de una vez (cuesta lo mismo que una).
function cachePrecargar_(ks) {
  const c = cache_();
  if (!c) return;
  try {
    const o = c.getAll(ks);
    ks.forEach(function (k) { CACHE_LEIDO_[k] = o[k] ? JSON.parse(o[k]) : null; });
  } catch (e) {}
}
function cachePut_(k, v, seg) {
  const c = cache_();
  if (!c) return;
  delete CACHE_LEIDO_[k];
  // Lo que pasa de 100 KB no entra: se calcula cada vez.
  try { c.put(k, JSON.stringify(v), seg); } catch (e) {}
}
function cacheBorrar_(ks) {
  ks.forEach(function (k) { delete CACHE_LEIDO_[k]; });
  const c = cache_();
  if (!c) return;
  try { c.removeAll(ks); } catch (e) {}
}
// Los precios guardados en la memoria llevan este numero: cuando cambian
// las compras o las Equivalencias, el numero cambia y se calculan de nuevo.
function versionPrecios_() {
  const v = cacheGet_("pv");
  if (v) return v;
  return nuevaVersionPrecios_();
}
function nuevaVersionPrecios_() {
  const v = String(Date.now()) + Math.random().toString(36).slice(2, 6);
  cachePut_("pv", v, CACHE_PRECIOS_SEG);
  return v;
}

// Cuando se edita a mano la planilla central, se olvida lo que haya en la
// memoria rapida de esa hoja.
function onEdit(e) {
  try {
    const n = e && e.range ? e.range.getSheet().getName() : "";
    if (n === SHEET_PERSONAS || n === SHEET_BARES) cacheBorrar_(["pb"]);
    if (n === SHEET_EQUIV || n === SHEET_PRECIOS || /^(compras|proveedores)\b/i.test(n)) nuevaVersionPrecios_();
  } catch (err) {}
}

// Personas y Bares se leen en cada pedido de la app: se guardan un rato en
// la memoria rapida. fresco = leer la planilla si o si.
let PB_ = null;
function personasYBares_(fresco) {
  if (PB_ && !fresco) return PB_;
  if (!fresco) {
    const c = cacheGet_("pb");
    if (c && Array.isArray(c.bares) && Array.isArray(c.personas)) return (PB_ = c);
  }
  PB_ = { bares: leerBaresHoja_(), personas: leerPersonasHoja_() };
  cachePut_("pb", PB_, CACHE_SEG);
  return PB_;
}

function idDePlanilla_(v) {
  const s = String(v || "").trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : s;
}

function leerBares_() { return personasYBares_().bares; }
function leerPersonas_() { return personasYBares_().personas; }

function leerBaresHoja_() {
  return filasCentral_(SHEET_BARES).filter(function (r) { return String(r[0]).trim() !== ""; }).map(function (r) {
    return { nombre: String(r[0]).trim(), id: idDePlanilla_(r[1]), whatsapp: String(r[2] || "").replace(/[^0-9]/g, "") };
  });
}

function leerPersonasHoja_() {
  return filasCentral_(SHEET_PERSONAS).filter(function (r) { return String(r[0]).trim() !== ""; }).map(function (r) {
    const rol = /admin/i.test(String(r[1])) ? ROL_ADMIN : ROL_ENCARGADO;
    const bares = String(r[2] || "").split(",").map(function (b) { return b.trim(); }).filter(String);
    return { persona: String(r[0]).trim(), rol: rol, bares: bares, clave: String(r[3] || "").trim() };
  });
}

// Quien es (por su clave) y a que bares puede entrar. null si la clave no
// sirve. Si no la encuentra en la memoria rapida, mira la planilla (puede
// ser alguien recien agregado).
function quien_(clave, fresco) {
  if (!clave) return null;
  const pb = personasYBares_(fresco);
  const p0 = pb.personas.filter(function (x) { return x.clave && x.clave === String(clave); })[0];
  if (!p0) return fresco ? null : quien_(clave, true);
  const p = { persona: p0.persona, rol: p0.rol, bares: p0.bares, clave: p0.clave };
  const todosLosBares = p.bares.some(function (b) { return /^todos$/i.test(b); });
  p.baresPermitidos = pb.bares.filter(function (b) {
    return todosLosBares || p.bares.some(function (x) { return x.toLowerCase() === b.nombre.toLowerCase(); });
  });
  p.fresco = !!fresco;
  return p;
}

function norm_(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

// "$ 12.345,50", "12345.5" o un numero → 12345.5
function precio_(v) {
  if (typeof v === "number") return v;
  let s = String(v || "").replace(/[^0-9.,-]/g, "");
  if (!s) return null;
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// "02/09/2026", "2026/08/01", una fecha de la planilla o un numero → milisegundos.
function fechaMs_(v) {
  if (isDate_(v)) return v.getTime();
  const t = String(v || "").trim();
  let m = t.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return new Date(Number(m[3].length === 2 ? "20" + m[3] : m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  return 0;
}
function esFecha_(v) { return isDate_(v) || /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(String(v || "").trim()); }

// Hojas "Compras ..." de la planilla central.
function hojasCompras_() {
  return central_().getSheets().filter(function (sh) { return /^compras\b/i.test(sh.getName()); });
}
// La hoja "Proveedores <destino>" (el reporte desglosado por proveedor), si hay.
function hojaProveedores_(destino) {
  const n = norm_("Proveedores " + destino);
  return central_().getSheets().filter(function (sh) { return norm_(sh.getName()) === n; })[0] || null;
}

// Busca la fila de titulos (puede haber renglones de titulo arriba, como en
// el reporte de Felicidad e Industrias) y devuelve las columnas que usamos.
function columnasCompras_(fila) {
  const t = fila.map(norm_);
  const col = function (re) { for (let j = 0; j < t.length; j++) if (re.test(t[j])) return j; return -1; };
  if (col(/^descripcion$|^denominacion$|^producto$|^nombre$|^articulo$/) < 0) return null;
  const primera = function () { for (let i = 0; i < arguments.length; i++) { const c = col(arguments[i]); if (c >= 0) return c; } return -1; };
  return {
    nom: col(/^descripcion$|^denominacion$|^producto$|^nombre$|^articulo$/),
    cod: col(/^codigo$/),
    fecha: primera(/^fecha doc/, /^fecha/),
    prov: col(/razon social|^proveedor/),
    grupos: [col(/^grupo ?2$/), col(/^subgrupo ?2$/)].filter(function (c) { return c >= 0; }),
    cant: primera(/^cantidad$/, /suma de cantidad/),
    total: primera(/^precio total$/, /^total$/, /suma de total/),
    unit: primera(/precio unitario/, /costo/),
    medida: primera(/^u\.? ?medida$/, /^medida$/, /unidad de medida/),
    familia: col(/^familia$/),
    desc: primera(/^descuento item/, /^descuento$/),
    tipo: col(/^tipo/)
  };
}

// Que trae cada columna GRUPO de un reporte: fechas, bares o proveedores
// (se mira lo que dice en los renglones de abajo de los titulos). Una
// columna vacia no trae nada.
function rolesGrupos_(data, i, c, bares) {
  return c.grupos.map(function (j) {
    let fechas = 0, conBar = 0, total = 0;
    for (let k = i + 1; k < data.length && total < 300; k++) {
      if (columnasCompras_(data[k])) break;
      const v = data[k][j];
      if (v === "" || v === null || v === undefined) continue;
      total++;
      if (esFecha_(v)) fechas++;
      else if (bares[norm_(v)]) conBar++;
    }
    return !total ? "" : fechas > total / 2 ? "fecha" : conBar ? "bar" : "prov";
  });
}

// Lee una hoja de compras de Cuccina pegada tal cual. Precio = total ÷
// cantidad (con impuestos). Lo bonificado (total 0), las notas de credito
// y lo que no es de barra no cuentan. GRUPO2/SUBGRUPO2 pueden traer la fecha, el bar o el
// proveedor segun como se saco el reporte: se reconoce por lo que dicen.
function leerCompras_(sh, nombresBares) {
  const data = sh.getDataRange().getValues();
  const bares = {};
  (nombresBares || []).forEach(function (b) { bares[norm_(b)] = b; });
  const origen = sh.getName().replace(/^compras\s*/i, "");
  const out = [];
  let c = null, prov = "";
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const cc = columnasCompras_(r);
    if (cc) {
      c = cc; prov = "";
      c.roles = rolesGrupos_(data, i, c, bares);
      continue;
    }
    if (!c) continue;
    const val = function (j) { return j >= 0 && r[j] !== undefined && r[j] !== null ? r[j] : ""; };
    const nombre = String(val(c.nom)).trim();
    let fecha = c.fecha >= 0 ? fechaMs_(val(c.fecha)) : 0, bar = "";
    if (c.prov >= 0 && String(val(c.prov)).trim()) prov = String(val(c.prov)).trim();
    c.grupos.forEach(function (j, n) {
      const v = val(j);
      if (String(v).trim() === "") return;
      if (c.roles[n] === "fecha") fecha = fechaMs_(v);
      else if (c.roles[n] === "bar") bar = bares[norm_(v)] || "";
      else if (c.prov < 0) prov = String(v).trim();
    });
    if (!nombre || /^total/i.test(nombre)) continue;
    // Solo bebidas (e insumos de barra): en los reportes que traen Familia
    // (Archie, Hugo), lo que no es de barra no cuenta. Los que no la traen
    // (Felicidad e Industrias) se usan solo para los productos del catalogo
    // de cada bar, que tiene solo bebidas.
    if (c.familia >= 0 && !/barra/i.test(norm_(val(c.familia)))) continue;
    if (c.desc >= 0 && num_(val(c.desc)) >= 100) continue;
    if (c.tipo >= 0 && /^n\.? ?c\b|credito/i.test(norm_(val(c.tipo)))) continue;
    let precio = null;
    if (c.total >= 0 && c.cant >= 0) {
      const cant = num_(val(c.cant)), tot = precio_(val(c.total));
      if (cant > 0 && tot > 0) precio = tot / cant;
    } else if (c.unit >= 0) {
      precio = precio_(val(c.unit));
    }
    if (!(precio > 0)) continue;
    out.push({
      nombre: nombre,
      cantidad: c.cant >= 0 ? num_(val(c.cant)) : 0,
      codigo: c.cod >= 0 ? String(val(c.cod)).trim() : "",
      proveedor: prov.replace(/\s*\(\d+\)\s*$/, ""),
      precio: Math.round(precio * 100) / 100,
      medida: c.medida >= 0 ? String(val(c.medida)).trim() : "",
      familia: c.familia >= 0 ? String(val(c.familia)).trim() : "",
      fecha: fecha,
      origen: origen,
      bar: bar
    });
  }
  return out;
}

// ------------------------------------------------------------
// Hoja "Precios" (precalculada): la ultima compra de cada producto a cada
// proveedor. Se rearma al cargar compras (o con el menu "Recalcular
// precios"), asi la app no tiene que leer todas las compras cada vez.
// ------------------------------------------------------------
const SHEET_PRECIOS = "Precios";
const PRECIOS_HEADERS = ["Producto (compras)", "Código", "Proveedor", "Precio", "Medida", "Fecha", "Familia", "Origen", "Bares"];

function reconstruirPrecios_() {
  const bares = leerBares_().map(function (b) { return b.nombre; });
  let lista = [];
  hojasCompras_().forEach(function (sh) {
    // Si esa hoja no trae proveedor (Felicidad e Industrias), se busca por
    // codigo en la hoja "Proveedores ..." (el reporte por proveedor). Si a
    // un producto se le compra a varios, queda con cada uno, con el mismo
    // precio (el de la ultima compra).
    const porCodigo = proveedoresPorCodigo_(sh.getName().replace(/^compras\s*/i, ""), bares);
    leerCompras_(sh, bares).forEach(function (x) {
      const provs = !x.proveedor && x.codigo && porCodigo ? porCodigo[x.codigo] : null;
      if (!provs) { lista.push(x); return; }
      provs.forEach(function (v) { lista.push(Object.assign({}, x, { proveedor: v })); });
    });
  });
  const ult = {};
  lista.forEach(function (x, i) {
    const k = [x.origen, x.codigo, norm_(x.nombre), x.proveedor].join("|");
    const prev = ult[k];
    if (!prev || x.fecha >= prev.fecha) {
      const losBares = prev ? prev.bares : {};
      ult[k] = x; x.orden = i; x.bares = losBares;
    }
    if (x.bar) ult[k].bares[x.bar] = true;
  });
  const filas = Object.keys(ult).map(function (k) { return ult[k]; })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre) || b.fecha - a.fecha; })
    .map(function (x) {
      return [x.nombre, x.codigo, x.proveedor || "Sin proveedor", x.precio, x.medida, x.fecha ? new Date(x.fecha) : "",
        x.familia, x.origen, Object.keys(x.bares).join(", ")];
    });
  let sh = central_().getSheetByName(SHEET_PRECIOS);
  if (!sh) sh = central_().insertSheet(SHEET_PRECIOS);
  sh.clear();
  lugar_(sh, filas.length + 1, PRECIOS_HEADERS.length);
  sh.getRange(1, 1, 1, PRECIOS_HEADERS.length).setValues([PRECIOS_HEADERS]).setFontWeight("bold");
  if (filas.length) sh.getRange(2, 1, filas.length, PRECIOS_HEADERS.length).setValues(filas);
  sh.setFrozenRows(1);
  PRECIOS_ = null;
  nuevaVersionPrecios_();
  return filas.length;
}

// { codigo: [proveedores, el que mas se compro primero] } segun la hoja
// "Proveedores <destino>". null si no hay hoja.
function proveedoresPorCodigo_(destino, bares) {
  const sh = hojaProveedores_(destino);
  if (!sh) return null;
  const cant = {};
  leerCompras_(sh, bares).forEach(function (x) {
    if (!x.codigo || !x.proveedor) return;
    const c = (cant[x.codigo] = cant[x.codigo] || {});
    c[x.proveedor] = (c[x.proveedor] || 0) + (x.cantidad > 0 ? x.cantidad : 0);
  });
  const out = {};
  Object.keys(cant).forEach(function (k) {
    out[k] = Object.keys(cant[k]).sort(function (a, b) { return cant[k][b] - cant[k][a] || a.localeCompare(b); });
  });
  return out;
}

// (Se lee una sola vez por pedido de la app.)
let PRECIOS_ = null;
function leerPrecios_() {
  if (PRECIOS_) return PRECIOS_;
  let sh = central_().getSheetByName(SHEET_PRECIOS);
  let data = sh ? sh.getDataRange().getValues() : [];
  if (data.length <= 1) {
    if (!hojasCompras_().length) return (PRECIOS_ = []);
    reconstruirPrecios_();
    sh = central_().getSheetByName(SHEET_PRECIOS);
    data = sh.getDataRange().getValues();
  }
  return PRECIOS_ = data.slice(1).filter(function (r) { return String(r[0]).trim(); }).map(function (r) {
    return {
      nombre: String(r[0]).trim(), codigo: String(r[1]).trim(), proveedor: String(r[2] || "Sin proveedor").trim(),
      precio: num_(r[3]), medida: String(r[4] || ""), fecha: fechaMs_(r[5]), familia: String(r[6] || ""),
      origen: String(r[7] || ""), bares: String(r[8] || "").split(",").map(norm_).filter(String)
    };
  });
}

function recalcularPrecios() {
  const n = reconstruirPrecios_();
  SpreadsheetApp.getUi().alert("Listo: " + n + " precios en la hoja «Precios».");
}

// { nombre en compras (normalizado): [productos del stock] } ("No es stock"
// si alguno lo dice). Se lee una sola vez por pedido de la app.
let EQUIV_ = null;
function leerEquivalencias_() {
  if (EQUIV_) return EQUIV_;
  const out = EQUIV_ = {};
  filasCentral_(SHEET_EQUIV).forEach(function (r) {
    const k = norm_(r[0]), v = String(r[1] || "").trim();
    if (!k || !v) return;
    if (norm_(v) === norm_(NO_ES_STOCK)) { out[k] = NO_ES_STOCK; return; }
    if (out[k] === NO_ES_STOCK) return;
    (out[k] = out[k] || []).push(v);
  });
  return out;
}

// "750 cc" → 0.75 (litros); "5 kg" → 5 (kilos).
function medidaContenido_(cont) {
  const m = String(cont || "").trim().toLowerCase().replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*([a-z]*)/);
  if (!m) return null;
  const n = Number(m[1]), u = m[2];
  if (!(n > 0)) return null;
  if (["cc", "ml", "cm"].indexOf(u) >= 0) return { v: n / 1000, u: "l" };
  if (["l", "lt", "lts", "litro", "litros"].indexOf(u) >= 0) return { v: n, u: "l" };
  if (["g", "gr", "grs", "gramo", "gramos"].indexOf(u) >= 0) return { v: n / 1000, u: "kg" };
  if (["kg", "kgs", "kilo", "kilos"].indexOf(u) >= 0) return { v: n, u: "kg" };
  if (!u) return n >= 50 ? { v: n / 1000, u: "l" } : { v: n, u: "l" };
  return null;
}

// Si la compra es por litro (o kilo) y el producto se cuenta en botellas
// (o unidades), el precio de cada una es precio por litro × lo que trae.
function precioPorUnidad_(p, prod) {
  const med = norm_(p.medida);
  const porLitro = /^lit/.test(med), porKilo = /^kilo/.test(med);
  if (!porLitro && !porKilo) return p.precio;
  if (/litro|kilo|gramo/i.test(prod.unidad || "")) return p.precio;
  const c = medidaContenido_(prod.contenido);
  if (!c || (porLitro && c.u !== "l") || (porKilo && c.u !== "kg")) return p.precio;
  return Math.round(p.precio * c.v * 100) / 100;
}

// Para cada producto de Barra del catalogo del bar: el costo de la ultima
// compra, sus proveedores (el mas reciente primero) y el ultimo costo de
// cada uno.
// Se busca por codigo (en las hojas de compras donde figura ese bar: los
// codigos son de ese Cuccina) y si no, por nombre o por Equivalencias.
function preciosDelCatalogo_(barNombre, catalogo) {
  const eq = leerEquivalencias_();
  const nb = norm_(barNombre);
  const porNom = {}, porCod = {}, suyas = {};
  const precios = leerPrecios_();
  precios.forEach(function (p) { if (p.bares.indexOf(nb) >= 0 || norm_(p.origen) === nb) suyas[norm_(p.origen)] = true; });
  precios.forEach(function (p) {
    if (p.codigo && suyas[norm_(p.origen)]) (porCod[p.codigo] = porCod[p.codigo] || []).push(p);
    const k = norm_(p.nombre);
    if (eq[k] === NO_ES_STOCK) return;
    const keys = [k];
    (eq[k] || []).forEach(function (v) { if (keys.indexOf(norm_(v)) < 0) keys.push(norm_(v)); });
    keys.forEach(function (x) { (porNom[x] = porNom[x] || []).push(p); });
  });
  const out = {};
  catalogo.forEach(function (prod) {
    // De las compras se toman solo bebidas: lo de Cocina no lleva precio.
    if (prod.categoria !== "Barra") { out[prod.nombre] = { costo: null, proveedores: [], porProveedor: {} }; return; }
    let hits = ((prod.codigo && porCod[prod.codigo]) || porNom[norm_(prod.nombre)] || []).slice()
      .sort(function (a, b) { return b.fecha - a.fecha; });
    // Si hay compras con proveedor, no se mezclan las que no lo traen.
    if (hits.some(function (h) { return h.proveedor && h.proveedor !== "Sin proveedor"; })) {
      hits = hits.filter(function (h) { return h.proveedor && h.proveedor !== "Sin proveedor"; });
    }
    const porProveedor = {}, provs = [];
    hits.forEach(function (h) {
      const v = h.proveedor || "Sin proveedor";
      if (provs.indexOf(v) < 0) { provs.push(v); porProveedor[v] = precioPorUnidad_(h, prod); }
    });
    out[prod.nombre] = { costo: provs.length ? porProveedor[provs[0]] : null, proveedores: provs, porProveedor: porProveedor };
  });
  return out;
}

// Precios y "nuevos en las compras" de un bar, guardados en la memoria
// rapida. Se vuelven a calcular si cambia el catalogo, las compras o las
// Equivalencias.
function preciosDelBar_(bar, catalogo, conNuevos) {
  const huella = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
    JSON.stringify(catalogo.map(function (p) { return [p.nombre, p.codigo, p.unidad, p.contenido, p.familia]; })), Utilities.Charset.UTF_8));
  const k = "pr|" + versionPrecios_() + "|" + huella + "|" + norm_(bar.nombre).slice(0, 60);
  let v = cacheGet_(k);
  if (!v || !v.precios || (conNuevos && !Array.isArray(v.nuevos))) {
    v = { precios: preciosDelCatalogo_(bar.nombre, catalogo), nuevos: conNuevos ? comprasNuevas_(bar.nombre, catalogo) : null };
    cachePut_(k, v, CACHE_PRECIOS_SEG);
  }
  return v;
}

// Vinos: en Cuccina se compran por unidad (las bebidas de corte, por litro)
// y vienen de bodegas o distribuidoras de vino, o tienen la cepa en el
// nombre.
const CEPAS_ = /malbec|cabernet|cab\.? ?(franc|sauv)|merlot|pinot|chardonnay|torront|syrah|bonarda|sauvignon|semillon|garnacha|tannat|sangiovese|criolla|blend|claret|moscatel|gewurz|zinfandel|botrytis|\brose\b|rosado|tinto|blanco|brut|espumante|champa|naranjo|\bvino/i;
const PROV_VINO_ = /vino|wine|vitis|cinco rios|vocacion|casta 1994|rocamadre|finca suarez|gredal|bodega/i;
function esVino_(p) {
  return /^unid/i.test(norm_(p.medida)) && (CEPAS_.test(norm_(p.nombre)) || PROV_VINO_.test(norm_(p.proveedor)));
}

// Lo de barra que aparece en las compras de este bar y no esta en su
// catalogo ni en Equivalencias: para que el administrador diga que es.
// Si el bar no cuenta vinos (no tiene ninguna familia de vinos en el
// catalogo, como Hugo), los vinos no aparecen.
function comprasNuevas_(barNombre, catalogo) {
  const eq = leerEquivalencias_();
  const nb = norm_(barNombre);
  const enCatalogo = {}, codigos = {};
  catalogo.forEach(function (p) { enCatalogo[norm_(p.nombre)] = true; if (p.codigo) codigos[p.codigo] = true; });
  const cuentaVinos = catalogo.some(function (p) { return /vino/i.test(norm_(p.familia)); });
  const ult = {};
  leerPrecios_().forEach(function (p) {
    const delBar = norm_(p.origen) === nb || p.bares.indexOf(nb) >= 0;
    if (!delBar) return;
    // Solo bebidas: en los reportes con Familia, la de barra.
    if (p.familia ? !/barra/i.test(p.familia) : norm_(p.origen) !== nb) return;
    if (!cuentaVinos && esVino_(p)) return;
    const k = norm_(p.nombre);
    if (enCatalogo[k] || eq[k] || (p.codigo && codigos[p.codigo])) return;
    if (!ult[k] || p.fecha >= ult[k].fecha) ult[k] = p;
  });
  return Object.keys(ult).map(function (k) { return { nombre: ult[k].nombre, proveedor: ult[k].proveedor, costo: ult[k].precio }; })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
}

// Para dar los permisos que pide el codigo (se corre a mano desde el
// editor, una vez, despues de pegar una version nueva).
function autorizar() {
  central_().getName();
  CacheService.getScriptCache().get("pb");
  return "Listo";
}

// Menu en la planilla central.
function onOpen() {
  hojaCentral_(SHEET_BARES, BARES_HEADERS);
  hojaCentral_(SHEET_PERSONAS, PERSONAS_HEADERS);
  hojaCentral_(SHEET_EQUIV, EQUIV_HEADERS);
  hojaPedidosCentral_();
  SpreadsheetApp.getUi().createMenu("Stock bares")
    .addItem("Armar links de instalación", "armarLinks")
    .addItem("Cargar compras (Excel de Cuccina)", "cargarComprasVentana")
    .addItem("Recalcular precios", "recalcularPrecios")
    .addItem("Cambiar la dirección del código", "cambiarDireccion")
    .addToUi();
}

// ------------------------------------------------------------
// Cargar compras: se elige el Excel de Cuccina y a que hoja "Compras ..."
// va. Lo nuevo se agrega abajo sin repetir renglones (asi no se pierden
// los precios de lo que este mes no se compro); vale siempre lo mas nuevo.
// ------------------------------------------------------------
function cargarComprasVentana() {
  const destinos = hojasCompras_().map(function (sh) { return sh.getName().replace(/^compras\s*/i, ""); }).filter(String);
  ["Archie", "Hugo", "Felicidad e Industrias"].forEach(function (d) {
    if (!destinos.some(function (x) { return norm_(x) === norm_(d); })) destinos.push(d);
  });
  // Los que no son un bar (Felicidad e Industrias) comparten un reporte que
  // no trae proveedor: piden tambien el reporte desglosado por proveedor.
  const bares = leerBares_();
  const lista = destinos.map(function (d) {
    return { nombre: d, compartido: !bares.some(function (b) { return norm_(b.nombre) === norm_(d); }) };
  });
  const html = HtmlService.createHtmlOutput(VENTANA_COMPRAS.replace("__DESTINOS__", JSON.stringify(lista)))
    .setWidth(480).setHeight(580);
  SpreadsheetApp.getUi().showModalDialog(html, "Cargar compras");
}

// Recibe los renglones de los Excel (con la fila de titulos) y los pasa a
// la hoja "Compras <destino>" y, si viene el reporte por proveedor, a la
// hoja "Proveedores <destino>". Despues rearma la hoja Precios.
function cargarCompras(destino, filas, reemplazar, filasProv) {
  destino = String(destino || "").trim();
  if (!destino) throw new Error("Elegí a qué bar van las compras.");
  const hayCompras = Array.isArray(filas) && filas.length > 0, hayProv = Array.isArray(filasProv) && filasProv.length > 0;
  if (!hayCompras && !hayProv) throw new Error("Elegí el Excel de las compras.");
  const bares = leerBares_().map(function (b) { return b.nombre; });
  const compras = hayCompras ? prepararReporte_(filas) : null;
  const prov = hayProv ? prepararReporte_(filasProv) : null;
  // Que no esten al reves: el de compras trae las fechas (de ahi sale el
  // precio); el otro, los proveedores.
  if (compras) {
    const t = tipoReporte_(compras, bares);
    if (!t.fechas && t.proveedores) {
      throw new Error("Ese Excel parece el reporte por proveedor (no trae fechas). Arriba va el reporte por bar, el que trae las fechas" +
        (prov ? ", y abajo el de proveedores." : "."));
    }
  }
  if (prov && !tipoReporte_(prov, bares).proveedores) {
    throw new Error("El segundo Excel no trae proveedores. Abajo va el reporte desglosado por proveedor.");
  }
  const r = compras ? pegarReporte_("Compras " + destino, compras, reemplazar) : { hoja: "Compras " + destino, agregados: 0, repetidos: 0 };
  r.proveedores = prov ? pegarReporte_("Proveedores " + destino, prov, reemplazar) : null;
  r.precios = reconstruirPrecios_();
  return r;
}

// Deja los renglones de un Excel parejos y saca lo que haya arriba de la
// fila de titulos (el reporte de Felicidad e Industrias trae dos renglones
// de titulo).
function prepararReporte_(filas) {
  if (filas.length < 2) throw new Error("El Excel no tiene renglones.");
  const ancho = Math.max.apply(null, filas.map(function (r) { return r.length; }));
  const datos = filas.map(function (r) {
    const fila = [];
    for (let j = 0; j < ancho; j++) {
      let v = r[j] === undefined || r[j] === null ? "" : r[j];
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const p = v.split("-");
        v = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      }
      fila.push(v);
    }
    return fila;
  });
  let fila0 = -1;
  for (let i = 0; i < Math.min(datos.length, 15); i++) if (columnasCompras_(datos[i])) { fila0 = i; break; }
  if (fila0 < 0) {
    throw new Error("No encuentro la columna Descripción (o Denominación) en los títulos de esa hoja. ¿Es el reporte de compras?");
  }
  datos.splice(0, fila0);
  return datos;
}

// Que trae un reporte: fechas, proveedores.
function tipoReporte_(datos, nombresBares) {
  const bares = {};
  nombresBares.forEach(function (b) { bares[norm_(b)] = b; });
  const c = columnasCompras_(datos[0]);
  const roles = rolesGrupos_(datos, 0, c, bares);
  return { fechas: c.fecha >= 0 || roles.indexOf("fecha") >= 0, proveedores: c.prov >= 0 || roles.indexOf("prov") >= 0 };
}

// Pasa el reporte a esa hoja de la planilla central: lo agrega abajo sin
// repetir renglones (o borra lo que habia, si se pide).
function pegarReporte_(nombre, datos, reemplazar) {
  const ancho = datos[0].length;
  let sh = central_().getSheets().filter(function (h) { return norm_(h.getName()) === norm_(nombre); })[0];
  if (!sh) sh = central_().insertSheet(nombre);
  const clave = function (r) {
    return r.map(function (v) { return isDate_(v) ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(v).trim(); }).join("|");
  };
  let agregar = datos, repetidos = 0, desde = 1;
  if (reemplazar) {
    sh.clear();
  } else {
    const hay = sh.getDataRange().getValues();
    desde = hay.length === 1 && hay[0].every(function (v) { return v === ""; }) ? 1 : hay.length + 1;
    if (desde > 1) {
      const ya = {};
      hay.forEach(function (r) { ya[clave(r.slice(0, ancho))] = true; });
      agregar = datos.slice(1).filter(function (r) {
        const k = clave(r);
        if (ya[k]) { repetidos++; return false; }
        ya[k] = true;
        return true;
      });
      // Lo nuevo va siempre con sus titulos arriba: aunque sean iguales a
      // los de antes, cada reporte se lee aparte (en uno la columna GRUPO2
      // puede traer fechas y en otro, bares o proveedores).
      if (agregar.length) agregar.unshift(datos[0]);
    }
  }
  if (agregar.length) {
    lugar_(sh, desde + agregar.length - 1, ancho);
    sh.getRange(desde, 1, agregar.length, ancho).setValues(agregar);
  }
  if (desde === 1) sh.setFrozenRows(1);
  const nuevos = agregar.length ? agregar.length - 1 : 0;
  return { hoja: sh.getName(), agregados: nuevos, repetidos: repetidos };
}

// Google no deja escribir fuera de los renglones y columnas que tiene la
// hoja: si hace falta, se agregan.
function lugar_(sh, filas, columnas) {
  const mr = sh.getMaxRows();
  if (mr < filas) sh.insertRowsAfter(mr, filas - mr);
  if (columnas) {
    const mc = sh.getMaxColumns();
    if (mc < columnas) sh.insertColumnsAfter(mc, columnas - mc);
  }
}

const VENTANA_COMPRAS = '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_top">' +
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>' +
  '<style>body{font-family:Arial,sans-serif;font-size:14px;color:#2B2024}label{display:block;font-weight:bold;margin:12px 0 4px}' +
  'label small{display:block;font-weight:normal;color:#6E6166;margin-top:2px}' +
  'select,input[type=file]{width:100%;padding:6px;font-size:14px}#msg{margin-top:12px;line-height:1.4}' +
  'button{margin-top:16px;padding:10px 18px;font-size:15px;font-weight:bold;background:#7A2E3E;color:#fff;border:0;border-radius:8px;cursor:pointer}' +
  'button:disabled{opacity:.5}.chk{font-weight:normal;margin-top:12px}.err{color:#A33A2A}.ok{color:#2F6B45}' +
  '.caja{border:1px solid #E0D8CF;border-radius:8px;padding:2px 10px 10px;margin-top:10px}</style></head><body>' +
  '<label>¿De qué bar son las compras?</label><select id="destino"></select>' +
  '<div class="caja"><label id="l1">Excel de Cuccina</label><input type="file" id="archivo" accept=".xlsx,.xls,.csv">' +
  '<label id="lhoja" style="display:none">Hoja del Excel</label><select id="hoja" style="display:none"></select></div>' +
  '<div class="caja" id="caja2" style="display:none"><label>2. Reporte por proveedor<small>Solo para saber a quién se le compra cada producto (el precio sale del de arriba).</small></label>' +
  '<input type="file" id="archivo2" accept=".xlsx,.xls,.csv">' +
  '<label id="lhoja2" style="display:none">Hoja del Excel</label><select id="hoja2" style="display:none"></select></div>' +
  '<label class="chk"><input type="checkbox" id="reemplazar"> Borrar lo que había antes (si no, se agrega lo nuevo sin repetir)</label>' +
  '<button id="cargar" disabled>Cargar</button><div id="msg"></div>' +
  '<script>' +
  'var DEST=__DESTINOS__;var libros=[null,null];var d=document.getElementById("destino");' +
  'DEST.forEach(function(x){var o=document.createElement("option");o.value=o.textContent=x.nombre;d.appendChild(o);});' +
  'function compartido(){var x=DEST.filter(function(y){return y.nombre===d.value;})[0];return !!(x&&x.compartido);}' +
  'function msg(t,c){var m=document.getElementById("msg");m.className=c||"";m.textContent=t;}' +
  'function listo(){document.getElementById("cargar").disabled=!(libros[0]||(compartido()&&libros[1]));}' +
  'function verDestino(){var c=compartido();document.getElementById("caja2").style.display=c?"block":"none";' +
  'document.getElementById("l1").innerHTML=c?"1. Reporte por bar<small>El que trae las fechas: de ahí sale el precio.</small>":"Excel de Cuccina";if(!c)libros[1]=null;listo();}' +
  'd.addEventListener("change",verDestino);verDestino();' +
  'function fecha(v){function p(n){return(n<10?"0":"")+n;}return v.getFullYear()+"-"+p(v.getMonth()+1)+"-"+p(v.getDate());}' +
  'function leer(n,inp,sel,lab,pref){document.getElementById(inp).addEventListener("change",function(e){var f=e.target.files[0];if(!f)return;' +
  'if(typeof XLSX==="undefined"){msg("No se pudo cargar el lector de Excel. Revisá la conexión y volvé a abrir esta ventana.","err");return;}' +
  'msg("Leyendo el Excel…");var r=new FileReader();r.onload=function(){var libro;try{libro=XLSX.read(new Uint8Array(r.result),{type:"array",cellDates:true});}' +
  'catch(err){msg("No pude leer ese archivo: "+err.message,"err");return;}' +
  'var h=document.getElementById(sel);h.innerHTML="";var elegida=libro.SheetNames[0];' +
  'libro.SheetNames.forEach(function(x){var o=document.createElement("option");o.value=o.textContent=x;h.appendChild(o);});' +
  'var dep=libro.SheetNames.filter(function(x){return pref.test(x);})[0];' +
  'if(dep)elegida=dep;h.value=elegida;var ver=libro.SheetNames.length>1;h.style.display=ver?"block":"none";document.getElementById(lab).style.display=ver?"block":"none";' +
  'libros[n]=libro;listo();msg("Listo para cargar.");e.target.value="";};r.readAsArrayBuffer(f);});}' +
  'leer(0,"archivo","hoja","lhoja",/depurad|^compras/i);leer(1,"archivo2","hoja2","lhoja2",/prove/i);' +
  'function filasDe(n,sel){var libro=libros[n];if(!libro)return null;var hoja=libro.Sheets[document.getElementById(sel).value];' +
  'return XLSX.utils.sheet_to_json(hoja,{header:1,raw:true,defval:""}).map(function(r){return r.map(function(v){return v instanceof Date?fecha(v):v;});})' +
  '.filter(function(r){return r.some(function(v){return v!=="";});});}' +
  'document.getElementById("cargar").addEventListener("click",function(){' +
  'var f1=filasDe(0,"hoja"),f2=compartido()?filasDe(1,"hoja2"):null;if(!f1&&!f2)return;' +
  'var b=this;b.disabled=true;msg("Cargando "+((f1?f1.length-1:0)+(f2?f2.length-1:0))+" renglones…");' +
  'google.script.run.withSuccessHandler(function(res){libros=[null,null];listo();' +
  'var t="Listo: "+res.agregados+" renglones nuevos en la hoja «"+res.hoja+"»"+(res.repetidos?" ("+res.repetidos+" ya estaban y no se repitieron)":"");' +
  'if(res.proveedores)t+=" y "+res.proveedores.agregados+" en «"+res.proveedores.hoja+"»"+(res.proveedores.repetidos?" ("+res.proveedores.repetidos+" ya estaban)":"");' +
  'msg(t+". La hoja «Precios» quedó con "+res.precios+" precios y la app ya los toma.","ok");})' +
  '.withFailureHandler(function(err){b.disabled=false;msg("No se cargó: "+err.message,"err");})' +
  '.cargarCompras(d.value,f1,document.getElementById("reemplazar").checked,f2);});' +
  '</script></body></html>';

// La direccion /exec de la implementacion activa. No se adivina (Google a
// veces devuelve la de una implementacion vieja): se pega una vez y queda
// guardada en la hoja "Ajustes" (celda B1).
const SHEET_AJUSTES = "Ajustes";
function esDireccion_(u) { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(u || "").trim()); }
function hojaAjustes_() {
  const sh = hojaCentral_(SHEET_AJUSTES, null);
  if (String(sh.getRange(1, 1).getValue()) === "") sh.getRange(1, 1).setValue("Dirección del código (termina en /exec)");
  return sh;
}
function direccion_() {
  const u = String(hojaAjustes_().getRange(1, 2).getValue() || "").trim();
  return esDireccion_(u) ? u : "";
}
function pedirDireccion_() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("Dirección del código",
    "En Apps Script: Implementar > Gestionar implementaciones > copiá la URL de la aplicación web (termina en /exec) y pegala acá.",
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return "";
  const u = String(r.getResponseText() || "").trim();
  if (!esDireccion_(u)) { ui.alert("Esa dirección no sirve: tiene que empezar con https://script.google.com/macros/s/ y terminar en /exec."); return ""; }
  hojaAjustes_().getRange(1, 2).setValue(u);
  return u;
}
function cambiarDireccion() {
  if (pedirDireccion_()) armarLinks();
}

// Le da una clave a quien no tiene y escribe (o corrige) el link de
// instalacion de cada uno con la direccion guardada en Ajustes.
function armarLinks() {
  const url = direccion_() || pedirDireccion_();
  if (!url) return;
  const sh = hojaCentral_(SHEET_PERSONAS, PERSONAS_HEADERS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === "") continue;
    let clave = String(data[i][3] || "").trim();
    // Empieza con letra para que la planilla nunca la tome como numero.
    if (!clave) clave = "k" + Utilities.getUuid().replace(/-/g, "").slice(0, 19);
    sh.getRange(i + 1, 4, 1, 2).setValues([[clave, APP_URL + "#central=" + url + "&clave=" + clave]]);
  }
  cacheBorrar_(["pb"]);
}

// ------------------------------------------------------------
// Planilla de cada bar (SS)
// ------------------------------------------------------------
function getSheet_(name, headers) {
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function readRows_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1);
}

function isDate_(v) { return Object.prototype.toString.call(v) === "[object Date]"; }

function formatDate_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v);
}

function formatDateTime_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  return String(v);
}

const CAT_VIEJAS = { "Bebidas": "Barra", "Comida": "Cocina" };
function cat_(v) { const c = String(v || "Barra"); return CAT_VIEJAS[c] || c; }

function num_(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function readConteos_() { return conteosDeFilas_(readRows_(SHEET_CONTEOS)); }
function conteosDeFilas_(filas) {
  return filas.filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return {
      id: String(r[0]), fecha: formatDate_(r[1]), categoria: cat_(r[2]), grupo: String(r[3] || ""),
      producto: String(r[4]), cantidad: num_(r[5]), unidad: String(r[6] || ""), persona: String(r[7] || ""),
      nota: String(r[8] || ""), cargado: formatDateTime_(r[9]), carga: String(r[10] || r[0])
    };
  });
}

function readCatalogo_() {
  const sh = ss_().getSheetByName(SHEET_CATALOGO);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  completarTitulosCatalogo_(sh, data[0] || []);
  return data.slice(1).filter(function (r) { return String(r[0]).trim() !== ""; }).map(function (r) {
    const txt = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    return {
      nombre: txt(r[0]),
      categoria: cat_(txt(r[1])),
      grupo: /^top\s*10$/i.test(txt(r[2])) ? "Top 10" : "Resto",
      unidad: txt(r[3]),
      familia: txt(r[4]),
      contenido: txt(r[5]),
      // Columna 7 (opcional): el codigo de Cuccina, para buscar el precio.
      codigo: txt(r[6])
    };
  });
}

// Agrega los titulos que falten en Catalogo (sin tocar ningun dato ni
// los titulos que ya estan escritos). fila = la primera fila, ya leida.
function completarTitulosCatalogo_(sh, fila) {
  const n = CATALOGO_HEADERS.length;
  const faltan = [];
  for (let i = 0; i < n; i++) if (String(fila[i] === undefined || fila[i] === null ? "" : fila[i]).trim() === "") faltan.push(i);
  if (!faltan.length) return;
  lugar_(sh, 1, n);
  faltan.forEach(function (i) { sh.getRange(1, i + 1).setValue(CATALOGO_HEADERS[i]).setFontWeight("bold"); });
}
function ensureCatalogoHeaders_() {
  const sh = ss_().getSheetByName(SHEET_CATALOGO);
  if (!sh) return;
  completarTitulosCatalogo_(sh, sh.getDataRange().getValues()[0] || []);
}

function readCierres_() {
  return readRows_(SHEET_CIERRES).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return { fecha: formatDate_(r[0]), persona: String(r[1] || ""), cuando: formatDateTime_(r[2]) };
  });
}

function fechasCerradas_(cierres) {
  const out = {};
  (cierres || readCierres_()).forEach(function (c) { out[c.fecha] = true; });
  return out;
}

// ------------------------------------------------------------
// Pedidos: todos van a la hoja "Pedidos" de la planilla central, un renglon
// por producto, con una columna Estado (En espera / Recibido / Cancelado)
// que pinta el renglon de amarillo, verde o rojo. Tiene filtro puesto.
// ------------------------------------------------------------
const PEDIDOS_CENTRAL_HEADERS = ["Fecha", "Bar", "Pedido", "Categoría", "Proveedor", "Producto", "Cantidad", "Unidad",
  "Precio", "Subtotal", "Persona", "Nota", "Cargado", "Estado", "ID"];
const ESTADOS = ["En espera", "Recibido", "Cancelado"];
const COL_ESTADO = 14, COL_ID = 15;

function hojaPedidosCentral_() {
  const c = central_();
  let sh = c.getSheetByName(SHEET_PEDIDOS);
  if (sh) return sh;
  sh = c.insertSheet(SHEET_PEDIDOS);
  const n = PEDIDOS_CENTRAL_HEADERS.length;
  sh.getRange(1, 1, 1, n).setValues([PEDIDOS_CENTRAL_HEADERS]).setFontWeight("bold");
  sh.setFrozenRows(1);
  if (sh.getMaxRows() < 3000) sh.insertRowsAfter(sh.getMaxRows(), 3000 - sh.getMaxRows());
  const filas = sh.getMaxRows() - 1;
  sh.getRange(2, COL_ESTADO, filas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build());
  const todo = sh.getRange(2, 1, filas, n);
  const regla = function (estado, color) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$N2="' + estado + '"')
      .setBackground(color).setRanges([todo]).build();
  };
  sh.setConditionalFormatRules([regla("Recibido", "#D9EAD3"), regla("Cancelado", "#F4CCCC"), regla("En espera", "#FFF2CC")]);
  sh.getRange(1, 1, sh.getMaxRows(), n).createFilter();
  return sh;
}

function filaPedidoCentral_(p, bar) {
  return [p.fecha, bar, p.pedido || p.id, p.categoria || "", p.proveedor || "", p.producto, p.cantidad,
    p.unidad || "", p.precio === null || p.precio === undefined ? "" : p.precio,
    p.subtotal === null || p.subtotal === undefined ? "" : p.subtotal, p.persona || "", p.nota || "", p.cargado || "",
    "En espera", p.id];
}

// Los pedidos de un bar: los de la central y, si quedaron, los viejos de la
// planilla del bar.
function readPedidosDelBar_(barNombre) {
  const out = [], vistos = {};
  const sh = central_().getSheetByName(SHEET_PEDIDOS);
  if (sh) {
    const nb = norm_(barNombre);
    sh.getDataRange().getValues().slice(1)
      .filter(function (r) { return r.length >= COL_ID && String(r[COL_ID - 1]) !== "" && norm_(r[1]) === nb; })
      .slice(-PEDIDOS_A_LA_APP).forEach(function (r) {
        vistos[String(r[COL_ID - 1])] = true;
        out.push({
          id: String(r[COL_ID - 1]), fecha: formatDate_(r[0]), pedido: String(r[2] || r[COL_ID - 1]), categoria: cat_(r[3]),
          proveedor: String(r[4] || ""), producto: String(r[5]), cantidad: num_(r[6]), unidad: String(r[7] || ""),
          precio: r[8] === "" ? null : num_(r[8]), subtotal: r[9] === "" ? null : num_(r[9]),
          persona: String(r[10] || ""), nota: String(r[11] || ""), cargado: formatDateTime_(r[12]),
          estado: String(r[COL_ESTADO - 1] || "En espera")
        });
      });
  }
  readPedidos_().forEach(function (p) { if (!vistos[p.id]) out.push(p); });
  return out;
}

function readPedidos_() {
  const rows = readRows_(SHEET_PEDIDOS).filter(function (r) { return r[0] !== ""; });
  return rows.slice(-PEDIDOS_A_LA_APP).map(function (r) {
    return {
      id: String(r[0]), fecha: formatDate_(r[1]), pedido: String(r[2] || r[0]), categoria: cat_(r[3]),
      proveedor: String(r[4] || ""), producto: String(r[5]), cantidad: num_(r[6]), unidad: String(r[7] || ""),
      precio: r[8] === "" ? null : num_(r[8]), subtotal: r[9] === "" ? null : num_(r[9]),
      persona: String(r[10] || ""), nota: String(r[11] || ""), cargado: formatDateTime_(r[12])
    };
  });
}

function pedidoToRow_(p) {
  return [p.id, p.fecha, p.pedido || p.id, p.categoria || "", p.proveedor || "", p.producto, p.cantidad,
    p.unidad || "", p.precio === null || p.precio === undefined ? "" : p.precio,
    p.subtotal === null || p.subtotal === undefined ? "" : p.subtotal, p.persona || "", p.nota || "", p.cargado || ""];
}

function ahora_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

// Las dos listas de Config (unidades y cantidades) en una sola lectura.
function readListas_() {
  const out = { unidades: [], cantidades: [] };
  readRows_(SHEET_CONFIG).forEach(function (r) {
    const t = String(r[0]);
    if (out[t] && r[1] !== "") out[t].push(String(r[1]));
  });
  Object.keys(out).forEach(function (t) { if (!out[t].length) out[t] = (DEFAULT_CONFIG[t] || []).slice(); });
  return out;
}

function readLista_(tipo) {
  const out = [];
  readRows_(SHEET_CONFIG).forEach(function (r) {
    if (String(r[0]) === tipo && r[1] !== "") out.push(String(r[1]));
  });
  return out.length ? out : (DEFAULT_CONFIG[tipo] || []);
}

function ensureLista_(tipo) {
  const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
  const tiene = readRows_(SHEET_CONFIG).some(function (r) { return String(r[0]) === tipo; });
  if (!tiene) (DEFAULT_CONFIG[tipo] || []).forEach(function (v) { sh.appendRow([tipo, v]); });
  return sh;
}

function deleteRowsWhere_(sh, col, value) {
  deleteRowsIf_(sh, function (r) { return String(r[col]) === String(value); });
}

function deleteRowsDeFecha_(sh, col, fecha) {
  deleteRowsIf_(sh, function (r) { return formatDate_(r[col]) === String(fecha); });
}

function deleteRowsIf_(sh, pasa) {
  const data = sh.getDataRange().getValues();
  let i = data.length - 1;
  while (i >= 1) {
    if (pasa(data[i])) {
      let start = i;
      while (start - 1 >= 1 && pasa(data[start - 1])) start--;
      sh.deleteRows(start + 1, i - start + 1);
      i = start - 1;
    } else {
      i--;
    }
  }
}

function conteoToRow_(c) {
  return [c.id, c.fecha, c.categoria || "", c.grupo || "", c.producto, c.cantidad,
    c.unidad || "", c.persona || "", c.nota || "", c.cargado || "", c.carga || c.id];
}

// Arma la hoja Resumen del bar (igual que antes). Si ya se leyeron los
// Conteos o los Cierres, se pasan para no leerlos de nuevo.
function rebuildResumen_(conteos, cierres) {
  conteos = conteos || readConteos_();
  const catalogo = readCatalogo_();
  const fechas = [];
  const valor = {};
  const cuando = {};
  conteos.forEach(function (c) {
    if (fechas.indexOf(c.fecha) < 0) fechas.push(c.fecha);
    const k = c.producto + "|" + c.fecha;
    if (!(k in cuando) || String(c.cargado) >= String(cuando[k])) { cuando[k] = c.cargado; valor[k] = c.cantidad; }
  });
  fechas.sort().reverse();
  const cols = fechas.slice(0, RESUMEN_FECHAS);

  const productos = catalogo.map(function (p) { return p; });
  const enLista = {};
  productos.forEach(function (p) { enLista[p.nombre] = true; });
  conteos.forEach(function (c) {
    if (!enLista[c.producto]) {
      enLista[c.producto] = true;
      productos.push({ nombre: c.producto, categoria: c.categoria, grupo: "", unidad: c.unidad, familia: "", contenido: "" });
    }
  });
  const ordenCat = function (c) { return c === "Barra" ? 0 : c === "Cocina" ? 1 : 2; };
  const famOrden = {};
  productos.forEach(function (p, i) {
    const k = p.categoria + "|" + (p.familia || "");
    if (!(k in famOrden)) famOrden[k] = i;
    p._i = i;
  });
  productos.sort(function (a, b) {
    return ordenCat(a.categoria) - ordenCat(b.categoria) ||
      famOrden[a.categoria + "|" + (a.familia || "")] - famOrden[b.categoria + "|" + (b.familia || "")] ||
      a._i - b._i;
  });

  const anterior = function (nombre, i) {
    for (let j = i + 1; j < fechas.length; j++) {
      const k = nombre + "|" + fechas[j];
      if (k in valor) return valor[k];
    }
    return null;
  };

  const cerradas = fechasCerradas_(cierres);
  const FIJAS = 6;
  const header = ["Categoría", "Familia", "Top 10", "Producto", "Contenido", "Unidad"];
  cols.forEach(function (f) {
    const p = f.split("-");
    header.push((p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : f) + (cerradas[f] ? " (cerrado)" : ""));
    header.push("Dif.");
  });
  const rows = [header];
  const fondos = [header.map(function (h, i) { return i >= FIJAS && h === "Dif." ? "#EEEAE5" : "#FFFFFF"; })];
  const letras = [header.map(function () { return "#000000"; })];
  const negritas = [header.map(function () { return "bold"; })];
  productos.forEach(function (p) {
    const row = [p.categoria, p.familia || "", p.grupo === "Top 10" ? "Sí" : "", p.nombre, p.contenido || "", p.unidad];
    const fondo = row.map(function () { return "#FFFFFF"; });
    const letra = row.map(function () { return "#000000"; });
    const negrita = row.map(function () { return "normal"; });
    cols.forEach(function (f, i) {
      const k = p.nombre + "|" + f;
      const hay = k in valor ? valor[k] : null;
      const antes = hay === null ? null : anterior(p.nombre, i);
      row.push(hay === null ? "" : hay);
      fondo.push("#FFFFFF"); letra.push("#000000"); negrita.push("normal");
      if (hay === null || antes === null) {
        row.push(""); fondo.push("#F7F5F2"); letra.push("#000000"); negrita.push("normal");
        return;
      }
      const dif = Math.round((hay - antes) * 100) / 100;
      const fuerte = dif < 0 && (antes > 0 ? -dif / antes > BAJA_FUERTE : true);
      row.push(dif);
      fondo.push(fuerte ? "#F6D5CF" : "#F7F5F2");
      letra.push(dif < 0 ? "#A33A2A" : dif > 0 ? "#2F6B45" : "#6E6166");
      negrita.push(fuerte ? "bold" : "normal");
    });
    rows.push(row); fondos.push(fondo); letras.push(letra); negritas.push(negrita);
  });

  let sh = ss_().getSheetByName(SHEET_RESUMEN);
  if (!sh) sh = ss_().insertSheet(SHEET_RESUMEN);
  sh.clear();
  // Una hoja nueva tiene 26 columnas: con mas de 10 fechas no entraba.
  lugar_(sh, rows.length, header.length);
  const rango = sh.getRange(1, 1, rows.length, header.length);
  rango.setValues(rows);
  rango.setBackgrounds(fondos);
  rango.setFontColors(letras);
  rango.setFontWeights(negritas);
  // Las columnas "Dif." con signo (+2 / -3), todas de una vez.
  const difs = [];
  for (let c = FIJAS + 2; c <= header.length; c += 2) difs.push(colLetra_(c) + "2:" + colLetra_(c) + rows.length);
  if (rows.length > 1 && difs.length) sh.getRangeList(difs).setNumberFormat("+0.##;-0.##;0");
  sh.setFrozenRows(1);
  sh.setFrozenColumns(4);
}

// 1 → A, 27 → AA.
function colLetra_(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// El bar pedido, si esa persona puede entrar (si no lo encuentra en la
// memoria rapida, mira la planilla: puede ser un permiso recien dado).
function barPermitido_(yo, barNombre) {
  const buscar = function (q) { return q.baresPermitidos.filter(function (b) { return b.nombre === String(barNombre); })[0]; };
  let bar = buscar(yo);
  if (!bar && !yo.fresco) {
    const otra = quien_(yo.clave, true);
    if (otra) { bar = buscar(otra); if (bar) yo.baresPermitidos = otra.baresPermitidos; }
  }
  return bar || null;
}

// Abre la planilla del bar pedido, si esa persona puede entrar.
function abrirBar_(yo, barNombre) {
  const bar = barPermitido_(yo, barNombre);
  if (!bar) return null;
  SS = SpreadsheetApp.openById(bar.id);
  return bar;
}

// Lo leido en un pedido anterior no sirve para este.
function olvidar_() { PB_ = null; PRECIOS_ = null; EQUIV_ = null; SS = null; CACHE_LEIDO_ = {}; }

function doGet(e) {
  olvidar_();
  cachePrecargar_(["pb", "pv"]);
  try {
    return doGet_(e);
  } catch (err) {
    // Que la app pueda mostrar el motivo en vez de "sin conexion".
    return jsonOut_({ error: "servidor", detalle: String(err && err.message || err) });
  }
}

function doGet_(e) {
  const p = (e && e.parameter) || {};
  const yo = quien_(p.clave);
  if (!yo) return jsonOut_({ error: "clave" });
  const quienSoy = { persona: yo.persona, rol: yo.rol, bares: yo.baresPermitidos.map(function (b) { return b.nombre; }) };
  const action = p.action || "get_all";
  if (action === "whoami") return jsonOut_({ yo: quienSoy });
  if (action === "get_all") {
    const bar = abrirBar_(yo, p.bar);
    if (!bar) return jsonOut_({ error: "sin acceso", yo: quienSoy });
    const admin = yo.rol === ROL_ADMIN;
    const catalogo = readCatalogo_();
    const listas = readListas_();
    const pr = preciosDelBar_(bar, catalogo, admin);
    // Solo los ultimos DIAS_A_LA_APP dias de stock (los de antes quedan en
    // la planilla). "desde" = el dia mas viejo que se manda.
    const conteos = readConteos_();
    const fechas = {};
    conteos.forEach(function (c) { fechas[c.fecha] = true; });
    const dias = Object.keys(fechas).sort().reverse();
    const desde = dias.length > DIAS_A_LA_APP ? dias[DIAS_A_LA_APP - 1] : "";
    return jsonOut_({
      yo: quienSoy,
      conteos: desde ? conteos.filter(function (c) { return c.fecha >= desde; }) : conteos,
      desde: desde,
      productos: catalogo,
      unidades: listas.unidades,
      cantidades: listas.cantidades,
      cierres: readCierres_(),
      pedidos: readPedidosDelBar_(bar.nombre),
      precios: pr.precios,
      whatsapp: bar.whatsapp,
      compras_nuevas: admin ? pr.nuevos : [],
      planilla: admin ? "https://docs.google.com/spreadsheets/d/" + bar.id + "/edit" : ""
    });
  }
  return jsonOut_({ error: "accion desconocida" });
}

function doPost(e) {
  olvidar_();
  cachePrecargar_(["pb", "pv"]);
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: "body invalido" });
  }
  const yo = quien_(body.clave);
  // Clave que no sirve: no se descarta nada, queda guardado en el celular.
  if (!yo) return jsonOut_({ ok: false, error: "clave" });
  const action = body.action;
  if ((ACCIONES_ROL[yo.rol] || []).indexOf(action) < 0) {
    return jsonOut_({ ok: false, error: "sin permiso", descartar: true });
  }

  // La planilla del bar se abre antes de esperar el candado (asi el candado
  // dura menos). Los pedidos y las equivalencias van a la planilla central:
  // no hace falta abrir la del bar.
  let barAbierto;
  try {
    const soloCentral = action === "pedido_add" || action === "equiv_set";
    barAbierto = soloCentral ? barPermitido_(yo, body.bar) : abrirBar_(yo, body.bar);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
  if (!barAbierto) return jsonOut_({ ok: false, error: "sin acceso" });

  // Candado: si dos celulares mandan cambios al mismo tiempo, se procesan
  // de a uno para que no se pisen.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOut_({ ok: false, error: "planilla ocupada" });
  }
  try {
    // Lo que se guarda queda a nombre de quien es de verdad (por su clave).
    const persona = yo.persona;
    // La app reintenta los envios que no pudo confirmar, asi que cada
    // accion tiene que poder repetirse sin duplicar.
    if (action === "add") {
      const cierres = readCierres_();
      const cerradas = fechasCerradas_(cierres);
      if ((body.conteos || []).some(function (c) { return c && cerradas[c.fecha]; })) {
        return jsonOut_({ ok: false, error: "el stock de ese dia esta cerrado", descartar: true });
      }
      const sh = getSheet_(SHEET_CONTEOS, CONTEO_HEADERS);
      const filas = sh.getDataRange().getValues();
      const existentes = {};
      filas.forEach(function (r) { existentes[String(r[0])] = true; });
      const nuevas = (body.conteos || [])
        .filter(function (c) { return c && c.id && !existentes[String(c.id)]; })
        .map(function (c) { c.persona = persona; return conteoToRow_(c); });
      if (nuevas.length) {
        lugar_(sh, filas.length + nuevas.length, 0);
        sh.getRange(filas.length + 1, 1, nuevas.length, CONTEO_HEADERS.length).setValues(nuevas);
        rebuildResumen_(conteosDeFilas_(filas.slice(1).concat(nuevas)), cierres);
      }

    } else if (action === "pedido_add") {
      // Va a la hoja Pedidos de la planilla central (no a la del bar).
      const sh = hojaPedidosCentral_();
      const existentes = {};
      const ultima = sh.getLastRow();
      if (ultima > 1) sh.getRange(2, COL_ID, ultima - 1, 1).getValues().forEach(function (r) { existentes[String(r[0])] = true; });
      const nuevas = (body.items || [])
        .filter(function (p) { return p && p.id && !existentes[String(p.id)]; })
        .map(function (p) { p.persona = persona; return filaPedidoCentral_(p, barAbierto.nombre); });
      if (nuevas.length) {
        lugar_(sh, ultima + nuevas.length, 0);
        sh.getRange(ultima + 1, 1, nuevas.length, PEDIDOS_CENTRAL_HEADERS.length).setValues(nuevas);
      }

    } else if (action === "equiv_set") {
      // "Este nombre de las compras es tal producto del stock" (o "No es stock").
      const compra = String(body.compra || "").trim(), producto = String(body.producto || "").trim();
      if (compra && producto) {
        const sh = hojaCentral_(SHEET_EQUIV, EQUIV_HEADERS);
        const data = sh.getDataRange().getValues();
        let existe = false;
        for (let i = 1; i < data.length; i++) if (norm_(data[i][0]) === norm_(compra) && norm_(data[i][1]) === norm_(producto)) existe = true;
        if (!existe) { sh.appendRow([compra, producto]); nuevaVersionPrecios_(); }
      }

    } else if (action === "delete_carga") {
      deleteRowsWhere_(getSheet_(SHEET_CONTEOS, CONTEO_HEADERS), 10, body.carga);
      rebuildResumen_();

    } else if (action === "cerrar") {
      const cierres = readCierres_();
      if (!fechasCerradas_(cierres)[body.fecha]) {
        getSheet_(SHEET_CIERRES, CIERRES_HEADERS).appendRow([body.fecha, persona, ahora_()]);
        rebuildResumen_(null, cierres.concat([{ fecha: String(body.fecha) }]));
      }

    } else if (action === "reabrir") {
      deleteRowsDeFecha_(getSheet_(SHEET_CIERRES, CIERRES_HEADERS), 0, body.fecha);
      rebuildResumen_();

    } else if (action === "delete_dia") {
      deleteRowsDeFecha_(getSheet_(SHEET_CONTEOS, CONTEO_HEADERS), 1, body.fecha);
      deleteRowsDeFecha_(getSheet_(SHEET_CIERRES, CIERRES_HEADERS), 0, body.fecha);
      rebuildResumen_();

    } else if (action === "replace_carga") {
      const sh = getSheet_(SHEET_CONTEOS, CONTEO_HEADERS);
      deleteRowsWhere_(sh, 10, body.carga);
      const nuevas = (body.conteos || []).filter(function (c) { return c && c.id; }).map(function (c) {
        c.carga = body.carga;
        return conteoToRow_(c);
      });
      if (nuevas.length) {
        const desde = sh.getLastRow() + 1;
        lugar_(sh, desde + nuevas.length - 1, 0);
        sh.getRange(desde, 1, nuevas.length, CONTEO_HEADERS.length).setValues(nuevas);
      }
      rebuildResumen_();

    } else if (action === "product_set") {
      const p = body.producto;
      ensureCatalogoHeaders_();
      const sh = getSheet_(SHEET_CATALOGO, CATALOGO_HEADERS);
      const row = [p.nombre, p.categoria || "Barra", p.grupo === "Top 10" ? "Top 10" : "Resto", p.unidad || "",
        p.familia || "", p.contenido || ""];
      const data = sh.getDataRange().getValues();
      let found = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(p.nombre)) { found = i + 1; break; }
      }
      if (found > 0) sh.getRange(found, 1, 1, row.length).setValues([row]);
      else sh.appendRow(row);
      rebuildResumen_();

    } else if (action === "product_remove") {
      deleteRowsWhere_(getSheet_(SHEET_CATALOGO, CATALOGO_HEADERS), 0, body.nombre);
      rebuildResumen_();

    } else if (action === "config_add") {
      const sh = ensureLista_(String(body.list));
      const existe = readRows_(SHEET_CONFIG).some(function (r) {
        return String(r[0]) === String(body.list) && String(r[1]) === String(body.value);
      });
      if (!existe) sh.appendRow([body.list, body.value]);

    } else if (action === "config_remove") {
      const sh = ensureLista_(String(body.list));
      const data = sh.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]) === String(body.list) && String(data[i][1]) === String(body.value)) {
          sh.deleteRow(i + 1);
          break;
        }
      }

    } else {
      // Nunca hay una accion que borre la planilla entera y la reemplace
      // con lo de un celular.
      return jsonOut_({ ok: false, error: "accion desconocida" });
    }
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
