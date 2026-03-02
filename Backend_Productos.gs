/**
 * Devuelve un diccionario de categorías con sus márgenes desde la hoja 'Config'.
 * Se asume columnas basadas en la instrucción de Array Formulas (0: cat (B:B), 1: ms3 (E:E), 2: ms2 (D:D), 3: ms1 (C:C))
 * Ajuste según Columnas del ArrayFormula del usuario:
 * POS = MROUND(E2:E/(1-(XLOOKUP(F2:F,Config!B:B,Config!E:E,"No existe",0))),100) -> POS está en Col E (Indice 4)
 * REST = MROUND(E2:E/(1-(XLOOKUP(F2:F,Config!B:B,Config!D:D,"No existe",0))),100) -> REST está en Col D (Indice 3)
 * MAYOR = MROUND(E2:E/(1-(XLOOKUP(F2:F,Config!B:B,Config!C:C,"No existe",0))),100) -> MAYOR está en Col C (Indice 2)
 */
function _getCategoriasMargenesData() {
  const cache = CacheService.getScriptCache();
  const cached = getCachedLongString(cache, "MARGENES_CACHE");
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Config");
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const margins = {};
  
  // Buscar posiciones de columnas por nombre exacto en Fila 1
  let colCat=0, colM1=1, colM2=2, colM3=3;
  if(data.length > 0) {
      const headers = data[0];
      colCat = headers.findIndex(h => h === "Categoría");
      colM1 = headers.findIndex(h => h === "Margen Sugerido 1");
      colM2 = headers.findIndex(h => h === "Margen Sugerido 2");
      colM3 = headers.findIndex(h => h === "Margen Sugerido 3");
      // Fallback a columnas hardcodeadas si no encuentra headers exactos basándonos en tu hoja actual 'Config'
      if(colCat===-1) colCat=1; // Columna B (Índice 1)
      if(colM3===-1) colM3=4; // POS - Columna E (Índice 4)
      if(colM2===-1) colM2=3; // REST - Columna D (Índice 3)
      if(colM1===-1) colM1=2; // MAYORISTA - Columna C (Índice 2)
  }

  for (let i = 1; i < data.length; i++) {
    const catName = data[i][colCat];
    if (catName) {
      margins[catName] = {
        margen_pos: parsearNumero(data[i][colM3]) || 0,     // Margen 3
        margen_rest: parsearNumero(data[i][colM2]) || 0,    // Margen 2
        margen_mayor: parsearNumero(data[i][colM1]) || 0    // Margen 1
      };
    }
  }
  
  // Guardar en caché 1 hr
  putCachedLongString(cache, "MARGENES_CACHE", JSON.stringify(margins), 3600);
  return margins;
}

/**
 * Endpoint Público que puede llamar el frontend para traer categorías con márgenes
 */
function apiGetCategoriasMargenes() {
   try {
      const data = _getCategoriasMargenesData();
      return responseSuccess(data);
   } catch (e) {
      return responseError(e.message);
   }
}

/**
 * ===============================================================
 * GESTIÓN DE PRODUCTOS (Backend_Productos.gs)
 * ===============================================================
 */

function getProductosSeguros() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = getCachedLongString(cache, "PRODUCTOS_CACHE");
    if (cached) {
      return responseSuccess(JSON.parse(cached));
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("BD_Productos");
    if (!sheet) throw new Error("Falta la hoja 'BD_Productos'.");
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); 

    const productosLimpios = rows.map(row => {
      return {
        id: row[0],
        nombre: row[1],
        categoria: row[5],
        unidad: "Und", // Asumimos unidad
        precios: {
          pos: parsearNumero(row[6]),
          restaurante: parsearNumero(row[7]),
          mayorista: parsearNumero(row[8])
        },
        // Datos internos para edición (si es admin)
        costo_compra: parsearNumero(row[2]),
        buffer: parsearNumero(row[3]),
        costo_real: parsearNumero(row[4])
      };
    });
    
    // Guardar en caché por 25 minutos
    putCachedLongString(cache, "PRODUCTOS_CACHE", JSON.stringify(productosLimpios), 1500);

    return responseSuccess(productosLimpios);
  } catch (e) {
    console.error("Error en getProductosSeguros:", e.toString());
    return responseError(e.toString());
  }
}

/**
 * Guarda un NUEVO producto.
 */
function guardarProductoBackend(dataProd) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("BD_Productos");
    
    // Calcular Nuevo ID
    const data = sheet.getDataRange().getValues();
    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      let val = parseInt(data[i][0]);
      if (!isNaN(val) && val > maxId) maxId = val;
    }
    const nuevoID = maxId + 1;

    // Escribir celda por celda para NO interferir con ArrayFormulas en E, G, H, I
    const targetRow = sheet.getLastRow() + 1;
    sheet.getRange(targetRow, 1).setValue(nuevoID); // A: ID
    sheet.getRange(targetRow, 2).setValue(dataProd.nombre.toUpperCase()); // B: Nombre
    sheet.getRange(targetRow, 3, 1, 2).setValues([[dataProd.costo_compra || 0, dataProd.buffer || 0]]); // C: Compra, D: Buffer
    sheet.getRange(targetRow, 6).setValue(dataProd.categoria); // F: Categoría
    
    SpreadsheetApp.flush();

    // Invalidamos la caché de productos
    removeCachedLongString(CacheService.getScriptCache(), "PRODUCTOS_CACHE");
    
    return responseSuccess({ mensaje: "Producto creado", id: nuevoID });
  } catch(e) {
    console.error("Error en guardarProductoBackend:", e.toString());
    return responseError(e.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza un producto existente en bloque.
 * @param {object} p Objeto con los datos del producto a actualizar
 */
function actualizarProductoBackend(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("BD_Productos");
    if (!sheet) throw new Error("No se encuentra BD_Productos");

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    // Buscar la fila por ID (columna 0)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(p.id)) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error("Producto no encontrado en la base de datos.");
    }

    // Sobrescribir solo celdas específicas para NO destruir ARRAYFORMULAS en E, G, H, I.
    const realRow = rowIndex + 1; // rowIndex de getValues empieza en 0, fila en sheets en 1
    
    // B: Nombre
    if (p.nombre) {
      sheet.getRange(realRow, 2).setValue(p.nombre.toUpperCase());
    }
    // C y D: Compra y Buffer
    sheet.getRange(realRow, 3, 1, 2).setValues([[p.costo_compra || 0, p.buffer || 0]]);
    // F: Categoria
    if (p.categoria) {
      sheet.getRange(realRow, 6).setValue(p.categoria);
    }
    
    // Forzar la escritura física antes de devolver success al Front
    SpreadsheetApp.flush();

    // Invalidar caché
    removeCachedLongString(CacheService.getScriptCache(), "PRODUCTOS_CACHE");

    return responseSuccess({ mensaje: "Producto actualizado" });
  } catch(e) {
    console.error("Error en actualizarProductoBackend:", e.toString());
    return responseError(e.message || e.toString());
  } finally {
    lock.releaseLock();
  }
}