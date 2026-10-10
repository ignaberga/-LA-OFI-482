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
//     resumen de compras de los bares que comparten Cuccina: GRUPO2
//     (proveedor, escrito solo en el primer renglon de cada uno),
//     DENOMINACION y Precio Unitario. No tiene fechas: vale como precio,
//     pero una compra con fecha de otra hoja le gana.
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
//    instalacion".
//
// COMO ACTUALIZARLO (sin que cambien los links):
// 1. Extensiones > Apps Script, borrar todo, pegar este archivo y guardar.
// 2. Implementar > Gestionar implementaciones > lapiz > Version: "Nueva
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
  if (!sh || sh.getLastRow() <= 1) return [];
  return sh.getDataRange().getValues().slice(1);
}

function idDePlanilla_(v) {
  const s = String(v || "").trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : s;
}

function leerBares_() {
  return filasCentral_(SHEET_BARES).filter(function (r) { return String(r[0]).trim() !== ""; }).map(function (r) {
    return { nombre: String(r[0]).trim(), id: idDePlanilla_(r[1]), whatsapp: String(r[2] || "").replace(/[^0-9]/g, "") };
  });
}

function leerPersonas_() {
  return filasCentral_(SHEET_PERSONAS).filter(function (r) { return String(r[0]).trim() !== ""; }).map(function (r) {
    const rol = /admin/i.test(String(r[1])) ? ROL_ADMIN : ROL_ENCARGADO;
    const bares = String(r[2] || "").split(",").map(function (b) { return b.trim(); }).filter(String);
    return { persona: String(r[0]).trim(), rol: rol, bares: bares, clave: String(r[3] || "").trim() };
  });
}

