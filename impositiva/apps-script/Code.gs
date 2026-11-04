// ============================================================
// PLANILLA IMPOSITIVA (una planilla de Google por empresa)
// ============================================================
// Ventas, DDJJ de IVA, Ingresos Brutos y Comercio e Industria de cada
// mes, y los asientos que salen de ahi, listos para importar en Onvio.
//
// Hojas (se crean solas con el menu "Impositiva"):
//   - "Datos": razon social, CUIT, ejercicio, si se le hace estado de
//     resultados, actividades de IIBB, rubros de Comercio e Industria y
//     que cuenta del plan usa cada renglon de los asientos.
//   - "MM-AAAA" (una por mes, ej. "10-2026"): lo que se carga cada mes.
//     Celdas amarillas = se cargan; el resto son formulas. Las alicuotas,
//     minimos y fijos pasan solos al mes siguiente (y se pueden cambiar).
//     Los saldos a favor tambien pasan solos; el primer mes se cargan a
//     mano (vienen de la DDJJ anterior).
//   - "Asientos": los 4 asientos de cada mes (Ventas, IVA, IIBB y CEI),
//     con formulas: se arman solos mientras se carga el mes.
//   - "Otros asientos": compensaciones, pagos, etc. Se cargan a mano y
//     se suman a la exportacion.
//   - "Asientos a importar": lo ultimo que se exporto, en el formato de
//     Onvio.
//   - "Plan de cuentas": el de Onvio de la empresa (se pega tal cual y se
//     ordena con el menu).
//   - "Exportaciones": que meses se exportaron, cuando y quien.
//
// Menu "Impositiva":
//   - Agregar el mes siguiente.
//   - Exportar asientos para Onvio: elige desde/hasta, controla que todo
//     cierre y guarda el Excel en la carpeta "Asientos para Onvio" (al
//     lado de la planilla), con el link para bajarlo.
//   - Ordenar el plan de cuentas, Sugerir las cuentas de los asientos,
//     Rearmar la hoja Asientos, Armar la planilla (primera vez).
//
// COMO INSTALARLO EN UNA EMPRESA NUEVA:
// 1. En la carpeta compartida: Nuevo > Hojas de calculo de Google. Ponerle
//    de nombre "Impositiva <Empresa>".
// 2. Extensiones > Apps Script. Borrar lo que haya, pegar este archivo
//    completo y guardar (icono del disquete).
// 3. Volver a la planilla y recargar la pagina. Aparece el menu
//    "Impositiva" (tarda unos segundos).
// 4. Impositiva > Armar la planilla (primera vez). La primera vez Google
//    pide permiso: Revisar permisos > elegir la cuenta > Configuracion
//    avanzada > Ir a ... (no seguro) > Permitir. Pregunta el primer mes.
// 5. En "Plan de cuentas" pegar el plan bajado de Onvio (nombre y codigo)
//    y usar Impositiva > Ordenar el plan de cuentas y despues
//    Impositiva > Sugerir las cuentas de los asientos. Revisar en Datos
//    las cuentas elegidas (las vacias se eligen de la lista).
// 6. Completar Datos (actividades, rubros) y cargar el primer mes con los
//    saldos de la DDJJ anterior.
//
// Para actualizar el codigo: pegar este archivo de nuevo en Apps Script de
// cada planilla y guardar. Los datos cargados no se tocan.
// Copia de respaldo: impositiva/apps-script/Code.gs del repositorio (sin
// datos de clientes: el repositorio es publico).
// ============================================================

var HOJA_DATOS = 'Datos';
var HOJA_PLAN = 'Plan de cuentas';
var HOJA_ASIENTOS = 'Asientos';
var HOJA_OTROS = 'Otros asientos';
var HOJA_IMPORTAR = 'Asientos a importar';
var HOJA_EXPORT = 'Exportaciones';
var CARPETA_ONVIO = 'Asientos para Onvio';

var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
  'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

var COLOR = {
  titulo: '#1f4e78', seccion: '#2e75b6', cabecera: '#d9e1f2',
  carga: '#fff2cc', resultado: '#e2efda', total: '#f2f2f2', mes: '#bdd7ee'
};
var FMT_PESOS = '#,##0.00;-#,##0.00;"-"';
var FMT_FECHA = 'dd/mm/yyyy';

var ENCABEZADO_ONVIO = ['Número de asiento', 'Número de Pase', 'Fecha',
  'Concepto', 'Código de cuenta', 'Importe en moneda local',
  'Importe en moneda ext.present.', 'Leyenda', 'Código de centro de costos',
  'Porcentaje de distribución', 'Imp.mon.local dist.C.Costos',
  'Imp.mon.present.dist.C.Costos'];

// ---------- Hoja Datos: renglones ----------
var D_RAZON = 3, D_CUIT = 4, D_INICIO = 5, D_CIERRE = 6, D_ER = 7, D_TOL = 8;
var D_ACT = 12;   // actividades IIBB: 10 renglones (12 a 21)
var D_RUB = 25;   // rubros CEI: 10 renglones (25 a 34)
var D_CTA = 38;   // cuentas de los asientos (38 a 57)
var N_ACT = 10, N_RUB = 10;

// Renglones de los asientos: clave, texto, nombres posibles en el plan
// (para "Sugerir las cuentas"; se comparan sin tildes ni mayusculas) y
// con que numero empieza el codigo (1 activo, 2 pasivo, 4 resultados).
var CUENTAS = [
  ['deudores', 'Ventas – Deudores por ventas', ['deudores por ventas', 'deudores locales'], '1'],
  ['iva_df', 'Ventas e IVA – IVA Débito Fiscal', ['iva debito fiscal'], '2'],
  ['ventas', 'Ventas – Ventas', ['ventas mercaderias', 'ventas mercaderias a', 'ventas'], '4'],
  ['iva_cf', 'IVA – IVA Crédito Fiscal', ['iva credito fiscal'], '1'],
  ['iva_suss', 'IVA – IVA Crédito SUSS', ['iva credito suss', 'iva credito sus'], '1'],
  ['iva_st', 'IVA – Saldo a favor técnico', ['iva saldo a favor tecnico', 'saldo tecnico a favor'], '1'],
  ['iva_ret', 'IVA – Retenciones de IVA', ['retenciones de iva'], '1'],
  ['iva_perc', 'IVA – Percepciones de IVA', ['percepciones de iva'], '1'],
  ['iva_sld', 'IVA – Saldo de libre disponibilidad', ['iva saldo a favor de libre disponibilidad', 'saldo de libre disponibilidad'], '1'],
  ['iva_pagar', 'IVA – IVA a pagar', ['iva a pagar'], '2'],
  ['iibb', 'IIBB – Impuesto a los Ingresos Brutos (gasto)', ['impuesto a los ingresos brutos'], '4'],
  ['iibb_ret', 'IIBB – Retenciones', ['retenciones impto. a los iibb', 'retenciones impto a los iibb', 'retenciones de ingresos brutos'], '1'],
  ['iibb_perc', 'IIBB – Percepciones', ['percepciones impto. a los iibb', 'percepciones impto a los iibb', 'percepciones de ingresos brutos'], '1'],
  ['iibb_rec', 'IIBB – Recaudaciones bancarias', ['recaudaciones bcias. impto. a los iibb', 'recaudaciones bancarias impto. a los iibb'], '1'],
  ['iibb_sf', 'IIBB – Saldo a favor', ['iibb saldo a favor', 'saldo a favor iibb'], '1'],
  ['iibb_pagar', 'IIBB – Ingresos Brutos a pagar', ['impuesto a los ingresos brutos a pagar'], '2'],
  ['cei', 'CEI – Comercio e Industria (gasto)', ['tasa comercio e industria', 'comercio e industria'], '4'],
  ['cei_perc', 'CEI – Percepciones', ['percepciones comercio e industria'], '1'],
  ['cei_sf', 'CEI – Saldo a favor', ['saldo a favor comercio e industria'], '1'],
  ['cei_pagar', 'CEI – Comercio e Industria a pagar', ['tasa comercio e industria a pagar', 'comercio e industria a pagar'], '2']
];

