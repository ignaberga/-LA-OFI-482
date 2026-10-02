// ============================================================
// STOCK DE BARES - Backend de Apps Script (una planilla por bar)
// ============================================================
// Que hace: convierte esta planilla en la base de datos de UN bar.
// La app le pide los datos (doGet) y le manda los cambios (doPost).
// Crea sola las hojas que necesita:
//   - "Conteos": cada producto contado, renglon por renglon.
//   - "Catalogo": los productos, en el orden en que se cuentan. Columnas:
//     Producto | Categoria (Barra/Cocina) | Grupo ("Top 10" si esta en el
//     Top 10; cualquier otra cosa o vacio = no) | Unidad | Familia
//     (Vermuts, Vinos...) | Contenido (750 cc, 1 l, 5 kg...).
//     El orden de las familias y de los productos en la app es el de
//     esta hoja.
//   - "Resumen": se arma sola despues de cada carga, con los productos
//     en filas y las fechas en columnas. No escribir a mano en ella.
//   - "Config": las unidades de medida y las cantidades (contenidos).
//   - "Cierres": los dias cuyo stock ya se cerro. Un stock cerrado no se
//     puede modificar; solo Noel lo puede reabrir.
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

// Quienes pueden reabrir un stock cerrado y borrar un dia. Tiene que
// coincidir con los permisos de la app (PERMISOS en stockbares/index.html).
const QUIEN_PUEDE_BORRAR = ["Noel"];
// Quienes pueden cerrar el stock de un dia.
const PUEDEN_CERRAR = ["Encargado", "Noel"];

const SHEET_CONTEOS = "Conteos";
const SHEET_CATALOGO = "Catálogo";
const SHEET_RESUMEN = "Resumen";
const SHEET_CONFIG = "Config";
const SHEET_CIERRES = "Cierres";

const CONTEO_HEADERS = ["ID","Fecha","Categoría","Grupo","Producto","Cantidad","Unidad","Persona","Nota","Cargado","Carga"];
const CATALOGO_HEADERS = ["Producto","Categoría","Grupo","Unidad","Familia","Contenido"];
const CONFIG_HEADERS = ["Tipo","Valor"];
const CIERRES_HEADERS = ["Fecha","Cerrado por","Cuándo"];

const DEFAULT_CONFIG = {
  unidades: ["Botellas","Kilos","Unidades"],
  cantidades: ["500 cc","700 cc","750 cc","1 l","1,5 l"]
};

// Cuantas fechas (las mas nuevas) se muestran en la hoja Resumen.
const RESUMEN_FECHAS = 20;
// En el Resumen, una baja mayor a esta parte del conteo anterior se marca
// con fondo rojo (0.3 = mas del 30 %).
const BAJA_FUERTE = 0.3;

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

// Las primeras pruebas guardaron "Bebidas" y "Comida". No se renombran en
// la planilla: se leen con el nombre nuevo.
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
      id: String(r[0]),
      fecha: formatDate_(r[1]),
      categoria: cat_(r[2]),
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
  return readRows_(SHEET_CATALOGO).filter(function (r) { return String(r[0]).trim() !== ""; }).map(function (r) {
    return {
      nombre: String(r[0]).trim(),
      categoria: cat_(String(r[1] || "").trim()),
      grupo: /^top\s*10$/i.test(String(r[2] || "").trim()) ? "Top 10" : "Resto",
      unidad: String(r[3] || "").trim(),
      familia: String(r[4] === undefined ? "" : r[4]).trim(),
      contenido: String(r[5] === undefined ? "" : r[5]).trim()
    };
  });
}