// Quien es (por su clave) y a que bares puede entrar. null si la clave no sirve.
function quien_(clave) {
  if (!clave) return null;
  const p = leerPersonas_().filter(function (x) { return x.clave && x.clave === String(clave); })[0];
  if (!p) return null;
  const todos = leerBares_();
  const todosLosBares = p.bares.some(function (b) { return /^todos$/i.test(b); });
  p.baresPermitidos = todos.filter(function (b) {
    return todosLosBares || p.bares.some(function (x) { return x.toLowerCase() === b.nombre.toLowerCase(); });
  });
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

// "02/09/2026", una fecha de la planilla o un numero → milisegundos.
function fechaMs_(v) {
  if (isDate_(v)) return v.getTime();
  const m = String(v || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return new Date(Number(m[3].length === 2 ? "20" + m[3] : m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  const t = new Date(String(v || "")).getTime();
  return isNaN(t) ? 0 : t;
}

// Hojas "Compras ..." de la planilla central.
function hojasCompras_() {
  return central_().getSheets().filter(function (sh) { return /^compras\b/i.test(sh.getName()); });
}

// Lee una hoja de compras de Cuccina pegada tal cual. Puede tener los
// titulos repetidos (si se pegaron varios reportes uno debajo del otro).
function leerCompras_(sh) {
  const data = sh.getDataRange().getValues();
  const out = [];
  let c = null, prov = "";
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const t = r.map(norm_);
    if (t.some(function (x) { return /^descripcion$|^denominacion$|^producto$|^nombre$|^articulo$/.test(x); })) {
      const col = function (re) { for (let j = 0; j < t.length; j++) if (re.test(t[j])) return j; return -1; };
      c = {
        fecha: col(/^fecha doc/) >= 0 ? col(/^fecha doc/) : col(/^fecha/),
        prov: col(/razon social|proveedor/) >= 0 ? col(/razon social|proveedor/) : col(/^grupo ?2$/),
        nom: col(/^descripcion|^denominacion|^producto|^nombre|^articulo/),
        precio: col(/precio unitario/) >= 0 ? col(/precio unitario/) : col(/costo/) >= 0 ? col(/costo/) : col(/precio/) >= 0 ? col(/precio/) : 7,
        desc: col(/^descuento item/) >= 0 ? col(/^descuento item/) : col(/^descuento$/),
        tipo: col(/^tipo/)
      };
      prov = "";
      continue;
    }
    if (!c) continue;
    // En los resumenes el proveedor va solo en el primer renglon de cada uno.
    if (c.prov >= 0 && String(r[c.prov] === undefined ? "" : r[c.prov]).trim()) prov = String(r[c.prov]).trim().replace(/\s*\(\d+\)\s*$/, "");
    const nombre = String(r[c.nom] === undefined ? "" : r[c.nom]).trim();
    if (!nombre || /^total/i.test(nombre) || /^total/i.test(prov)) continue;
    if (c.desc >= 0 && num_(r[c.desc]) >= 100) continue;
    if (c.tipo >= 0 && /^n\.? ?c\b|credito/i.test(norm_(r[c.tipo]))) continue;
    const costo = precio_(r[c.precio]);
    if (!(costo > 0)) continue;
    out.push({
      nombre: nombre,
      proveedor: prov,
      costo: costo,
      fecha: c.fecha >= 0 ? fechaMs_(r[c.fecha]) : 0
    });
  }
  return out;
}

// Todas las compras de todos los bares, de la mas vieja a la mas nueva.
function todasLasCompras_() {
  let lista = [];
  hojasCompras_().forEach(function (sh) { lista = lista.concat(leerCompras_(sh)); });
  lista.forEach(function (x, i) { x.orden = i; });
  return lista.sort(function (a, b) { return a.fecha - b.fecha || a.orden - b.orden; });
}

// { nombre en compras (normalizado): [productos del stock] } ("No es stock"
// si alguno lo dice).
function leerEquivalencias_() {
  const out = {};
  filasCentral_(SHEET_EQUIV).forEach(function (r) {
    const k = norm_(r[0]), v = String(r[1] || "").trim();
    if (!k || !v) return;
    if (norm_(v) === norm_(NO_ES_STOCK)) { out[k] = NO_ES_STOCK; return; }
    if (out[k] === NO_ES_STOCK) return;
    (out[k] = out[k] || []).push(v);
  });
  return out;
}

// Para cada producto del catalogo del bar: el costo de la ultima compra,
// sus proveedores (el mas reciente primero) y el ultimo costo de cada uno.
function preciosDelCatalogo_(catalogo) {
  const eq = leerEquivalencias_();
  const porNom = {};
  todasLasCompras_().forEach(function (c) {
    const k = norm_(c.nombre);
    if (eq[k] === NO_ES_STOCK) return;
    const keys = [k];
    (eq[k] || []).forEach(function (v) { if (keys.indexOf(norm_(v)) < 0) keys.push(norm_(v)); });
    keys.forEach(function (x) { (porNom[x] = porNom[x] || []).push(c); });
  });
  const out = {};
  catalogo.forEach(function (prod) {
    const hits = (porNom[norm_(prod.nombre)] || []).slice().reverse();
    const porProveedor = {}, provs = [];
    hits.forEach(function (h) {
      const v = h.proveedor || "Sin proveedor";
      if (provs.indexOf(v) < 0) { provs.push(v); porProveedor[v] = h.costo; }
    });
    out[prod.nombre] = { costo: hits.length ? hits[0].costo : null, proveedores: provs, porProveedor: porProveedor };
  });
  return out;
}

// Lo que aparece en las compras de este bar y no esta en su catalogo ni
// en Equivalencias: para que el administrador diga que es.
function comprasNuevas_(barNombre, catalogo) {
  const eq = leerEquivalencias_();
  const enCatalogo = {};
  catalogo.forEach(function (p) { enCatalogo[norm_(p.nombre)] = true; });
  const sh = hojasCompras_().filter(function (h) { return norm_(h.getName()) === norm_("Compras " + barNombre); })[0];
  if (!sh) return [];
  const ult = {};
  leerCompras_(sh).forEach(function (c) {
    const k = norm_(c.nombre);
    if (enCatalogo[k] || eq[k]) return;
    if (!ult[k] || c.fecha >= ult[k].fecha) ult[k] = c;
  });
  return Object.keys(ult).map(function (k) { return { nombre: ult[k].nombre, proveedor: ult[k].proveedor, costo: ult[k].costo }; })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
}

// Menu en la planilla central.
function onOpen() {
  hojaCentral_(SHEET_BARES, BARES_HEADERS);
  hojaCentral_(SHEET_PERSONAS, PERSONAS_HEADERS);
  hojaCentral_(SHEET_EQUIV, EQUIV_HEADERS);
  SpreadsheetApp.getUi().createMenu("Stock bares")
    .addItem("Armar links de instalación", "armarLinks")
    .addToUi();
}

// Le da una clave a quien no tiene y escribe el link de instalacion de cada uno.
function armarLinks() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert("Primero hay que implementar el código como aplicación web (Implementar > Nueva implementación).");
    return;
  }
  const sh = hojaCentral_(SHEET_PERSONAS, PERSONAS_HEADERS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === "") continue;
    let clave = String(data[i][3] || "").trim();
    if (!clave) clave = Utilities.getUuid().replace(/-/g, "").slice(0, 20);
    sh.getRange(i + 1, 4, 1, 2).setValues([[clave, APP_URL + "#central=" + url + "&clave=" + clave]]);
  }
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
  if (!sh || sh.getLastRow() <= 1) return [];
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

function readConteos_() {
  return readRows_(SHEET_CONTEOS).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return {
      id: String(r[0]), fecha: formatDate_(r[1]), categoria: cat_(r[2]), grupo: String(r[3] || ""),
      producto: String(r[4]), cantidad: num_(r[5]), unidad: String(r[6] || ""), persona: String(r[7] || ""),
      nota: String(r[8] || ""), cargado: formatDateTime_(r[9]), carga: String(r[10] || r[0])
    };
  });
}