// ---------- Hoja del mes: celdas ----------
// Ventas: filas 6-10, total 11 (D neto, E IVA, F total).
// IVA: compras 15-17, total 18, SUSS 19, liquidacion 22-35 (columna E).
// IIBB: actividades 39-48, liquidacion 49-60 (columna F).
// CEI: rubros 64-73, liquidacion 74-87 (columna G).
// Ventas reales: 89-98.
var M_SALDOS_ANT = ['E25', 'E31', 'F56', 'G83'];  // vienen del mes anterior
var M_SALDOS_DE = ['E27', 'E35', 'F60', 'G87'];   // lo que pasa al siguiente
// Lo que pasa al mes siguiente tal cual (se puede cambiar en cada mes).
var M_PARAMETROS = ['C19', 'E39:E48', 'F50', 'E64:F73', 'G75', 'F77:F78', 'G79'];
var M_CARGA = ['E6:E9', 'D10', 'J6:K7', 'E15:E17', 'C19:D19', 'E29:E30', 'E32',
  'J15:K16', 'J22:J24', 'D40:D48', 'E39:E48', 'F50:F51', 'F53:F55', 'F57',
  'J40:J41', 'D65:D73', 'E64:F73', 'G75', 'F77:F78', 'G79:G80', 'G82', 'G84',
  'J65:J66', 'E90'];
var M_VREALES = [89, 98];

// Asientos de cada mes. Tipo: D = debe, H = haber, ± = debe si es
// positivo, haber si es negativo. {M} = hoja del mes.
var ASIENTOS = [
  { n: 1, concepto: 'VENTAS MENSUALES', mes: false, lineas: [
    ['deudores', 'D', 'ROUND({M}D11,2)+ROUND({M}E11,2)'],
    ['iva_df', 'H', 'ROUND({M}E11,2)'],
    ['ventas', 'H', 'ROUND({M}D11,2)']] },
  { n: 2, concepto: 'DDJJ IVA ', mes: true, lineas: [
    ['iva_df', 'D', '{M}E22'],
    ['iva_cf', 'H', '{M}E23'],
    ['iva_suss', 'H', '{M}E24'],
    ['iva_st', '±', '{M}E27-{M}E25'],
    ['iva_ret', 'H', '{M}E29'],
    ['iva_perc', 'H', '{M}E30'],
    ['iva_sld', '±', '{M}E35-{M}E33'],
    ['iva_pagar', 'H', '{M}E34']] },
  { n: 3, concepto: 'DDJJ IIBB ', mes: true, lineas: [
    ['iibb', 'D', '{M}F52'],
    ['iibb_ret', 'H', '{M}F53'],
    ['iibb_perc', 'H', '{M}F54'],
    ['iibb_rec', 'H', '{M}F55'],
    ['iibb_sf', '±', '{M}F60-{M}F58'],
    ['iibb_pagar', 'H', '{M}F59']] },
  { n: 4, concepto: 'DDJJ CEI ', mes: true, lineas: [
    ['cei', 'D', '{M}G81'],
    ['cei_perc', 'H', '{M}G82'],
    ['cei_sf', '±', '{M}G87-{M}G85'],
    ['cei_pagar', 'H', '{M}G86']] }
];

// ============================================================
// MENU
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Impositiva')
    .addItem('Agregar el mes siguiente', 'agregarMes')
    .addItem('Exportar asientos para Onvio…', 'abrirExportar')
    .addSeparator()
    .addItem('Ordenar el plan de cuentas (después de pegarlo)', 'ordenarPlan')
    .addItem('Sugerir las cuentas de los asientos', 'sugerirCuentas')
    .addItem('Rearmar la hoja Asientos', 'rearmarAsientos')
    .addSeparator()
    .addItem('Armar la planilla (primera vez)', 'armarPlanilla')
    .addToUi();
}

// Al cambiar en Datos si se le hace estado de resultados, se muestran u
// ocultan las Ventas reales de todos los meses.
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== HOJA_DATOS || e.range.getRow() > D_ER || e.range.getLastRow() < D_ER ||
      e.range.getColumn() > 3 || e.range.getLastColumn() < 3) return;
  mostrarVentasReales_(e.source);
}

function conVentasReales_(ss) {
  var v = normal_(ss.getSheetByName(HOJA_DATOS).getRange('C' + D_ER).getValue());
  return v === 'si';
}

function mostrarVentasReales_(ss) {
  var si = conVentasReales_(ss);
  listarMeses_(ss).forEach(function (m) {
    if (si) m.hoja.showRows(M_VREALES[0], M_VREALES[1] - M_VREALES[0] + 1);
    else m.hoja.hideRows(M_VREALES[0], M_VREALES[1] - M_VREALES[0] + 1);
  });
}

