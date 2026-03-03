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
 * Función interna para calcular los precios basándose en las reglas de negocio.
 * @param {number} costoCompra 
 * @param {number} buffer 
 * @param {string} categoria 
 * @returns {object} { costoReal, precioPOS, precioRest, precioMayor }
 */
function _calcularPreciosEnServidor(costoCompra, buffer, categoria) {
  const cCompra = Number(costoCompra) || 0;
  const cBuffer = Number(buffer) || 0;
  const costoReal = cCompra * (1 + cBuffer);

  const margenesData = _getCategoriasMargenesData();
  let mPos = 0, mRest = 0, mMayor = 0;
  
  if (margenesData[categoria]) {
    mPos = Number(margenesData[categoria].margen_pos) || 0;
    mRest = Number(margenesData[categoria].margen_rest) || 0;
    mMayor = Number(margenesData[categoria].margen_mayor) || 0;
  }

  const calcPrecio = (costo, margen) => {
    if (margen >= 1) margen = margen / 100;
    if (margen >= 1 || margen < 0) return costo;
    return Math.round(costo / (1 - margen));
  };

  return {
    costoReal: costoReal,
    precioPOS: calcPrecio(costoReal, mPos),
    precioRest: calcPrecio(costoReal, mRest),
    precioMayor: calcPrecio(costoReal, mMayor)
  };
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
  try {
    return executeWithRetries(() => {
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

    // Calculamos Precios en RAM antes de Guardar
    const precios = _calcularPreciosEnServidor(dataProd.costo_compra, dataProd.buffer, dataProd.categoria);
    
    // Escribir celda por celda (O en bloque) para popular estáticamente TODOS los campos
    const targetRow = sheet.getLastRow() + 1;
    sheet.getRange(targetRow, 1).setValue(nuevoID); // A: ID
    sheet.getRange(targetRow, 2).setValue(dataProd.nombre.toUpperCase()); // B: Nombre
    sheet.getRange(targetRow, 3, 1, 3).setValues([[dataProd.costo_compra || 0, dataProd.buffer || 0, precios.costoReal]]); // C: Compra, D: Buffer, E: Costo Real
    sheet.getRange(targetRow, 6, 1, 4).setValues([[dataProd.categoria, precios.precioPOS, precios.precioRest, precios.precioMayor]]); // F: Cat, G: POS, H: Rest, I: Mayor
    
    SpreadsheetApp.flush();

    // Invalidamos la caché de productos
    removeCachedLongString(CacheService.getScriptCache(), "PRODUCTOS_CACHE");
    
    return responseSuccess({ mensaje: "Producto creado", id: nuevoID });
    });
  } catch(e) {
    console.error("Error en guardarProductoBackend:", e.toString());
    return responseError(e.toString());
  }
}

/**
 * Actualiza un producto existente en bloque.
 * @param {object} p Objeto con los datos del producto a actualizar
 */
function actualizarProductoBackend(p) {
  try {
    return executeWithRetries(() => {
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

    // Combinar los datos enviados con los existentes en la celda original (Fallback)
    const rowData = data[rowIndex];
    const costoFinal = p.costo_compra !== undefined ? p.costo_compra : rowData[2];
    const bufferFinal = p.buffer !== undefined ? p.buffer : rowData[3];
    const catFinal = p.categoria !== undefined ? p.categoria : rowData[5];

    // Cálculos de Precios
    const precios = _calcularPreciosEnServidor(costoFinal, bufferFinal, catFinal);

    const realRow = rowIndex + 1; // rowIndex de getValues empieza en 0, fila en sheets en 1
    
    // B: Nombre
    if (p.nombre) {
      sheet.getRange(realRow, 2).setValue(p.nombre.toUpperCase());
    }
    
    // Escribimos todo en bloque desde la Columna C(3) hasta I(9)
    // C(3): Compra, D(4): Buffer, E(5): Costo Real, F(6): Categoria, G(7): POS, H(8): Rest, I(9): Mayor
    const rowValues = [[
      costoFinal || 0, 
      bufferFinal || 0, 
      precios.costoReal, 
      catFinal || "General", 
      precios.precioPOS, 
      precios.precioRest, 
      precios.precioMayor
    ]];
    
    sheet.getRange(realRow, 3, 1, 7).setValues(rowValues);
    
    // Forzar la escritura física antes de devolver success al Front
    SpreadsheetApp.flush();

    // Invalidar caché
    removeCachedLongString(CacheService.getScriptCache(), "PRODUCTOS_CACHE");

      return responseSuccess({ mensaje: "Producto actualizado" });
    });
  } catch(e) {
    console.error("Error en actualizarProductoBackend:", e.toString());
    return responseError(e.message || e.toString());
  }
}