// Las planillas armadas antes tienen 4 columnas en Catalogo: se agregan
// los titulos Familia y Contenido (sin tocar ningun dato).
function ensureCatalogoHeaders_() {
  const sh = ss_().getSheetByName(SHEET_CATALOGO);
  if (!sh) return;
  const fila = sh.getRange(1, 1, 1, CATALOGO_HEADERS.length).getValues()[0];
  if (fila.some(function (v, i) { return String(v) !== CATALOGO_HEADERS[i]; })) {
    sh.getRange(1, 1, 1, CATALOGO_HEADERS.length).setValues([CATALOGO_HEADERS]).setFontWeight("bold");
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

function ahora_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

// Una lista de Config (unidades o cantidades). Si no tiene nada, las de arranque.
function readLista_(tipo) {
  const out = [];
  readRows_(SHEET_CONFIG).forEach(function (r) {
    if (String(r[0]) === tipo && r[1] !== "") out.push(String(r[1]));
  });
  return out.length ? out : (DEFAULT_CONFIG[tipo] || []);
}

// La primera vez que se cambia una lista, se guardan las de arranque.
function ensureLista_(tipo) {
  const sh = getSheet_(SHEET_CONFIG, CONFIG_HEADERS);
  const tiene = readRows_(SHEET_CONFIG).some(function (r) { return String(r[0]) === tipo; });
  if (!tiene) (DEFAULT_CONFIG[tipo] || []).forEach(function (v) { sh.appendRow([tipo, v]); });
  return sh;
}

// Borra las filas cuya columna col coincide, de abajo hacia arriba y en
// tramos seguidos para que sea rapido.
function deleteRowsWhere_(sh, col, value) {
  deleteRowsIf_(sh, function (r) { return String(r[col]) === String(value); });
}

// Borra las filas de una fecha (la columna col tiene fechas).
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
  return [
    c.id, c.fecha, c.categoria || "", c.grupo || "", c.producto, c.cantidad,
    c.unidad || "", c.persona || "", c.nota || "", c.cargado || "", c.carga || c.id
  ];
}

// Arma la hoja Resumen: productos en filas y, por cada fecha (la mas
// nueva primero), lo contado y la diferencia contra el conteo anterior de
// ese producto. Las bajas se pintan de rojo; las bajas fuertes (mas de
// BAJA_FUERTE del conteo anterior) llevan ademas fondo rojo. Si un producto
// se conto dos veces el mismo dia, vale el ultimo. Es solo una vista: los
// datos de verdad estan en Conteos.
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
  // Barra primero y despues Cocina; adentro, las familias y los productos en
  // el orden de la hoja Catalogo.
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

  // El conteo anterior de un producto a una fecha (aunque no sea la columna de al lado).
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

function doGet(e) {
  ensureCatalogoHeaders_();
  const action = (e && e.parameter && e.parameter.action) || "get_all";
  if (action === "get_all") {
    return jsonOut_({
      conteos: readConteos_(),
      productos: readCatalogo_(),
      unidades: readLista_("unidades"),
      cantidades: readLista_("cantidades"),
      cierres: readCierres_(),
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
      const cerradas = fechasCerradas_();
      if ((body.conteos || []).some(function (c) { return c && cerradas[c.fecha]; })) {
        return jsonOut_({ ok: false, error: "el stock de ese dia esta cerrado", descartar: true });
      }
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

    } else if (action === "cerrar") {
      if (PUEDEN_CERRAR.indexOf(String(body.quien)) < 0) {
        return jsonOut_({ ok: false, error: "sin permiso para cerrar", descartar: true });
      }
      if (!fechasCerradas_()[body.fecha]) {
        getSheet_(SHEET_CIERRES, CIERRES_HEADERS).appendRow([body.fecha, body.quien, ahora_()]);
        rebuildResumen_();
      }

    } else if (action === "reabrir") {
      if (QUIEN_PUEDE_BORRAR.indexOf(String(body.quien)) < 0) {
        return jsonOut_({ ok: false, error: "sin permiso para reabrir", descartar: true });
      }
      deleteRowsDeFecha_(getSheet_(SHEET_CIERRES, CIERRES_HEADERS), 0, body.fecha);
      rebuildResumen_();

    } else if (action === "delete_dia") {
      if (QUIEN_PUEDE_BORRAR.indexOf(String(body.quien)) < 0) {
        return jsonOut_({ ok: false, error: "sin permiso para borrar", descartar: true });
      }
      deleteRowsDeFecha_(getSheet_(SHEET_CONTEOS, CONTEO_HEADERS), 1, body.fecha);
      deleteRowsDeFecha_(getSheet_(SHEET_CIERRES, CIERRES_HEADERS), 0, body.fecha);
      rebuildResumen_();

    } else if (action === "replace_carga") {
      // Corrige una carga: saca sus renglones y pone los corregidos (con el
      // mismo numero de carga). Repetirlo deja el mismo resultado.
      if (QUIEN_PUEDE_BORRAR.indexOf(String(body.quien)) < 0) {
        return jsonOut_({ ok: false, error: "sin permiso para editar", descartar: true });
      }
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
      const sh = getSheet_(SHEET_CATALOGO, CATALOGO_HEADERS);
      ensureCatalogoHeaders_();
      const row = [p.nombre, p.categoria || "Barra", p.grupo === "Top 10" ? "Top 10" : "Resto", p.unidad || "", p.familia || "", p.contenido || ""];
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
