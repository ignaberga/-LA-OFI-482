// ============================================================
// STOCK DE BARES - Backend de Apps Script (una planilla por bar)
// ============================================================
// Que hace: convierte esta planilla en la base de datos de UN bar.
// La app le pide los datos (doGet) y le manda los cambios (doPost).
// La primera vez crea sola las hojas "Movimientos", "Productos",
// "Tragos" y "Config" con sus titulos.
//
// Cada bar tiene su propia planilla con este mismo codigo pegado.
// Asi el encargado de un bar no tiene forma de ver los datos de otro.
//
// Este archivo es una copia de respaldo: el que funciona de verdad
// es el que esta pegado dentro de la planilla. La direccion /exec
// NUNCA va en el repositorio.
//
// COMO INSTALARLO DESDE CERO:
// 1. Crear la planilla de Google del bar (ej: "Stock Hugo").
// 2. Extensiones > Apps Script.
// 3. Borrar lo que haya en Code.gs, pegar este archivo completo y
//    guardar (icono de disquete).
// 4. Implementar > Nueva implementacion > tipo "Aplicacion web".
//      - Ejecutar como: Yo
//      - Quien tiene acceso: Cualquier usuario
//    Autorizar los permisos que pide Google (es tu propia planilla).
// 5. Copiar la URL que termina en /exec y pasarsela a Claude por el
//    chat para que arme los links de instalacion.
//
// (Opcional) Para cargar productos y tragos de ejemplo: arriba, en
// la lista de funciones, elegir "cargarEjemplo" y tocar "Ejecutar".
// Solo agrega si la hoja Productos esta vacia; nunca borra nada.
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

const SHEET_MOV = "Movimientos";
const SHEET_PROD = "Productos";
const SHEET_TRAGOS = "Tragos";
const SHEET_CONFIG = "Config";

const MOV_HEADERS = ["ID","Fecha","Tipo","Producto","Cantidad","Unidad","Persona","Detalle","Comprobante","Nota","Cargado","Grupo"];
const PROD_HEADERS = ["Producto","Unidad","Contenido","Medida"];
const TRAGO_HEADERS = ["Trago","Producto","Cantidad","En"];
const CONFIG_HEADERS = ["Tipo","Valor"];

const DEFAULT_CONFIG = {
  unidades: ["Botellas","Kilos","Unidades"]
};

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function ensureConfigDefaults_() {
  const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
  if (sh.getLastRow() <= 1) {
    Object.keys(DEFAULT_CONFIG).forEach(function (tipo) {
      DEFAULT_CONFIG[tipo].forEach(function (valor) { sh.appendRow([tipo, valor]); });
    });
  }
}

function dataRows_(sh) {
  return sh.getDataRange().getValues().slice(1);
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === "[object Date]";
}

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

function readMovimientos_() {
  const sh = getSheet_(SHEET_MOV, MOV_HEADERS);
  return dataRows_(sh).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return {
      id: String(r[0]),
      fecha: formatDate_(r[1]),
      tipo: String(r[2]),
      producto: String(r[3]),
      cantidad: num_(r[4]),
      unidad: String(r[5] || ""),
      persona: String(r[6] || ""),
      detalle: String(r[7] || ""),
      comprobante: String(r[8] || ""),
      nota: String(r[9] || ""),
      cargado: formatDateTime_(r[10]),
      grupo: String(r[11] || r[0])
    };
  });
}

function readProductos_() {
  const sh = getSheet_(SHEET_PROD, PROD_HEADERS);
  return dataRows_(sh).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return {
      nombre: String(r[0]),
      unidad: String(r[1] || ""),
      contenido: num_(r[2]),
      medida: String(r[3] || "")
    };
  });
}

function readTragos_() {
  const sh = getSheet_(SHEET_TRAGOS, TRAGO_HEADERS);
  const orden = [];
  const porNombre = {};
  dataRows_(sh).forEach(function (r) {
    if (r[0] === "") return;
    const nombre = String(r[0]);
    if (!porNombre[nombre]) { porNombre[nombre] = { nombre: nombre, ingredientes: [] }; orden.push(nombre); }
    if (r[1] !== "") {
      porNombre[nombre].ingredientes.push({
        producto: String(r[1]),
        cantidad: num_(r[2]),
        en: String(r[3] || "medida") === "unidad" ? "unidad" : "medida"
      });
    }
  });
  return orden.map(function (n) { return porNombre[n]; });
}

function readConfig_() {
  const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
  const out = { unidades: [] };
  dataRows_(sh).forEach(function (r) {
    if (out[r[0]] && r[1] !== "") out[r[0]].push(String(r[1]));
  });
  Object.keys(DEFAULT_CONFIG).forEach(function (k) {
    if (!out[k] || out[k].length === 0) out[k] = DEFAULT_CONFIG[k];
  });
  return out;
}

// Borra las filas cuya primera columna (o la columna col) coincide,
// de abajo hacia arriba y en tramos seguidos para que sea rapido.
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