function armarPlanilla() {
  var ss = SpreadsheetApp.getActive();
  asegurarHojas_(ss);
  var vacia = ss.getSheets().filter(function (s) {
    return /^(Hoja|Sheet) ?1$/.test(s.getName()) && s.getLastRow() === 0;
  });
  vacia.forEach(function (s) { ss.deleteSheet(s); });
  if (!listarMeses_(ss).length) agregarMes();
  SpreadsheetApp.getUi().alert('Planilla lista',
    'Ahora:\n1. Pegá el plan de cuentas de Onvio en la hoja "Plan de cuentas" y usá ' +
    'Impositiva > Ordenar el plan de cuentas.\n2. Impositiva > Sugerir las cuentas de los asientos, ' +
    'y revisá en Datos las cuentas elegidas.\n3. Completá Datos (actividades y rubros).\n' +
    '4. Cargá el primer mes, con los saldos que vienen de la DDJJ anterior.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================
// HOJAS FIJAS
// ============================================================
function asegurarHojas_(ss) {
  var antes = ss.getSheets().length;
  if (!ss.getSheetByName(HOJA_PLAN)) armarPlan_(ss.insertSheet(HOJA_PLAN));
  if (!ss.getSheetByName(HOJA_DATOS)) armarDatos_(ss.insertSheet(HOJA_DATOS, 0));
  if (!ss.getSheetByName(HOJA_ASIENTOS)) ss.insertSheet(HOJA_ASIENTOS);
  if (!ss.getSheetByName(HOJA_OTROS)) armarOtros_(ss.insertSheet(HOJA_OTROS));
  if (!ss.getSheetByName(HOJA_IMPORTAR)) armarImportar_(ss.insertSheet(HOJA_IMPORTAR));
  if (!ss.getSheetByName(HOJA_EXPORT)) armarExportaciones_(ss.insertSheet(HOJA_EXPORT));
  if (ss.getSheets().length === antes) return;
  // Orden: Datos, meses, Asientos, Otros, A importar, Plan, Exportaciones.
  var orden = [HOJA_ASIENTOS, HOJA_OTROS, HOJA_IMPORTAR, HOJA_PLAN, HOJA_EXPORT];
  orden.forEach(function (n) {
    ss.setActiveSheet(ss.getSheetByName(n));
    ss.moveActiveSheet(ss.getSheets().length);
  });
  ss.setActiveSheet(ss.getSheetByName(HOJA_DATOS));
  ss.moveActiveSheet(1);
}

function armarDatos_(sh) {
  var g = grilla_(D_CTA + CUENTAS.length, 6);
  pone_(g, 'B1', 'DATOS DE LA EMPRESA');
  pone_(g, 'B' + D_RAZON, 'Razón social');
  pone_(g, 'B' + D_CUIT, 'CUIT');
  pone_(g, 'B' + D_INICIO, 'Inicio del ejercicio (ej. 01/07/2025)');
  pone_(g, 'B' + D_CIERRE, 'Cierre del ejercicio');
  pone_(g, 'C' + D_CIERRE, '=IF(C' + D_INICIO + '="","",EDATE(C' + D_INICIO + ',12)-1)');
  pone_(g, 'B' + D_ER, '¿Le hacemos estado de resultados? (muestra Ventas reales)');
  pone_(g, 'C' + D_ER, 'No');
  pone_(g, 'B' + D_TOL, 'Diferencia aceptada contra el Portal IVA ($)');
  pone_(g, 'C' + D_TOL, 10);
  pone_(g, 'B' + (D_ACT - 2), 'ACTIVIDADES DE INGRESOS BRUTOS (la alícuota se pone en cada mes)');
  pone_(g, 'B' + (D_ACT - 1), 'Código');
  pone_(g, 'C' + (D_ACT - 1), 'Descripción');
  pone_(g, 'B' + (D_RUB - 2), 'RUBROS DE COMERCIO E INDUSTRIA (la alícuota se pone en cada mes)');
  pone_(g, 'B' + (D_RUB - 1), 'Código');
  pone_(g, 'C' + (D_RUB - 1), 'Descripción');
  pone_(g, 'B' + (D_CTA - 2), 'CUENTAS DE LOS ASIENTOS (se eligen del plan de cuentas, una sola vez)');
  pone_(g, 'B' + (D_CTA - 1), 'Renglón del asiento');
  pone_(g, 'C' + (D_CTA - 1), 'Cuenta del plan');
  pone_(g, 'D' + (D_CTA - 1), 'Código');
  pone_(g, 'E' + (D_CTA - 1), 'Código para Onvio');
  var plan = "'" + HOJA_PLAN + "'!$A:$C";
  CUENTAS.forEach(function (c, i) {
    var r = D_CTA + i;
    pone_(g, 'B' + r, c[1]);
    pone_(g, 'D' + r, '=IF(C' + r + '="","",IFERROR(VLOOKUP(C' + r + ',' + plan + ',2,FALSE),"✘ No está en el plan"))');
    pone_(g, 'E' + r, '=IF(C' + r + '="","",IFERROR(VLOOKUP(C' + r + ',' + plan + ',3,FALSE),""))');
  });
  sh.getRange(1, 1, g.length, g[0].length).setValues(g);

  sh.setColumnWidth(1, 20);
  sh.setColumnWidth(2, 420);
  sh.setColumnWidth(3, 380);
  sh.setColumnWidth(4, 120);
  sh.setColumnWidth(5, 130);
  sh.getRange('B1:E1').merge().setFontSize(14).setFontWeight('bold')
    .setBackground(COLOR.titulo).setFontColor('#ffffff');
  sh.getRangeList(['B' + (D_ACT - 2) + ':E' + (D_ACT - 2), 'B' + (D_RUB - 2) + ':E' + (D_RUB - 2),
    'B' + (D_CTA - 2) + ':E' + (D_CTA - 2)])
    .setBackground(COLOR.seccion).setFontColor('#ffffff').setFontWeight('bold');
  sh.getRangeList(['B' + (D_ACT - 1) + ':C' + (D_ACT - 1), 'B' + (D_RUB - 1) + ':C' + (D_RUB - 1),
    'B' + (D_CTA - 1) + ':E' + (D_CTA - 1)])
    .setBackground(COLOR.cabecera).setFontWeight('bold');
  var carga = ['C' + D_RAZON + ':C' + D_INICIO, 'C' + D_ER + ':C' + D_TOL,
    'B' + D_ACT + ':C' + (D_ACT + N_ACT - 1), 'B' + D_RUB + ':C' + (D_RUB + N_RUB - 1),
    'C' + D_CTA + ':C' + (D_CTA + CUENTAS.length - 1)];
  sh.getRangeList(carga).setBackground(COLOR.carga);
  sh.getRange('C' + D_INICIO + ':C' + D_CIERRE).setNumberFormat(FMT_FECHA).setHorizontalAlignment('left');
  sh.getRange('C' + D_TOL).setNumberFormat(FMT_PESOS).setHorizontalAlignment('left');
  sh.getRange('C' + D_ER).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Sí', 'No'], true).build());
  sh.getRange('B' + D_ACT + ':B' + (D_ACT + N_ACT - 1)).setNumberFormat('@');
  sh.getRange('B' + D_RUB + ':B' + (D_RUB + N_RUB - 1)).setNumberFormat('@');
  sh.getRange('C' + D_CTA + ':C' + (D_CTA + CUENTAS.length - 1)).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(sh.getParent().getSheetByName(HOJA_PLAN).getRange('A2:A3000'), true)
      .setAllowInvalid(true).build());
  reglasEstado_(sh, ['D' + D_CTA + ':D' + (D_CTA + CUENTAS.length - 1)]);
  sh.setFrozenRows(1);
}

function armarPlan_(sh) {
  sh.getRange('A1:C1').setValues([['Cuenta', 'Código', 'Código para Onvio']])
    .setFontWeight('bold').setBackground(COLOR.cabecera);
  sh.getRange('A1').setNote('Pegá acá el plan de cuentas bajado de Onvio (nombre y código, ' +
    'en cualquier orden) y después usá Impositiva > Ordenar el plan de cuentas.');
  sh.setColumnWidth(1, 380);
  sh.setColumnWidth(2, 130);
  sh.setColumnWidth(3, 140);
  sh.setFrozenRows(1);
}

function armarOtros_(sh) {
  var n = 500;
  var g = grilla_(n + 1, 10);
  g[0] = ['Fecha', 'Nº', 'Concepto', 'Cuenta', 'Código', 'Debe', 'Haber', 'Leyenda', 'Control', 'Código Onvio'];
  var plan = "'" + HOJA_PLAN + "'!$A:$C";
  for (var r = 2; r <= n + 1; r++) {
    g[r - 1][4] = '=IF(D' + r + '="","",IFERROR(VLOOKUP(D' + r + ',' + plan + ',2,FALSE),"✘ No está en el plan"))';
    g[r - 1][8] = '=IF(B' + r + '="","",IF(ABS(SUMIF($B$2:$B$' + (n + 1) + ',B' + r + ',$F$2:$F$' + (n + 1) +
      ')-SUMIF($B$2:$B$' + (n + 1) + ',B' + r + ',$G$2:$G$' + (n + 1) + '))<0.005,"✔ Cierra","✘ No cierra"))';
    g[r - 1][9] = '=IF(D' + r + '="","",IFERROR(VLOOKUP(D' + r + ',' + plan + ',3,FALSE),""))';
  }
  sh.getRange(1, 1, g.length, 10).setValues(g);
  sh.getRange('A1:J1').setFontWeight('bold').setBackground(COLOR.cabecera);
  sh.getRange('A1').setNote('Compensaciones, pagos y cualquier otro asiento. Los renglones del mismo ' +
    'asiento llevan el mismo Nº (1, 2, 3…). Al exportar se incluyen los de las fechas elegidas.');
  sh.getRange('A2:A' + (n + 1)).setNumberFormat(FMT_FECHA);
  sh.getRange('F2:G' + (n + 1)).setNumberFormat(FMT_PESOS);
  sh.getRangeList(['A2:D' + (n + 1), 'F2:H' + (n + 1)]).setBackground(COLOR.carga);
  sh.getRange('D2:D' + (n + 1)).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(sh.getParent().getSheetByName(HOJA_PLAN).getRange('A2:A3000'), true)
    .setAllowInvalid(true).build());
  [90, 50, 240, 300, 110, 120, 120, 220, 100].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.hideColumns(10);
  reglasEstado_(sh, ['I2:I' + (n + 1), 'E2:E' + (n + 1)]);
  sh.setFrozenRows(1);
}

function armarImportar_(sh) {
  sh.getRange(1, 1, 1, 12).setValues([ENCABEZADO_ONVIO]).setFontWeight('bold').setBackground(COLOR.cabecera);
  sh.getRange('A1').setNote('Esta hoja la llena Impositiva > Exportar asientos para Onvio. ' +
    'No hace falta tocarla.');
  sh.setFrozenRows(1);
}

function armarExportaciones_(sh) {
  sh.getRange('A1:F1').setValues([['Fecha', 'Quién', 'Desde', 'Hasta', 'Asientos', 'Archivo']])
    .setFontWeight('bold').setBackground(COLOR.cabecera);
  sh.getRange('C:D').setNumberFormat('@');
  sh.setColumnWidth(1, 140);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(6, 420);
  sh.setFrozenRows(1);
}

// ============================================================
// MESES
// ============================================================
function listarMeses_(ss) {
  return ss.getSheets().map(function (s) {
    var m = /^(\d{2})-(\d{4})$/.exec(s.getName());
    return m ? { nombre: s.getName(), hoja: s, orden: +m[2] * 12 + (+m[1] - 1) } : null;
  }).filter(function (x) { return x && +x.nombre.slice(0, 2) >= 1 && +x.nombre.slice(0, 2) <= 12; })
    .sort(function (a, b) { return a.orden - b.orden; });
}

function mesSiguiente_(nombre) {
  var m = +nombre.slice(0, 2), a = +nombre.slice(3);
  m++;
  if (m > 12) { m = 1; a++; }
  return (m < 10 ? '0' : '') + m + '-' + a;
}

function agregarMes() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  asegurarHojas_(ss);
  var meses = listarMeses_(ss);
  var nombre, prev = null;
  if (!meses.length) {
    var r = ui.prompt('Primer mes', '¿Desde qué mes empezás a usar la planilla? Escribilo así: 10-2026',
      ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    nombre = String(r.getResponseText()).trim().replace('/', '-');
    if (/^\d-\d{4}$/.test(nombre)) nombre = '0' + nombre;
    if (!/^(0[1-9]|1[0-2])-\d{4}$/.test(nombre)) {
      ui.alert('No entendí el mes. Escribilo así: 10-2026');
      return;
    }
  } else {
    prev = meses[meses.length - 1];
    nombre = mesSiguiente_(prev.nombre);
  }
  if (ss.getSheetByName(nombre)) {
    ui.alert('La hoja ' + nombre + ' ya existe.');
    return;
  }
  var pos = prev ? prev.hoja.getIndex() : ss.getSheetByName(HOJA_DATOS).getIndex();
  var sh = ss.insertSheet(nombre, pos);
  armarHojaMes_(ss, sh, nombre, prev ? prev.hoja : null);
  rearmarAsientos_(ss);
  ss.setActiveSheet(sh);
  ss.toast('Listo el mes ' + nombre + '. Pasaron las alícuotas, mínimos y saldos del mes anterior.',
    'Impositiva', 6);
}

