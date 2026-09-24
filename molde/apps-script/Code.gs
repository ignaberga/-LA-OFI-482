// ============================================================
// MOLDE (copiado de La Emilia) - Backend de Apps Script
// ============================================================
// Que hace: convierte esta planilla en la base de datos real de la
// app. La app le pide los datos (doGet) y le manda altas/bajas
// (doPost). Crea automaticamente las hojas "Ingresos", "Gastos" y
// "Config" la primera vez que se usa, con las categorias/unidades/
// formas de pago por defecto.
//
// Este archivo es una copia de respaldo: el que funciona de verdad
// es el que esta pegado dentro de la planilla. La direccion /exec
// NUNCA va en este repositorio.
//
// COMO ACTUALIZARLO (sin que cambie el link):
// 1. Abri la planilla > Extensiones > Apps Script.
// 2. Borra todo el contenido de Code.gs y pega este archivo completo.
// 3. Guarda (icono de disquete).
// 4. Implementar > Gestionar implementaciones > icono de lapiz >
//    Version: "Nueva version" > Implementar.
//    (NO uses "Nueva implementacion": eso crea otro link y habria
//    que volver a vincular todos los celulares.)
//
// COMO INSTALARLO DESDE CERO (solo si no hay implementacion):
//    Implementar > Nueva implementacion > tipo "Aplicacion web".
//      - Ejecutar como: Yo
//      - Quien tiene acceso: Cualquier usuario
//    Copia la URL que termina en /exec y pegala en la app, en
//    Config > Planilla de Google.
// ============================================================

const SHEET_INGRESOS = "Ingresos";
const SHEET_GASTOS = "Gastos";
const SHEET_CONFIG = "Config";

const MOV_HEADERS = ["ID","Fecha","Categoria","Monto","Persona","ClienteProveedor","Factura","Cantidad","Unidad","FormaPago","Nota"];
const CONFIG_HEADERS = ["Tipo","Valor"];

const DEFAULT_CONFIG = {
  cat_ingreso: ["Honorarios","Otros ingresos"],
  cat_gasto: ["Alquiler","Servicios","Sueldos","Insumos de oficina","Impuestos","Otros gastos"],
  proveedores: [],
  clientes: [],
  unidades: ["Unidades","Horas"],
  formas_pago: ["Efectivo","Transferencia","Cheque"]
};

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function ensureConfigDefaults_() {
  const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) {
    Object.keys(DEFAULT_CONFIG).forEach(function (tipo) {
      DEFAULT_CONFIG[tipo].forEach(function (valor) { sh.appendRow([tipo, valor]); });
    });
  }
}

function formatDate_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  return String(v);
}

function readMovimientos_(sheetName, type) {
  const sh = getSheet_(sheetName, MOV_HEADERS);
  const data = sh.getDataRange().getValues();
  const rows = data.slice(1);
  return rows.filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return {
      id: String(r[0]),
      type: type,
      date: formatDate_(r[1]),
      category: r[2],
      amount: Number(r[3]) || 0,
      person: r[4],
      client: type === "ingreso" ? (r[5] || "") : "",
      provider: type === "gasto" ? (r[5] || "") : "",
      invoice: r[6] || "",
      quantity: r[7] === "" ? null : Number(r[7]),
      unit: r[8] || "",
      payment: r[9] || "",
      note: r[10] || ""
    };
  });
}

function readConfig_() {
  const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
  const data = sh.getDataRange().getValues();
  const rows = data.slice(1);
  const out = { cat_ingreso: [], cat_gasto: [], proveedores: [], clientes: [], unidades: [], formas_pago: [] };
  rows.forEach(function (r) {
    const tipo = r[0], valor = r[1];
    if (out[tipo] && valor !== "") out[tipo].push(valor);
  });
  Object.keys(DEFAULT_CONFIG).forEach(function (k) {
    if (!out[k] || out[k].length === 0) out[k] = DEFAULT_CONFIG[k];
  });
  return out;
}

function findRowById_(sh, id) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function configExists_(sh, list, value) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(list) && String(data[i][1]) === String(value)) return true;
  }
  return false;
}

function movimientoToRow_(m) {
  const clienteProveedor = m.type === "ingreso" ? (m.client || "") : (m.provider || "");
  return [
    m.id,
    m.date,
    m.category,
    m.amount,
    m.person,
    clienteProveedor,
    m.invoice || "",
    (m.quantity === null || m.quantity === undefined || m.quantity === "") ? "" : m.quantity,
    m.unit || "",
    m.payment || "",
    m.note || ""
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
      movimientos: readMovimientos_(SHEET_INGRESOS, "ingreso").concat(readMovimientos_(SHEET_GASTOS, "gasto")),
      categorias: { ingreso: cfg.cat_ingreso, gasto: cfg.cat_gasto },
      proveedores: cfg.proveedores,
      clientes: cfg.clientes,
      unidades: cfg.unidades,
      formasPago: cfg.formas_pago
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
      const m = body.movimiento;
      const sheetName = m.type === "ingreso" ? SHEET_INGRESOS : SHEET_GASTOS;
      const sh = getSheet_(sheetName, MOV_HEADERS);
      if (findRowById_(sh, m.id) < 0) sh.appendRow(movimientoToRow_(m));

    } else if (action === "delete") {
      const sheetName = body.type === "ingreso" ? SHEET_INGRESOS : SHEET_GASTOS;
      const sh = getSheet_(sheetName, MOV_HEADERS);
      const rowIdx = findRowById_(sh, body.id);
      if (rowIdx > 0) sh.deleteRow(rowIdx);

    } else if (action === "config_add") {
      const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
      if (!configExists_(sh, body.list, body.value)) sh.appendRow([body.list, body.value]);

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
      // "resync_all" (borrar la planilla y reemplazarla con un celular) se
      // saco a proposito: podia borrar lo que cargaron los demas.
      return jsonOut_({ ok: false, error: "accion desconocida" });
    }
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
