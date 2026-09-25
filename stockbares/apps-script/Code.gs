// ============================================================
// STOCK DE BARES - Backend de Apps Script (una planilla por bar)
// ============================================================
// Que hace: convierte esta planilla en la base de datos de UN bar.
// La app le pide los datos (doGet) y le manda los cambios (doPost).
// Crea sola las hojas que necesita:
//   - "Conteos": cada producto contado, renglon por renglon.
//   - "Catalogo": los productos (Bebidas/Comida, Top 10/Resto, unidad).
//   - "Resumen": se arma sola despues de cada carga, con los productos
//     en filas y las fechas en columnas. No escribir a mano en ella.
//   - "Config": las unidades de medida.
//
// Este archivo es una copia de respaldo: el que funciona de verdad
// es el que esta pegado dentro de la planilla. La direccion /exec
// NUNCA va en el repositorio.
//
// COMO INSTALARLO DESDE CERO:
// 1. Crear la planilla de Google del bar (ej: "Stock Archie").
// 2. Extensiones > Apps Script.
// 3. Borrar lo que haya en Code.gs, pegar este archivo completo y
//    guardar (icono de disquete).
// 4. Implementar > Nueva implementacion > tipo "Aplicacion web".
//      - Ejecutar como: Yo
//      - Quien tiene acceso: Cualquier usuario
//    Autorizar los permisos que pide Google.
// 5. Copiar la URL que termina en /exec y pasarsela a Claude por el
//    chat para que arme los links de instalacion.
//
// COMO ACTUALIZARLO (sin que cambie el link):
// 1. Extensiones > Apps Script.
// 2. Borrar todo el contenido de Code.gs y pegar este archivo completo.
// 3. Guardar.
// 4. Implementar > Gestionar implementaciones > icono de lapiz >
//    Version: "Nueva version" > Implementar.
//    (NO usar "Nueva implementacion": eso crea otro link y habria
//    que volver a instalar la app en todos los celulares.)
// ============================================================

// Quienes pueden borrar cargas. Tiene que coincidir con los permisos
// de la app (PERMISOS en stockbares/index.html).
const QUIEN_PUEDE_BORRAR = ["Noel"];

const SHEET_CONTEOS = "Conteos";
const SHEET_CATALOGO = "Catálogo";
const SHEET_RESUMEN = "Resumen";
const SHEET_CONFIG = "Config";

const CONTEO_HEADERS = ["ID","Fecha","Categoría","Grupo","Producto","Cantidad","Unidad","Persona","Nota","Cargado","Carga"];
const CATALOGO_HEADERS = ["Producto","Categoría","Grupo","Unidad"];
const CONFIG_HEADERS = ["Tipo","Valor"];

const DEFAULT_CONFIG = {
  unidades: ["Botellas","Kilos","Unidades"]
};

// Cuantas fechas (las mas nuevas) se muestran en la hoja Resumen.
const RESUMEN_FECHAS = 20;

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

// Solo para escribir (siempre con el candado puesto): crea la hoja si falta.
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

// Para leer: si la hoja no existe todavia, no hay datos (no crea nada).
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

function num_(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function readConteos_() {
  return readRows_(SHEET_CONTEOS).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return {
      id: String(r[0]),
      fecha: formatDate_(r[1]),
      categoria: String(r[2] || ""),
      grupo: String(r[3] || ""),
      producto: String(r[4]),
      cantidad: num_(r[5]),
      unidad: String(r[6] || ""),
      persona: String(r[7] || ""),
      nota: String(r[8] || ""),
      cargado: formatDateTime_(r[9]),
      carga: String(r[10] || r[0])
    };
  });
}

function readCatalogo_() {
  return readRows_(SHEET_CATALOGO).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return {
      nombre: String(r[0]),
      categoria: String(r[1] || "Bebidas"),
      grupo: String(r[2] || "Resto"),
      unidad: String(r[3] || "")
    };
  });
}

function readUnidades_() {
  const out = [];
  readRows_(SHEET_CONFIG).forEach(function (r) {
    if (String(r[0]) === "unidades" && r[1] !== "") out.push(String(r[1]));
  });
  return out.length ? out : DEFAULT_CONFIG.unidades;
}

// La primera vez que se cambian las unidades, se guardan las de arranque.
function ensureUnidades_() {
  const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
  if (sh.getLastRow() <= 1) {
    DEFAULT_CONFIG.unidades.forEach(function (u) { sh.appendRow(["unidades", u]); });
  }
  return sh;
}