function armarHojaMes_(ss, sh, nombre, prevSh) {
  var D = "'" + HOJA_DATOS + "'!";
  var g = grilla_(M_VREALES[1], 12);
  var p = function (a1, v) { pone_(g, a1, v); };
  var mes = +nombre.slice(0, 2), anio = +nombre.slice(3);

  // Encabezado
  p('B1', '=' + D + 'C' + D_RAZON);
  p('B2', 'Período');
  p('C2', new Date(anio, mes - 1, 1));
  var ini = D + '$C$' + D_INICIO;
  p('I2', '=IF(COUNTIF(L4:L70,"✘*")=0,"✔ Controles sin diferencias","✘ Hay "&COUNTIF(L4:L70,"✘*")&" control(es) con diferencias")');

  // 1. VENTAS
  p('B4', '1. VENTAS (libro IVA ventas, ya restadas las notas de crédito)');
  ['Comprobante', 'Alícuota', 'Neto', 'IVA', 'Total'].forEach(function (t, i) { p(col_(2 + i) + '5', t); });
  var ventas = [['Factura A (Responsable Inscripto)', 0.21], ['Factura A (Responsable Inscripto)', 0.105],
    ['Factura B (Consumidor Final)', 0.21], ['Factura B (Consumidor Final)', 0.105]];
  ventas.forEach(function (v, i) {
    var r = 6 + i;
    p('B' + r, v[0]); p('C' + r, v[1]);
    p('D' + r, '=E' + r + '/C' + r);
    p('F' + r, '=D' + r + '+E' + r);
  });
  p('B10', 'Exento / No gravado'); p('F10', '=D10+E10');
  p('B11', 'Total ventas'); p('D11', '=SUM(D6:D10)'); p('E11', '=SUM(E6:E10)'); p('F11', '=SUM(F6:F10)');
  // Control Portal IVA ventas
  p('I4', 'Control con Portal IVA (ventas)'); p('J5', 'IVA'); p('K5', 'Neto');
  p('I6', 'Ventas'); p('I7', 'Notas de crédito');
  p('I8', 'Ventas − notas de crédito'); p('J8', '=J6-J7'); p('K8', '=K6-K7');
  p('I9', 'Diferencia (portal − planilla)'); p('J9', '=J8-E11'); p('K9', '=K8-(D11-D10)');
  p('L9', '=IF(AND(J6="",K6=""),"– Sin cargar",IF(AND(ABS(J9)<=' + D + '$C$' + D_TOL + ',ABS(K9)<=' + D + '$C$' + D_TOL +
    '),"✔ Coincide","✘ No coincide"))');

  // 2. IVA
  p('B13', '2. IVA');
  ['Crédito fiscal (compras, ya restadas las notas de crédito)', 'Alícuota', 'Neto', 'IVA'].forEach(function (t, i) {
    p(col_(2 + i) + '14', t);
  });
  [['Compras 10,5 %', 0.105], ['Compras 21 %', 0.21], ['Compras 27 %', 0.27]].forEach(function (v, i) {
    var r = 15 + i;
    p('B' + r, v[0]); p('C' + r, v[1]); p('D' + r, '=E' + r + '/C' + r);
  });
  p('B18', 'Total compras'); p('D18', '=SUM(D15:D17)'); p('E18', '=SUM(E15:E17)');
  p('B19', 'Crédito SUSS: Remuneración 10 del F.931 (en Neto) × alícuota'); p('C19', 0.0145);
  p('E19', '=ROUND(D19*C19,2)');
  p('B21', 'Liquidación');
  var liq = [
    [22, 'Débito fiscal', '=ROUND(E11,2)'],
    [23, 'Crédito fiscal', '=ROUND(E18,2)'],
    [24, 'Crédito SUSS', '=E19'],
    [25, 'Saldo técnico a favor del mes anterior', null],
    [26, 'Saldo técnico del mes', '=E22-E23-E24-E25'],
    [27, 'SALDO TÉCNICO A FAVOR (pasa al mes siguiente)', '=MAX(ROUND(-E26,2),0)'],
    [28, 'Impuesto determinado', '=MAX(ROUND(E26,2),0)'],
    [29, 'Retenciones de IVA', null],
    [30, 'Percepciones de IVA', null],
    [31, 'Saldo de libre disponibilidad del mes anterior', null],
    [32, '− Compensado (usado para pagar otro impuesto)', null],
    [33, 'Libre disponibilidad que queda para usar', '=E31-E32'],
    [34, 'IVA A PAGAR', '=MAX(ROUND(E28-E29-E30-E33,2),0)'],
    [35, 'SALDO DE LIBRE DISPONIBILIDAD A FAVOR (pasa al mes siguiente)', '=MAX(ROUND(E29+E30+E33-E28,2),0)']];
  liq.forEach(function (x) { p('B' + x[0], x[1]); if (x[2]) p('E' + x[0], x[2]); });
  p('F31', '=IF(E31>0,"⚠ ¿Se compensó? Si se usó, poné cuánto abajo y cargá el asiento en Otros asientos.","")');
  // Controles IVA
  p('I13', 'Control con Portal IVA (compras)'); p('J14', 'IVA'); p('K14', 'Neto');
  p('I15', 'Compras'); p('I16', 'Notas de crédito');
  p('I17', 'Compras − notas de crédito'); p('J17', '=J15-J16'); p('K17', '=K15-K16');
  p('I18', 'Diferencia (portal − planilla)'); p('J18', '=J17-E18'); p('K18', '=K17-D18');
  p('L18', '=IF(AND(J15="",K15=""),"– Sin cargar",IF(AND(ABS(J18)<=' + D + '$C$' + D_TOL + ',ABS(K18)<=' + D + '$C$' + D_TOL +
    '),"✔ Coincide","✘ No coincide"))');
  p('I20', 'Control con la DDJJ de IVA presentada'); p('J21', 'Según DDJJ'); p('K21', 'Diferencia');
  [[22, 'IVA a pagar', 'E34'], [23, 'Saldo técnico a favor', 'E27'], [24, 'Libre disponibilidad a favor', 'E35']]
    .forEach(function (x) { ctlDDJJ_(p, x[0], x[1], x[2]); });

  // 3. INGRESOS BRUTOS
  p('B37', '3. INGRESOS BRUTOS');
  ['Actividad', 'Código', 'Base imponible', 'Alícuota', 'Impuesto'].forEach(function (t, i) { p(col_(2 + i) + '38', t); });
  for (var i = 0; i < N_ACT; i++) {
    var r = 39 + i, rd = D_ACT + i;
    p('B' + r, i === 0
      ? '=IF(' + D + 'C' + rd + '="","Actividad 1 (completala en Datos)",' + D + 'C' + rd + ')'
      : '=' + D + 'C' + rd + '&""');
    p('C' + r, '=' + D + 'B' + rd + '&""');
    p('F' + r, '=D' + r + '*E' + r);
  }
  p('D39', '=D11-SUM(D40:D48)');
  var iibb = [
    [49, 'Total actividades', '=SUM(F39:F48)'],
    [50, 'Impuesto mínimo', null],
    [51, 'Ajuste por redondeo (si la DDJJ da distinto por centavos)', null],
    [52, 'Impuesto determinado (el mayor entre el total y el mínimo)', '=ROUND(MAX(F49,F50),2)+F51'],
    [53, 'Retenciones', null],
    [54, 'Percepciones', null],
    [55, 'Recaudaciones bancarias', null],
    [56, 'Saldo a favor del mes anterior', null],
    [57, '− Compensado (usado para pagar otro impuesto)', null],
    [58, 'Saldo a favor que queda para usar', '=F56-F57'],
    [59, 'INGRESOS BRUTOS A PAGAR', '=MAX(ROUND(F52-F53-F54-F55-F58,2),0)'],
    [60, 'SALDO A FAVOR (pasa al mes siguiente)', '=MAX(ROUND(F53+F54+F55+F58-F52,2),0)']];
  iibb.forEach(function (x) { p('B' + x[0], x[1]); if (x[2]) p('F' + x[0], x[2]); });
  p('G56', '=IF(F56>0,"⚠ ¿Se compensó? Si se usó, poné cuánto abajo y cargá el asiento en Otros asientos.","")');
  p('I38', 'Control con la DDJJ de Ingresos Brutos'); p('J39', 'Según DDJJ'); p('K39', 'Diferencia');
  ctlDDJJ_(p, 40, 'A pagar', 'F59');
  ctlDDJJ_(p, 41, 'Saldo a favor', 'F60');

  // 4. COMERCIO E INDUSTRIA
  p('B62', '4. COMERCIO E INDUSTRIA');
  ['Rubro', 'Código', 'Base imponible', 'Alícuota (‰)', 'Reducción', 'Monto'].forEach(function (t, i) {
    p(col_(2 + i) + '63', t);
  });
  for (var j = 0; j < N_RUB; j++) {
    var r2 = 64 + j, rd2 = D_RUB + j;
    p('B' + r2, j === 0
      ? '=IF(' + D + 'C' + rd2 + '="","Rubro 1 (completalo en Datos)",' + D + 'C' + rd2 + ')'
      : '=' + D + 'C' + rd2 + '&""');
    p('C' + r2, '=' + D + 'B' + rd2 + '&""');
    p('G' + r2, '=D' + r2 + '*E' + r2 + '/1000*(1-F' + r2 + ')');
  }
  p('D64', '=D11-SUM(D65:D73)');
  var cei = [
    [74, 'Total rubros', '=SUM(G64:G73)'],
    [75, 'Mínimo', null],
    [76, 'Contribución sobre Comercio, Industria y Servicios (ítem 21)', '=ROUND(MAX(G74,G75),2)'],
    [77, 'Promoción, difusión, incentivación… (ítem 23)', '=ROUND(MAX(G74,G75)*F77,2)'],
    [78, 'Fondo Solidario de Inclusión Social (ítem 26)', '=ROUND(MAX(G74,G75)*F78,2)'],
    [79, 'Promoción de la economía local y la competitividad (ítem 28, fijo)', null],
    [80, 'Ajuste por redondeo (si la DDJJ da distinto por centavos)', null],
    [81, 'Total determinado', '=G76+G77+G78+G79+G80'],
    [82, 'Percepciones (en la DDJJ figuran como "Retenciones", ítem 38)', null],
    [83, 'Saldo a favor del mes anterior', null],
    [84, '− Compensado (usado para pagar otro impuesto)', null],
    [85, 'Saldo a favor que queda para usar', '=G83-G84'],
    [86, 'COMERCIO E INDUSTRIA A PAGAR', '=MAX(ROUND(G81-G82-G85,2),0)'],
    [87, 'SALDO A FAVOR (pasa al mes siguiente)', '=MAX(ROUND(G82+G85-G81,2),0)']];
  cei.forEach(function (x) { p('B' + x[0], x[1]); if (x[2]) p('G' + x[0], x[2]); });
  p('F77', 0.25); p('F78', 0.10);
  p('H83', '=IF(G83>0,"⚠ ¿Se compensó? Si se usó, poné cuánto abajo y cargá el asiento en Otros asientos.","")');
  p('I63', 'Control con la DDJJ de Comercio e Industria'); p('J64', 'Según DDJJ'); p('K64', 'Diferencia');
  ctlDDJJ_(p, 65, 'Monto (ítems 21 + 23 + 26 + 28)', 'G81');
  ctlDDJJ_(p, 66, 'A pagar', 'G86');

  // 5. VENTAS REALES
  p('B89', '5. VENTAS REALES (para el estado de resultados)');
  p('B90', 'Ventas reales del mes (con IVA)');
  p('B91', 'Ventas reales netas (÷ 1,21)'); p('E91', '=E90/1.21');
  p('B92', 'Ventas declaradas (con IVA)'); p('E92', '=F11');
  p('B93', 'Lo declarado sobre lo real'); p('E93', '=IF(E90=0,0,E92/E90)');
  p('D95', 'Declarado'); p('E95', 'Sobre lo real'); p('F95', 'Diferencia');
  p('B96', 'IVA débito'); p('D96', '=E22'); p('E96', '=ROUND(E90-E91,2)');
  p('B97', 'Ingresos Brutos'); p('D97', '=F52'); p('E97', '=ROUND(MAX(E91*E39,F50),2)');
  p('B98', 'Comercio e Industria'); p('D98', '=G81');
  p('E98', '=ROUND(MAX(E91*E64/1000*(1-F64),G75)*(1+F77+F78)+G79,2)');
  [96, 97, 98].forEach(function (r) { p('F' + r, '=E' + r + '-D' + r); });

  // Saldos del mes anterior y parametros
  if (prevSh) {
    var pn = "'" + prevSh.getName() + "'!";
    M_SALDOS_ANT.forEach(function (a1, k) { p(a1, '=' + pn + M_SALDOS_DE[k]); });
  } else {
    M_SALDOS_ANT.forEach(function (a1) { p(a1, 0); });
  }
  // Ejercicio (se arma aca para no repetir la formula larga arriba)
  var mesIni = 'MONTH(' + ini + ')', diaIni = 'DAY(' + ini + ')';
  var desde = 'DATE(YEAR($C$2)-IF(MONTH($C$2)<' + mesIni + ',1,0),' + mesIni + ',' + diaIni + ')';
  g[0][8] = '=IF(' + ini + '="","","Ejercicio del "&TEXT(' + desde + ',"dd/mm/yyyy")&" al "&TEXT(EDATE(' +
    desde + ',12)-1,"dd/mm/yyyy"))';

  sh.getRange(1, 1, g.length, g[0].length).setValues(g);
  if (prevSh) {
    M_PARAMETROS.forEach(function (a1) {
      sh.getRange(a1).setValues(prevSh.getRange(a1).getValues());
    });
  }
  formatoMes_(ss, sh, !prevSh);
}

