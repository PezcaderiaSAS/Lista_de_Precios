/**
 * ===============================================================
 * CONTROLADOR PRINCIPAL (Code.gs)
 * ===============================================================
 */

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  
  return template.evaluate()
    .setTitle('Cotizador - La Pezcadería')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
    .getContent();
}

/**
 * Función auxiliar para forzar permisos (Ejecutar manualmente una vez)
 */
function autorizarTodo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var drive = DriveApp.getRootFolder();
  var mail = GmailApp.getDrafts();
  console.log("✅ Permisos detectados. Ahora implementa una Nueva Versión.");
}

function TEST_CONEXION() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const hojasRequeridas = ["BD_Productos", "BD_Clientes"];
  
  console.log("--- INICIANDO TEST ---");
  console.log("Archivo: " + ss.getName());
  
  hojasRequeridas.forEach(nombre => {
    const sheet = ss.getSheetByName(nombre);
    if (sheet) {
      console.log(`✅ Hoja '${nombre}' ENCONTRADA. Filas: ${sheet.getLastRow()}`);
      // Intento de lectura de datos
      try {
        const data = sheet.getDataRange().getValues();
        console.log(`   -> Lectura OK. Columnas detectadas: ${data[0].length}`);
      } catch(e) {
         console.log(`   -> ❌ ERROR LEYENDO DATOS: ${e.message}`);
      }
    } else {
      console.log(`❌ Hoja '${nombre}' NO ENCONTRADA. (Revisa espacios o mayúsculas)`);
    }
  });
  console.log("--- FIN DEL TEST ---");
}