function readCatalogo_() {
  return readRows_(SHEET_CATALOGO).filter(function (r) { return String(r[0]).trim() !== ""; }).map(function (r) {
    const txt = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    return {
      nombre: txt(r[0]),
      categoria: cat_(txt(r[1])),
      grupo: /^top\s*10$/i.test(txt(r[2])) ? "Top 10" : "Resto",
      unidad: txt(r[3]),
      familia: txt(r[4]),
      contenido: txt(r[5])
    };
  });
}

// Agrega los titulos que falten en Catalogo (sin tocar ningun dato ni
// los titulos que ya estan escritos).
function ensureCatalogoHeaders_() {
  const sh = ss_().getSheetByName(SHEET_CATALOGO);
  if (!sh) return;
  const n = CATALOGO_HEADERS.length;
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  const fila = sh.getRange(1, 1, 1, n).getValues()[0];
  for (let i = 0; i < n; i++) {
    if (String(fila[i]).trim() === "") sh.getRange(1, i + 1).setValue(CATALOGO_HEADERS[i]).setFontWeight("bold");
  }
}

function readCierres_() {
  return readRows_(SHEET_CIERRES).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return { fecha: formatDate_(r[0]), persona: String(r[1] || ""), cuando: formatDateTime_(r[2]) };
  });
}