function ctlDDJJ_(p, r, texto, celda) {
  p('I' + r, texto);
  p('K' + r, '=IF(J' + r + '="","",J' + r + '-' + celda + ')');
  p('L' + r, '=IF(J' + r + '="","– Sin cargar",IF(ABS(K' + r + ')<=1,"✔ Coincide","✘ No coincide"))');
}

function formatoMes_(ss, sh, primerMes) {
  [20, 430, 80, 130, 130, 130, 130, 20, 280, 130, 130, 170].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });
  sh.getRange('B1:G1').merge().setFontSize(14).setFontWeight('bold')
    .setBackground(COLOR.titulo).setFontColor('#ffffff');
  sh.getRange('B2').setFontWeight('bold');
  sh.getRange('C2:D2').merge().setNumberFormat('mmmm yyyy').setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('left');
  sh.getRange('I1:L1').merge().setFontStyle('italic');
  sh.getRange('I2:L2').merge().setFontWeight('bold');
  sh.getRangeList(['B4:G4', 'B13:G13', 'B37:G37', 'B62:G62', 'B89:G89'])
    .setBackground(COLOR.seccion).setFontColor('#ffffff').setFontWeight('bold');
  sh.getRangeList(['I4:L4', 'I13:L13', 'I20:L20', 'I38:L38', 'I63:L63'])
    .setBackground(COLOR.cabecera).setFontWeight('bold');
  sh.getRangeList(['B5:F5', 'B14:E14', 'B38:F38', 'B63:G63', 'J5:K5', 'J14:K14', 'J21:K21',
    'J39:K39', 'J64:K64', 'D95:F95', 'B21'])
    .setFontWeight('bold').setBackground(COLOR.total);
  sh.getRangeList(['B11:F11', 'B18:E18', 'B49:F49', 'B52:F52', 'B74:G74', 'B81:G81', 'B26:E26', 'B28:E28'])
    .setFontWeight('bold');
  sh.getRangeList(['B27:E27', 'B34:E35', 'B59:F60', 'B86:G87'])
    .setFontWeight('bold').setBackground(COLOR.resultado);
  sh.getRangeList(['D6:F11', 'D15:E19', 'E22:E35', 'D39:D48', 'F39:F60', 'D64:D73', 'G64:G87',
    'J6:K9', 'J15:K18', 'J22:K24', 'J40:K41', 'J65:K66', 'E90:E92', 'D96:F98'])
    .setNumberFormat(FMT_PESOS);
  sh.getRangeList(['C6:C9', 'C15:C17', 'E39:E48', 'F64:F73', 'F77:F78', 'E93']).setNumberFormat('0.00%');
  sh.getRange('C19').setNumberFormat('0.00%');
  sh.getRange('E64:E73').setNumberFormat('0.00');
  var carga = M_CARGA.slice();
  if (primerMes) carga = carga.concat(M_SALDOS_ANT);
  sh.getRangeList(carga).setBackground(COLOR.carga);
  sh.getRangeList(['D39', 'D64']).setBackground('#fffaeb');
  sh.getRange('D39').setNote('Se calcula sola: ventas netas menos las otras actividades. ' +
    'Si hay una sola actividad no hace falta tocar nada.');
  sh.getRange('D64').setNote('Se calcula sola: ventas netas menos los otros rubros. ' +
    'Si hay un solo rubro no hace falta tocar nada.');
  sh.getRange('D19').setNote('Remuneración 10 del F.931 del mes.');
  if (primerMes) {
    sh.getRangeList(M_SALDOS_ANT).setNote('Primer mes de la planilla: cargá a mano el saldo que viene ' +
      'de la DDJJ anterior. Desde el mes siguiente pasa solo.');
  }
  sh.getRange('E39:E48').setNote('Alícuota de la actividad (ej. 4 %). Pasa sola al mes siguiente.');
  sh.getRangeList(['F50', 'G75', 'G79']).setNote('Lo actualizan ustedes cuando cambia. Pasa solo al mes siguiente.');
  reglasEstado_(sh, ['L4:L70', 'I2:L2']);
  var alerta = SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('⚠')
    .setFontColor('#9c5700').setBold(true).setRanges([sh.getRange('F31'), sh.getRange('G56'), sh.getRange('H83')]).build();
  var reglas = sh.getConditionalFormatRules();
  reglas.push(alerta);
  sh.setConditionalFormatRules(reglas);
  if (conVentasReales_(ss)) sh.showRows(M_VREALES[0], M_VREALES[1] - M_VREALES[0] + 1);
  else sh.hideRows(M_VREALES[0], M_VREALES[1] - M_VREALES[0] + 1);
  sh.setFrozenRows(2);
  var prot = sh.protect().setDescription('Fórmulas del mes (avisa antes de cambiar una fórmula)');
  prot.setWarningOnly(true);
  var libres = carga.concat(['D39', 'D64']);
  prot.setUnprotectedRanges(libres.map(function (a1) { return sh.getRange(a1); }));
}