// Borra las filas cuya columna col coincide, de abajo hacia arriba y en
// tramos seguidos para que sea rapido.
function deleteRowsWhere_(sh, col, value) {
  const data = sh.getDataRange().getValues();
  let i = data.length - 1;
  while (i >= 1) {
    if (String(data[i][col]) === String(value)) {
      let start = i;
      while (start - 1 >= 1 && String(data[start - 1][col]) === String(value)) start--;
      sh.deleteRows(start + 1, i - start + 1);
      i = start - 1;
    } else {
      i--;
    }
  }
}

function conteoToRow_(c) {
  return [
    c.id, c.fecha, c.categoria || "", c.grupo || "", c.producto, c.cantidad,
    c.unidad || "", c.persona || "", c.nota || "", c.cargado || "", c.carga || c.id
  ];
}

// Arma la hoja Resumen: productos en filas, fechas en columnas (la mas
// nueva primero). Si un producto se conto dos veces el mismo dia, vale
// el ultimo. Es solo una vista: los datos de verdad estan en Conteos.
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
      productos.push({ nombre: c.producto, categoria: c.categoria, grupo: c.grupo, unidad: c.unidad });
    }
  });
  const ordenCat = function (c) { return c === "Bebidas" ? 0 : c === "Comida" ? 1 : 2; };
  productos.sort(function (a, b) {
    return ordenCat(a.categoria) - ordenCat(b.categoria) ||
      (a.grupo === "Top 10" ? 0 : 1) - (b.grupo === "Top 10" ? 0 : 1) ||
      a.nombre.localeCompare(b.nombre, "es", { numeric: true });
  });

  const header = ["Categoría", "Grupo", "Producto", "Unidad"].concat(cols.map(function (f) {
    const p = f.split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : f;
  }));
  const rows = [header].concat(productos.map(function (p) {
    return [p.categoria, p.grupo, p.nombre, p.unidad].concat(cols.map(function (f) {
      const k = p.nombre + "|" + f;
      return k in valor ? valor[k] : "";
    }));
  }));

  let sh = ss_().getSheetByName(SHEET_RESUMEN);
  if (!sh) sh = ss_().insertSheet(SHEET_RESUMEN);
  sh.clear();
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
  sh.getRange(1, 1, 1, header.length).setFontWeight("bold");
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "get_all";
  if (action === "get_all") {
    return jsonOut_({
      conteos: readConteos_(),
      productos: readCatalogo_(),
      unidades: readUnidades_(),
      planilla: ss_().getUrl()
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

  // Candado: si dos celulares mandan cambios al mismo tiempo, se
  // procesan de a uno para que no se pisen.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOut_({ ok: false, error: "planilla ocupada" });
  }

  const action = body.action;
  try {
    // La app reintenta los envios que no pudo confirmar (por ejemplo sin
    // senal), asi que cada accion tiene que poder repetirse sin duplicar.
    if (action === "add") {
      const sh = getSheet_(SHEET_CONTEOS, CONTEO_HEADERS);
      const existentes = {};
      readRows_(SHEET_CONTEOS).forEach(function (r) { existentes[String(r[0])] = true; });
      const nuevas = (body.conteos || [])
        .filter(function (c) { return c && c.id && !existentes[String(c.id)]; })
        .map(conteoToRow_);
      if (nuevas.length) {
        sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, CONTEO_HEADERS.length).setValues(nuevas);
        rebuildResumen_();
      }

    } else if (action === "delete_carga") {
      if (QUIEN_PUEDE_BORRAR.indexOf(String(body.quien)) < 0) {
        return jsonOut_({ ok: false, error: "sin permiso para borrar", descartar: true });
      }
      deleteRowsWhere_(getSheet_(SHEET_CONTEOS, CONTEO_HEADERS), 10, body.carga);
      rebuildResumen_();

    } else if (action === "product_set") {
      const p = body.producto;
      const sh = getSheet_(SHEET_CATALOGO, CATALOGO_HEADERS);
      const row = [p.nombre, p.categoria || "Bebidas", p.grupo || "Resto", p.unidad || ""];
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
      const sh = ensureUnidades_();
      const existe = readRows_(SHEET_CONFIG).some(function (r) {
        return String(r[0]) === String(body.list) && String(r[1]) === String(body.value);
      });
      if (!existe) sh.appendRow([body.list, body.value]);

    } else if (action === "config_remove") {
      const sh = ensureUnidades_();
      const data = sh.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]) === String(body.list) && String(data[i][1]) === String(body.value)) {
          sh.deleteRow(i + 1);
          break;
        }
      }

    } else {
      // Nunca hay una accion que borre la planilla entera y la
      // reemplace con lo de un celular.
      return jsonOut_({ ok: false, error: "accion desconocida" });
    }
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