function fechasCerradas_() {
  const out = {};
  readCierres_().forEach(function (c) { out[c.fecha] = true; });
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

// Arma la hoja Resumen del bar (igual que antes).
function rebuildResumen_() {
  const conteos = readConteos_();
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
  conteos.forEach(function (c) {
    if (!productos.some(function (p) { return p.nombre === c.producto; })) {
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

  const cerradas = fechasCerradas_();
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
  const rango = sh.getRange(1, 1, rows.length, header.length);
  rango.setValues(rows);
  rango.setBackgrounds(fondos);
  rango.setFontColors(letras);
  rango.setFontWeights(negritas);
  for (let c = FIJAS + 2; c <= header.length; c += 2) {
    if (rows.length > 1) sh.getRange(2, c, rows.length - 1, 1).setNumberFormat("+0.##;-0.##;0");
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(4);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Abre la planilla del bar pedido, si esa persona puede entrar.
function abrirBar_(yo, barNombre) {
  const bar = yo.baresPermitidos.filter(function (b) { return b.nombre === String(barNombre); })[0];
  if (!bar) return null;
  SS = SpreadsheetApp.openById(bar.id);
  return bar;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const yo = quien_(p.clave);
  if (!yo) return jsonOut_({ error: "clave" });
  const quienSoy = { persona: yo.persona, rol: yo.rol, bares: yo.baresPermitidos.map(function (b) { return b.nombre; }) };
  const action = p.action || "get_all";
  if (action === "whoami") return jsonOut_({ yo: quienSoy });
  if (action === "get_all") {
    const bar = abrirBar_(yo, p.bar);
    if (!bar) return jsonOut_({ error: "sin acceso", yo: quienSoy });
    ensureCatalogoHeaders_();
    const catalogo = readCatalogo_();
    return jsonOut_({
      yo: quienSoy,
      conteos: readConteos_(),
      productos: catalogo,
      unidades: readLista_("unidades"),
      cantidades: readLista_("cantidades"),
      cierres: readCierres_(),
      pedidos: readPedidos_(),
      precios: preciosDelCatalogo_(catalogo),
      whatsapp: bar.whatsapp,
      compras_nuevas: yo.rol === ROL_ADMIN ? comprasNuevas_(bar.nombre, catalogo) : [],
      planilla: yo.rol === ROL_ADMIN ? ss_().getUrl() : ""
    });
  }
  return jsonOut_({ error: "accion desconocida" });
}

function doPost(e) {
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

  // Candado: si dos celulares mandan cambios al mismo tiempo, se procesan
  // de a uno para que no se pisen.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOut_({ ok: false, error: "planilla ocupada" });
  }
  try {
    if (!abrirBar_(yo, body.bar)) return jsonOut_({ ok: false, error: "sin acceso" });
    // Lo que se guarda queda a nombre de quien es de verdad (por su clave).
    const persona = yo.persona;
    // La app reintenta los envios que no pudo confirmar, asi que cada
    // accion tiene que poder repetirse sin duplicar.
    if (action === "add") {
      const cerradas = fechasCerradas_();
      if ((body.conteos || []).some(function (c) { return c && cerradas[c.fecha]; })) {
        return jsonOut_({ ok: false, error: "el stock de ese dia esta cerrado", descartar: true });
      }
      const sh = getSheet_(SHEET_CONTEOS, CONTEO_HEADERS);
      const existentes = {};
      readRows_(SHEET_CONTEOS).forEach(function (r) { existentes[String(r[0])] = true; });
      const nuevas = (body.conteos || [])
        .filter(function (c) { return c && c.id && !existentes[String(c.id)]; })
        .map(function (c) { c.persona = persona; return conteoToRow_(c); });
      if (nuevas.length) {
        sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, CONTEO_HEADERS.length).setValues(nuevas);
        rebuildResumen_();
      }

    } else if (action === "pedido_add") {
      const sh = getSheet_(SHEET_PEDIDOS, PEDIDO_HEADERS);
      const existentes = {};
      readRows_(SHEET_PEDIDOS).forEach(function (r) { existentes[String(r[0])] = true; });
      const nuevas = (body.items || [])
        .filter(function (p) { return p && p.id && !existentes[String(p.id)]; })
        .map(function (p) { p.persona = persona; return pedidoToRow_(p); });
      if (nuevas.length) sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, PEDIDO_HEADERS.length).setValues(nuevas);

    } else if (action === "equiv_set") {
      // "Este nombre de las compras es tal producto del stock" (o "No es stock").
      const compra = String(body.compra || "").trim(), producto = String(body.producto || "").trim();
      if (compra && producto) {
        const sh = hojaCentral_(SHEET_EQUIV, EQUIV_HEADERS);
        const data = sh.getDataRange().getValues();
        let existe = false;
        for (let i = 1; i < data.length; i++) if (norm_(data[i][0]) === norm_(compra) && norm_(data[i][1]) === norm_(producto)) existe = true;
        if (!existe) sh.appendRow([compra, producto]);
      }

    } else if (action === "delete_carga") {
      deleteRowsWhere_(getSheet_(SHEET_CONTEOS, CONTEO_HEADERS), 10, body.carga);
      rebuildResumen_();

    } else if (action === "cerrar") {
      if (!fechasCerradas_()[body.fecha]) {
        getSheet_(SHEET_CIERRES, CIERRES_HEADERS).appendRow([body.fecha, persona, ahora_()]);
        rebuildResumen_();
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
      if (nuevas.length) sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, CONTEO_HEADERS.length).setValues(nuevas);
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