// ============================================================
// HOJA ASIENTOS (con formulas, una tanda por mes)
// ============================================================
function rearmarAsientos() {
  var ss = SpreadsheetApp.getActive();
  asegurarHojas_(ss);
  rearmarAsientos_(ss);
  mostrarVentasReales_(ss);
  ss.toast('Hoja Asientos rearmada.', 'Impositiva', 4);
}

function filaCuenta_(clave) {
  for (var i = 0; i < CUENTAS.length; i++) if (CUENTAS[i][0] === clave) return D_CTA + i;
  throw new Error('Cuenta desconocida: ' + clave);
}

function rearmarAsientos_(ss) {
  var sh = ss.getSheetByName(HOJA_ASIENTOS);
  var meses = listarMeses_(ss);
  var D = "'" + HOJA_DATOS + "'!";
  var filas = [['ASIENTOS (se arman solos con lo que se carga en cada mes)', '', '', '', '', '', '', '', '', ''],
    ['Fecha', 'Nº', 'Concepto', 'Código', 'Cuenta', 'Debe', 'Haber', 'Control', 'Código Onvio', 'Mes']];
  var cabeceras = [], totales = [];
  meses.forEach(function (m) {
    var M = "'" + m.nombre + "'!";
    var nomMes = 'CHOOSE(MONTH(' + M + '$C$2),"' + MESES.join('","') + '")';
    cabeceras.push(filas.length + 1);
    filas.push(['', '', '=' + nomMes + '&" "&YEAR(' + M + '$C$2)', '', '', '', '', '', '', '']);
    ASIENTOS.forEach(function (a) {
      var desde = filas.length + 1;
      a.lineas.forEach(function (l) {
        var rc = filaCuenta_(l[0]);
        var x = l[2].replace(/\{M\}/g, M);
        var debe, haber;
        if (l[1] === 'D') { debe = '=ROUND(' + x + ',2)'; haber = 0; }
        else if (l[1] === 'H') { debe = 0; haber = '=ROUND(' + x + ',2)'; }
        else { debe = '=MAX(ROUND(' + x + ',2),0)'; haber = '=MAX(-ROUND(' + x + ',2),0)'; }
        filas.push(['=EOMONTH(' + M + '$C$2,0)', a.n,
          a.mes ? '="' + a.concepto + '"&' + nomMes : a.concepto,
          '=' + D + 'D' + rc,
          '=IF(' + D + 'C' + rc + '="","✘ Falta elegir la cuenta en Datos: ' + CUENTAS[rc - D_CTA][1] + '",' + D + 'C' + rc + ')',
          debe, haber, '', '=' + D + 'E' + rc + '&""', m.nombre]);
      });
      var hasta = filas.length;
      totales.push(filas.length + 1);
      filas.push(['', '', '', '', 'Total del asiento', '=SUM(F' + desde + ':F' + hasta + ')',
        '=SUM(G' + desde + ':G' + hasta + ')',
        '=IF(ABS(F' + (hasta + 1) + '-G' + (hasta + 1) + ')<0.005,"✔ Cierra","✘ No cierra")', '', '']);
    });
    filas.push(['', '', '', '', '', '', '', '', '', '']);
  });
  sh.clear();
  // Mes como texto (si no, Google toma "01-2026" como fecha).
  sh.getRange(1, 10, filas.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, filas.length, 10).setValues(filas);
  sh.getRange('A1:H1').merge().setFontSize(14).setFontWeight('bold')
    .setBackground(COLOR.titulo).setFontColor('#ffffff');
  sh.getRange('A2:J2').setFontWeight('bold').setBackground(COLOR.cabecera);
  if (filas.length > 2) {
    sh.getRange(3, 1, filas.length - 2, 1).setNumberFormat(FMT_FECHA);
    sh.getRange(3, 6, filas.length - 2, 2).setNumberFormat(FMT_PESOS);
    sh.getRange(3, 4, filas.length - 2, 1).setNumberFormat('@');
  }
  if (cabeceras.length) {
    sh.getRangeList(cabeceras.map(function (r) { return 'A' + r + ':H' + r; }))
      .setBackground(COLOR.mes).setFontWeight('bold');
    sh.getRangeList(totales.map(function (r) { return 'A' + r + ':H' + r; }))
      .setFontWeight('bold').setBackground(COLOR.total);
  }
  [90, 40, 220, 110, 380, 130, 130, 110, 110, 70].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.hideColumns(9, 2);
  sh.setFrozenRows(2);
  sh.setConditionalFormatRules([]);
  reglasEstado_(sh, ['H3:H' + Math.max(filas.length, 3), 'E3:E' + Math.max(filas.length, 3)]);
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (pr) { pr.remove(); });
  sh.protect().setDescription('Asientos: se arman solos').setWarningOnly(true);
}

// ============================================================
// PLAN DE CUENTAS
// ============================================================
function ordenarPlan() {
  var ss = SpreadsheetApp.getActive();
  asegurarHojas_(ss);
  var sh = ss.getSheetByName(HOJA_PLAN);
  var res = ordenarFilasPlan_(sh.getDataRange().getValues());
  if (!res.length) {
    SpreadsheetApp.getUi().alert('No encontré cuentas. Pegá el plan de Onvio (nombre y código) en la hoja "' +
      HOJA_PLAN + '" y probá de nuevo.');
    return;
  }
  sh.clear();
  armarPlan_(sh);
  sh.getRange(2, 2, res.length, 1).setNumberFormat('@');
  sh.getRange(2, 1, res.length, 2).setValues(res);
  var f = [];
  for (var r = 2; r < res.length + 2; r++) f.push(['=SUBSTITUTE(SUBSTITUTE(B' + r + '&"",".",""),"/","")']);
  sh.getRange(2, 3, res.length, 1).setFormulas(f);
  ss.toast(res.length + ' cuentas ordenadas.', 'Impositiva', 5);
}

// De lo pegado (nombre y codigo en cualquier orden, con o sin titulos) a
// [nombre, codigo]. Saca espacios de mas.
function ordenarFilasPlan_(valores) {
  var res = [];
  valores.forEach(function (fila) {
    var codigo = '', nombre = '';
    fila.forEach(function (v) {
      if (v === '' || v === null) return;
      var s = String(v).trim();
      if (!codigo && (typeof v === 'number' || /^\d[\d.\/ -]*$/.test(s))) codigo = s.replace(/\s/g, '');
      else if (!nombre && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(s)) nombre = s.replace(/\s+/g, ' ');
    });
    if (codigo && nombre) res.push([nombre, codigo]);
  });
  // Nombres repetidos (ej. el titulo "IMPUESTO A LOS INGRESOS BRUTOS" y la
  // cuenta de gasto): se les agrega el codigo para poder distinguirlos.
  var cuenta = {};
  res.forEach(function (f) { var n = normal_(f[0]); cuenta[n] = (cuenta[n] || 0) + 1; });
  res.forEach(function (f) { if (cuenta[normal_(f[0])] > 1) f[0] = f[0] + ' (' + f[1] + ')'; });
  return res;
}

