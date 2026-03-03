/**
 * ===============================================================
 * SCRIPT DE MIGRACIÓN Y SET DE BASE DE DATOS (Migration.gs)
 * ===============================================================
 * 
 * Este archivo contiene los métodos para instanciar y verificar que todas las 
 * hojas de cálculo (BD_Productos, BD_Clientes, BD_Usuarios) estén configuradas 
 * correctamente con sus respectivos encabezados.
 */

// --- MENU SETUP ---
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('La Pezcadería App')
    .addItem('Instalar Base de Datos (Primer Uso)', 'setupDatabase')
    .addItem('Reparar Fórmulas Destruidas (Inventario)', 'repararFormulasProductos')
    .addItem('Migrar a Backend Pricing (Congelar Precios)', 'migrarTodaLaBaseDeDatosAValoresEstaticos')
    .addToUi();
}

/**
 * Función principal para crear hojas faltantes y configurar columnas y colores.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  if (ui) {
    var response = ui.alert(
      "Instalación de Base de Datos", 
      "Esta acción verificará y creará las hojas necesarias para que la App funcione (BD_Usuarios, BD_Productos, BD_Clientes). Las hojas existentes NO serán borradas.\n\n¿Deseas continuar?", 
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) {
      return;
    }
  }

  // 1. Configurar BD_Usuarios
  _initSheet(ss, "BD_Usuarios", [
    "PIN", "Nombre", "Rol (admin/vendedor)"
  ], [
    ["1234", "Admin Principal", "admin"],
    ["5678", "Vendedor Ejemplo", "vendedor"]
  ]);

  // 2. Configurar BD_Productos
  // 0:ID, 1:Producto, 2:P.Compra, 3:Buffer, 4:CostoReal, 5:Categoria, 6:POS, 7:Rest, 8:Mayor
  _initSheet(ss, "BD_Productos", [
    "ID", "Producto", "Costo Compra", "Buffer", "Costo Real (Compra+Buffer)",
    "Categoría", "Precio POS", "Precio Restaurante", "Precio Mayorista"
  ]);

  // 3. Configurar BD_Clientes
  _initSheet(ss, "BD_Clientes", [
    "ID_Cotizador", "ID_Bodega", "Cliente", "Razón Social", 
    "Identificación", "Tipo de ID", "Dirección", "Teléfono", "Ciudad"
  ]);

  if (ui) {
    ui.alert("¡Éxito!", "La base de datos ha sido verificada y/o instalada correctamente. Puedes empezar a usar la aplicación web.", ui.ButtonSet.OK);
  } else {
    console.log("Migración completada con éxito.");
  }
}

/**
 * Función Auxiliar privada para instanciar una hoja y formatear su cabecera.
 */
function _initSheet(ss, sheetName, headers, defaultRows = []) {
  let sheet = ss.getSheetByName(sheetName);
  let isNew = false;
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    isNew = true;
  }
  
  // Establecer cabeceras siempre en la Fila 1 para garantizar orden
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  
  // Dar formato estético a la cabecera
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#0ea5e9"); // Azul Tailwind (sky-500)
  headerRange.setFontColor("white");
  
  // Fila congelada para facilidad de lectura
  sheet.setFrozenRows(1);
  
  // Insertar data por defecto si la hoja es completamente nueva
  if (isNew && defaultRows.length > 0) {
    const dataRange = sheet.getRange(2, 1, defaultRows.length, headers.length);
    dataRange.setValues(defaultRows);
  }
  
  // Auto-ajustar columnas
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
  
  return sheet;
}

/**
 * Herramienta de Reparación para restablecer ARRAYFORMULAS en BD_Productos
 */
function repararFormulasProductos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("BD_Productos");
  const ui = SpreadsheetApp.getUi();
  
  if (!sheet) {
    if(ui) ui.alert("No se encontró la hoja BD_Productos.");
    return;
  }
  
  const lastRow = sheet.getLastRow() || 2;
  
  // Limpiar columnas con valores estáticos que bloquean ArrayFormulas
  // E (5), G (7), H (8), I (9) a partir de la Fila 2
  if (lastRow > 1) {
    sheet.getRange(2, 5, lastRow, 1).clearContent();
    sheet.getRange(2, 7, lastRow, 1).clearContent();
    sheet.getRange(2, 8, lastRow, 1).clearContent();
    sheet.getRange(2, 9, lastRow, 1).clearContent();
  }
  
  // Restablecer Fórmulas Originales del Usuario utilizando setFormula con sintaxis en inglés (comas y funciones US). 
  // Google Sheets lo traducirá automáticamente a tu idioma local (ES).
  sheet.getRange("E2").setFormula('=ARRAYFORMULA(IF(ISBLANK(C2:C),"",C2:C*(1+D2:D)))');
  sheet.getRange("G2").setFormula('=ARRAYFORMULA(IF(ISBLANK(F2:F),"",MROUND(E2:E/(1-(XLOOKUP(F2:F,Config!B:B,Config!E:E,"No existe",0))),100)))');
  sheet.getRange("H2").setFormula('=ARRAYFORMULA(IF(ISBLANK(F2:F),"",MROUND(E2:E/(1-(XLOOKUP(F2:F,Config!B:B,Config!D:D,"No existe",0))),100)))');
  sheet.getRange("I2").setFormula('=ARRAYFORMULA(IF(ISBLANK(F2:F),"",MROUND(E2:E/(1-(XLOOKUP(F2:F,Config!B:B,Config!C:C,"No existe",0))),100)))');

  if(ui) ui.alert("¡Éxito!", "Las fórmulas de ARRAYFORMULA han sido restablecidas en las columnas E, G, H e I. Se borraron los valores estáticos que ingresaban en conflicto.", ui.ButtonSet.OK);
}

/**
 * Fase 5 (Enterprise): Script Maestro para congelar todos los Precios Dinámicos 
 * a texto estático, removiendo ARRAYFORMULAS para depender del Backend.
 */
function migrarTodaLaBaseDeDatosAValoresEstaticos() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("BD_Productos");
  
  if (!sheet) {
    if(ui) ui.alert("No se encontró BD_Productos.");
    return;
  }
  
  if (ui) {
    var response = ui.alert(
      "Advertencia de Migración Crítica", 
      "Esta acción CAPTURARÁ todos los precios que están calculando tus ARRAYFORMULAS actualmente y los PEGARÁ como VALORES ESTÁTICOS, destruyendo las fórmulas.\n\nA partir de este punto, Google Sheets dejará de calcular tus precios automáticamente y Apps Script asumirá el control (Backend Pricing).\n\n¿Estás seguro de que quieres dar el salto?", 
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) return;
  }
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow > 1) {
    // 1. Capturar todo el contenido de la hoja tal y como la lee el usuario actualmente (con matemáticas ya resueltas)
    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const existingValues = range.getValues();
    
    // 2. Destruir Fórmulas escribiéndolo todo encima como Valores
    range.setValues(existingValues);
  }
  
  if (ui) ui.alert("¡Migración Exitosa!", "Los catálogos están listos. Tus fórmulas han sido congeladas permanentemente a valores fijos. Apps Script se ha hecho cargo exitosamente del flujo matemático.", ui.ButtonSet.OK);
}