function movimientoToRow_(m) {
  return [
    m.id,
    m.fecha,
    m.tipo,
    m.producto,
    m.cantidad,
    m.unidad || "",
    m.persona || "",
    m.detalle || "",
    m.comprobante || "",
    m.nota || "",
    m.cargado || "",
    m.grupo || m.id
  ];
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  ensureConfigDefaults_();
  const action = (e && e.parameter && e.parameter.action) || "get_all";
  if (action === "get_all") {
    const cfg = readConfig_();
    return jsonOut_({
      movimientos: readMovimientos_(),
      productos: readProductos_(),
      tragos: readTragos_(),
      unidades: cfg.unidades
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
    ensureConfigDefaults_();
    // La app reintenta los envios que no pudo confirmar (por ejemplo sin
    // senal), asi que cada accion tiene que poder repetirse sin duplicar.
    if (action === "add") {
      const sh = getSheet_(SHEET_MOV, MOV_HEADERS);
      const existentes = {};
      dataRows_(sh).forEach(function (r) { existentes[String(r[0])] = true; });
      const nuevas = (body.movimientos || [])
        .filter(function (m) { return m && m.id && !existentes[String(m.id)]; })
        .map(movimientoToRow_);
      if (nuevas.length) {
        sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, MOV_HEADERS.length).setValues(nuevas);
      }

    } else if (action === "delete_group") {
      if (QUIEN_PUEDE_BORRAR.indexOf(String(body.quien)) < 0) {
        return jsonOut_({ ok: false, error: "sin permiso para borrar", descartar: true });
      }
      deleteRowsWhere_(getSheet_(SHEET_MOV, MOV_HEADERS), 11, body.grupo);

    } else if (action === "product_set") {
      const p = body.producto;
      const sh = getSheet_(SHEET_PROD, PROD_HEADERS);
      const row = [p.nombre, p.unidad || "", p.contenido || "", p.medida || ""];
      const data = sh.getDataRange().getValues();
      let found = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(p.nombre)) { found = i + 1; break; }
      }
      if (found > 0) sh.getRange(found, 1, 1, row.length).setValues([row]);
      else sh.appendRow(row);

    } else if (action === "product_remove") {
      deleteRowsWhere_(getSheet_(SHEET_PROD, PROD_HEADERS), 0, body.nombre);

    } else if (action === "trago_set") {
      const t = body.trago;
      const sh = getSheet_(SHEET_TRAGOS, TRAGO_HEADERS);
      deleteRowsWhere_(sh, 0, t.nombre);
      const rows = (t.ingredientes || []).map(function (i) {
        return [t.nombre, i.producto, i.cantidad, i.en === "unidad" ? "unidad" : "medida"];
      });
      if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, TRAGO_HEADERS.length).setValues(rows);

    } else if (action === "trago_remove") {
      deleteRowsWhere_(getSheet_(SHEET_TRAGOS, TRAGO_HEADERS), 0, body.nombre);

    } else if (action === "config_add") {
      const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
      const existe = dataRows_(sh).some(function (r) {
        return String(r[0]) === String(body.list) && String(r[1]) === String(body.value);
      });
      if (!existe) sh.appendRow([body.list, body.value]);

    } else if (action === "config_remove") {
      const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
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

// Carga productos y tragos de ejemplo para probar. Solo hace algo si la
// hoja Productos esta vacia. Se ejecuta a mano desde el editor.
function cargarEjemplo() {
  const shP = getSheet_(SHEET_PROD, PROD_HEADERS);
  if (shP.getLastRow() > 1) {
    Logger.log("La hoja Productos ya tiene datos: no se cargo nada.");
    return;
  }
  const productos = [
    ["Fernet Branca 750 ml", "Botellas", 750, "ml"],
    ["Gin Beefeater 700 ml", "Botellas", 700, "ml"],
    ["Campari 750 ml", "Botellas", 750, "ml"],
    ["Vermut Martini Rosso 1 l", "Botellas", 1000, "ml"],
    ["Vodka Absolut 750 ml", "Botellas", 750, "ml"],
    ["Vino Malbec Rutini", "Botellas", 750, "ml"]
  ];
  shP.getRange(2, 1, productos.length, PROD_HEADERS.length).setValues(productos);

  const shT = getSheet_(SHEET_TRAGOS, TRAGO_HEADERS);
  if (shT.getLastRow() <= 1) {
    const tragos = [
      ["Fernet con coca", "Fernet Branca 750 ml", 70, "medida"],
      ["Gin tonic", "Gin Beefeater 700 ml", 60, "medida"],
      ["Negroni", "Gin Beefeater 700 ml", 30, "medida"],
      ["Negroni", "Campari 750 ml", 30, "medida"],
      ["Negroni", "Vermut Martini Rosso 1 l", 30, "medida"],
      ["Botella Malbec Rutini", "Vino Malbec Rutini", 1, "unidad"]
    ];
    shT.getRange(2, 1, tragos.length, TRAGO_HEADERS.length).setValues(tragos);
  }
  Logger.log("Listo: se cargaron productos y tragos de ejemplo.");
}