function normal_(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function sugerirCuentas() {
  var ss = SpreadsheetApp.getActive();
  asegurarHojas_(ss);
  var plan = ss.getSheetByName(HOJA_PLAN).getDataRange().getValues().slice(1)
    .map(function (f) { return [String(f[0]).trim(), String(f[1]).trim()]; })
    .filter(function (f) { return f[0] && f[1]; });
  if (!plan.length) {
    SpreadsheetApp.getUi().alert('Primero pegá y ordená el plan de cuentas.');
    return;
  }
  var datos = ss.getSheetByName(HOJA_DATOS);
  var rango = datos.getRange(D_CTA, 3, CUENTAS.length, 1);
  var actuales = rango.getValues();
  var r = sugerir_(plan, actuales.map(function (x) { return x[0]; }));
  rango.setValues(r.valores.map(function (v) { return [v]; }));
  var msg = 'Elegí ' + r.puestas + ' cuenta(s).';
  if (r.faltan.length) msg += '\n\nNo encontré estas (elegilas de la lista en Datos, o dejalas vacías ' +
    'si la empresa no las usa nunca):\n- ' + r.faltan.join('\n- ');
  msg += '\n\nRevisá en Datos que estén bien.';
  SpreadsheetApp.getUi().alert('Cuentas de los asientos', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// plan: [[nombre, codigo]]. Solo completa las vacias. Busca el nombre
// exacto y si no uno que empiece igual, siempre con el codigo del tipo
// correcto (activo, pasivo, resultados) y sin los titulos (codigo que
// termina en 00).
function sugerir_(plan, actuales) {
  var puestas = 0, faltan = [];
  var lista = plan.map(function (f) {
    var dig = String(f[1]).replace(/\D/g, '');
    return { nombre: f[0], n: normal_(f[0]), tipo: dig.charAt(0), titulo: /00$/.test(dig) };
  });
  var valores = CUENTAS.map(function (c, i) {
    if (actuales[i]) return actuales[i];
    var cand = c[2], k, j, x;
    for (var pasada = 0; pasada < 4; pasada++) {
      var exacto = pasada % 2 === 0, conTitulos = pasada >= 2;
      for (k = 0; k < cand.length; k++) {
        for (j = 0; j < lista.length; j++) {
          x = lista[j];
          if (x.tipo !== c[3] || (x.titulo && !conTitulos)) continue;
          if (exacto ? x.n === cand[k] : x.n.indexOf(cand[k]) === 0) { puestas++; return x.nombre; }
        }
      }
    }
    faltan.push(c[1]);
    return '';
  });
  return { valores: valores, puestas: puestas, faltan: faltan };
}

// ============================================================
// EXPORTAR PARA ONVIO
// ============================================================
function abrirExportar() {
  var ss = SpreadsheetApp.getActive();
  asegurarHojas_(ss);
  var meses = listarMeses_(ss).map(function (m) { return m.nombre; });
  if (!meses.length) {
    SpreadsheetApp.getUi().alert('Todavía no hay meses cargados.');
    return;
  }
  var ult = ultimoExportado_(ss);
  var desde = meses[0];
  if (ult) {
    var sig = mesSiguiente_(ult);
    desde = meses.indexOf(sig) >= 0 ? sig : meses[meses.length - 1];
  }
  var opciones = function (sel) {
    return meses.map(function (m) {
      return '<option' + (m === sel ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
  };
  var html = '<style>body{font-family:Arial,sans-serif;font-size:14px}label{display:block;margin:10px 0 4px}' +
    'select{font-size:14px;padding:4px;width:120px}button{font-size:14px;padding:8px 14px;margin-top:14px}' +
    '#msg{margin-top:12px;white-space:pre-wrap}.err{color:#c00000}.ok{color:#2e7d32}</style>' +
    '<div>' + (ult ? 'Último mes exportado: <b>' + ult + '</b>' : 'Todavía no se exportó nada.') + '</div>' +
    '<label>Desde</label><select id="d">' + opciones(desde) + '</select>' +
    '<label>Hasta</label><select id="h">' + opciones(meses[meses.length - 1]) + '</select>' +
    '<label><input type="checkbox" id="o" checked> Incluir "Otros asientos" de esas fechas</label>' +
    '<button id="b" onclick="go(false)">Generar el Excel</button>' +
    '<div id="msg"></div>' +
    '<script>' +
    'function go(forzar){var m=document.getElementById("msg");m.className="";m.textContent="Armando…";' +
    'document.getElementById("b").disabled=true;' +
    'google.script.run.withSuccessHandler(function(r){document.getElementById("b").disabled=false;' +
    'if(r.errores&&r.errores.length){m.className="err";m.textContent="No se puede exportar:\\n- "+r.errores.join("\\n- ");return;}' +
    'if(r.avisos&&r.avisos.length){m.className="err";m.innerHTML="";m.textContent="Atención:\\n- "+r.avisos.join("\\n- ")+"\\n";' +
    'var b=document.createElement("button");b.textContent="Generar igual";b.onclick=function(){go(true)};m.appendChild(b);return;}' +
    'm.className="ok";m.innerHTML="Listo: "+r.cantidad+" asientos.<br><br><a href=\\""+r.bajar+"\\" target=\\"_blank\\">Bajar el Excel</a>' +
    ' &nbsp;·&nbsp; <a href=\\""+r.url+"\\" target=\\"_blank\\">Ver en Drive</a>";})' +
    '.withFailureHandler(function(e){document.getElementById("b").disabled=false;m.className="err";m.textContent="Error: "+e.message;})' +
    '.exportarOnvio(document.getElementById("d").value,document.getElementById("h").value,' +
    'document.getElementById("o").checked,forzar);}' +
    '</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(460).setHeight(380),
    'Exportar asientos para Onvio');
}

function ordenMes_(nombre) { return +nombre.slice(3) * 12 + (+nombre.slice(0, 2) - 1); }

function ultimoExportado_(ss) {
  var sh = ss.getSheetByName(HOJA_EXPORT);
  if (!sh || sh.getLastRow() < 2) return '';
  var v = sh.getRange(2, 4, sh.getLastRow() - 1, 1).getValues();
  var mejor = '';
  v.forEach(function (x) {
    var s = String(x[0]);
    if (/^\d{2}-\d{4}$/.test(s) && (!mejor || ordenMes_(s) > ordenMes_(mejor))) mejor = s;
  });
  return mejor;
}

function exportarOnvio(desde, hasta, incluirOtros, forzar) {
  var ss = SpreadsheetApp.getActive();
  var tz = ss.getSpreadsheetTimeZone();
  if (ordenMes_(desde) > ordenMes_(hasta)) return { errores: ['"Desde" es posterior a "Hasta".'] };
  SpreadsheetApp.flush();
  var meses = listarMeses_(ss).filter(function (m) {
    return m.orden >= ordenMes_(desde) && m.orden <= ordenMes_(hasta);
  });
  var nombres = meses.map(function (m) { return m.nombre; });
  var asi = ss.getSheetByName(HOJA_ASIENTOS);
  var lineas = asi.getLastRow() > 2 ? asi.getRange(3, 1, asi.getLastRow() - 2, 10).getValues() : [];
  // Si algun mes no esta en la hoja Asientos, se rearma.
  var enHoja = {};
  lineas.forEach(function (f) { if (f[9]) enHoja[f[9]] = true; });
  if (nombres.some(function (n) { return !enHoja[n]; })) {
    rearmarAsientos_(ss);
    SpreadsheetApp.flush();
    lineas = asi.getRange(3, 1, asi.getLastRow() - 2, 10).getValues();
  }
  var otros = [];
  if (incluirOtros) {
    var so = ss.getSheetByName(HOJA_OTROS);
    if (so.getLastRow() > 1) otros = so.getRange(2, 1, so.getLastRow() - 1, 10).getValues();
  }
  var r = juntarAsientos_(lineas, otros, nombres, ordenMes_(desde), ordenMes_(hasta), function (d) {
    return Utilities.formatDate(d, tz, 'dd/MM/yyyy');
  });
  if (r.errores.length) return { errores: r.errores };
  if (!r.asientos.length) return { errores: ['No hay asientos con importes en esos meses.'] };

  var avisos = [];
  meses.forEach(function (m) {
    var c = String(m.hoja.getRange('I2').getValue());
    if (c.indexOf('✘') === 0) avisos.push(m.nombre + ': ' + c.replace('✘ ', ''));
  });
  var exp = ss.getSheetByName(HOJA_EXPORT);
  if (exp.getLastRow() > 1) {
    exp.getRange(2, 1, exp.getLastRow() - 1, 4).getValues().forEach(function (f) {
      var d = String(f[2]), h = String(f[3]);
      if (!/^\d{2}-\d{4}$/.test(d) || !/^\d{2}-\d{4}$/.test(h)) return;
      if (ordenMes_(d) <= ordenMes_(hasta) && ordenMes_(h) >= ordenMes_(desde)) {
        avisos.push('De ' + d + ' a ' + h + ' ya se exportó el ' +
          Utilities.formatDate(new Date(f[0]), tz, 'dd/MM/yyyy') + ' (' + f[1] + '). Si se importa de nuevo, se duplica en Onvio.');
      }
    });
  }
  if (avisos.length && !forzar) return { avisos: avisos };

  var filas = filasOnvio_(r.asientos);
  // Hoja "Asientos a importar"
  var imp = ss.getSheetByName(HOJA_IMPORTAR);
  imp.clear();
  armarImportar_(imp);
  imp.getRange(2, 5, filas.length, 1).setNumberFormat('@');
  imp.getRange(2, 1, filas.length, 12).setValues(filas);
  imp.getRange(2, 3, filas.length, 1).setNumberFormat(FMT_FECHA);
  imp.getRange(2, 6, filas.length, 1).setNumberFormat('0.00');

  // Excel aparte para importar
  var empresa = String(ss.getSheetByName(HOJA_DATOS).getRange('C' + D_RAZON).getValue()).trim() || ss.getName();
  var nombre = 'Asientos_Onvio_' + empresa.replace(/[^\wáéíóúñÁÉÍÓÚÑ.-]+/g, '_') + '_' + desde + '_a_' + hasta;
  var tmp = SpreadsheetApp.create(nombre);
  tmp.setSpreadsheetTimeZone(tz);
  var ts = tmp.getSheets()[0];
  ts.setName('Asientos');
  ts.getRange(1, 1, 1, 12).setValues([ENCABEZADO_ONVIO]);
  ts.getRange(2, 5, filas.length, 1).setNumberFormat('@');
  ts.getRange(2, 1, filas.length, 12).setValues(filas);
  ts.getRange(2, 3, filas.length, 1).setNumberFormat(FMT_FECHA);
  ts.getRange(2, 6, filas.length, 1).setNumberFormat('0.00');
  SpreadsheetApp.flush();
  var blob = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob().setName(nombre + '.xlsx');
  var carpeta = carpetaOnvio_(ss);
  var archivo = carpeta.createFile(blob);
  DriveApp.getFileById(tmp.getId()).setTrashed(true);

  var quien = '';
  try { quien = Session.getActiveUser().getEmail(); } catch (e) { quien = ''; }
  exp.appendRow([new Date(), quien, desde, hasta, r.asientos.length, archivo.getUrl()]);
  return {
    cantidad: r.asientos.length, url: archivo.getUrl(),
    bajar: 'https://drive.google.com/uc?export=download&id=' + archivo.getId()
  };
}

function carpetaOnvio_(ss) {
  var padres = DriveApp.getFileById(ss.getId()).getParents();
  var padre = padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
  var it = padre.getFoldersByName(CARPETA_ONVIO);
  return it.hasNext() ? it.next() : padre.createFolder(CARPETA_ONVIO);
}

// lineas: filas de la hoja Asientos (A..J). otros: filas de Otros asientos (A..J).
// Devuelve { asientos: [{fecha, concepto, lineas:[{codigo, importe, leyenda}]}], errores }.
// desde/hasta: numero de mes (ordenMes_). fmtFecha: fecha -> 'dd/mm/aaaa'.
function juntarAsientos_(lineas, otros, nombresMes, desde, hasta, fmtFecha) {
  var errores = [], porClave = {}, lista = [];
  var quiere = {};
  nombresMes.forEach(function (n) { quiere[n] = true; });
  var agregar = function (clave, fecha, concepto, codigo, cuenta, debe, haber, leyenda, orden) {
    var imp = Math.round((num_(debe) - num_(haber)) * 100) / 100;
    if (!porClave[clave]) {
      porClave[clave] = { fecha: fecha, concepto: concepto, lineas: [], suma: 0, orden: orden };
      lista.push(porClave[clave]);
    }
    var a = porClave[clave];
    if (imp === 0) return;
    a.suma += imp;
    if (!/^\d+$/.test(String(codigo))) {
      errores.push(a.concepto + ' (' + fmtFecha(a.fecha) + '): falta la cuenta' +
        (String(cuenta).indexOf('✘') === 0 ? ' — ' + String(cuenta).replace('✘ ', '') : ' "' + cuenta + '" (no está en el plan)'));
      return;
    }
    // La misma cuenta dos veces en un asiento (ej. saldo a favor en la misma
    // cuenta de percepciones): va en un solo renglon.
    for (var k = 0; k < a.lineas.length; k++) {
      if (a.lineas[k].codigo === String(codigo) && a.lineas[k].leyenda === (leyenda || '')) {
        a.lineas[k].importe = Math.round((a.lineas[k].importe + imp) * 100) / 100;
        return;
      }
    }
    a.lineas.push({ codigo: String(codigo), importe: imp, leyenda: leyenda || '' });
  };
  lineas.forEach(function (f, i) {
    if (!f[9] || !quiere[f[9]] || f[1] === '') return;
    agregar(f[9] + '|' + f[1], fecha_(f[0]), f[2], f[8], f[4], f[5], f[6], '', i);
  });
  otros.forEach(function (f, i) {
    var hay = f[1] !== '' || f[2] !== '' || f[3] !== '' || num_(f[5]) !== 0 || num_(f[6]) !== 0;
    if (!hay) return;
    f[0] = fecha_(f[0]);
    if (!f[0]) {
      if (num_(f[5]) !== 0 || num_(f[6]) !== 0) errores.push('Otros asientos, renglón ' + (i + 2) + ': falta la fecha.');
      return;
    }
    var om = ordenMes_(fmtFecha(f[0]).slice(3).replace('/', '-'));
    if (om < desde || om > hasta) return;
    if (f[1] === '') {
      errores.push('Otros asientos, renglón ' + (i + 2) + ': falta el Nº de asiento.');
      return;
    }
    agregar('otros|' + f[1], f[0], f[2] || 'ASIENTO', f[9], f[3], f[5], f[6], f[7], 100000 + i);
  });
  lista.forEach(function (a) {
    if (Math.abs(a.suma) >= 0.005) {
      errores.push(a.concepto + ' (' + fmtFecha(a.fecha) + ') no cierra: diferencia $ ' +
        (Math.round(a.suma * 100) / 100).toFixed(2));
    }
  });
  lista.forEach(function (a) {
    a.lineas = a.lineas.filter(function (l) { return l.importe !== 0; });
  });
  var asientos = lista.filter(function (a) { return a.lineas.length; });
  asientos.sort(function (a, b) {
    var d = a.fecha.getTime() - b.fecha.getTime();
    return d !== 0 ? d : a.orden - b.orden;
  });
  return { asientos: asientos, errores: errores };
}

function filasOnvio_(asientos) {
  var filas = [];
  asientos.forEach(function (a, i) {
    a.lineas.forEach(function (l, j) {
      filas.push([i + 1, j + 1, a.fecha, a.concepto, l.codigo, l.importe, '', l.leyenda, '', '', '', '']);
    });
  });
  return filas;
}

// ============================================================
// AYUDAS
// ============================================================
// Fecha de una celda (si viene como numero de serie, la convierte).
function fecha_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  if (typeof v === 'number' && v > 20000) {
    var d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + Math.floor(v));
    return d;
  }
  return null;
}

function num_(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function col_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function a1rc_(a1) {
  var m = /^([A-Z]+)(\d+)$/.exec(a1);
  var c = 0;
  for (var i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64);
  return { r: +m[2], c: c };
}

function grilla_(filas, cols) {
  var g = [];
  for (var i = 0; i < filas; i++) {
    var f = [];
    for (var j = 0; j < cols; j++) f.push('');
    g.push(f);
  }
  return g;
}

function pone_(g, a1, v) {
  var p = a1rc_(a1);
  g[p.r - 1][p.c - 1] = v;
}

function reglasEstado_(sh, rangos) {
  var rs = rangos.map(function (a1) { return sh.getRange(a1); });
  var reglas = sh.getConditionalFormatRules();
  reglas.push(SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('✘')
    .setFontColor('#c00000').setBackground('#f8d7da').setRanges(rs).build());
  reglas.push(SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('✔')
    .setFontColor('#2e7d32').setRanges(rs).build());
  sh.setConditionalFormatRules(reglas);
}
