// Backend_Productos.gs

function getProductosSeguros() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("BD_Productos");
    if (!sheet) throw new Error("No se encuentra la hoja BD_Productos");

    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Quitamos cabeceras
    
    /* MAPEO MANUAL SEGÚN TU ESTRUCTURA CSV:
      ID_Producto, PRODUCTO, Precios de Compra, % Buffer/Merma, CostoReal, Categoria, Punto de venta, Restaurantes, Mayoristas
      Indices: 0, 1, 2, 3, 4, 5, 6, 7, 8
    */

    const productosLimpios = data.map(row => {
      // Solo extraemos lo que es seguro mostrar
      return {
        id: row[0],
        nombre: row[1], // PRODUCTO
        categoria: row[5], // Categoria
        // Precios por tipo de cliente (Ya convertidos a número por la función parsearNumero de Utils si la usáramos aquí, pero como hacemos mapeo manual, aplicamos la lógica aquí)
        precios: {
          pos: typeof row[6] === 'string' ? parsearMoney(row[6]) : row[6],        // Punto de venta
          restaurante: typeof row[7] === 'string' ? parsearMoney(row[7]) : row[7], // Restaurantes
          mayorista: typeof row[8] === 'string' ? parsearMoney(row[8]) : row[8]    // Mayoristas
        },
        // EXCLUIMOS: row[2](Compra), row[3](Merma), row[4](CostoReal)
        unidad: "Unidad" // Valor por defecto o leer de columna si existe
      };
    });

    return responseSuccess(productosLimpios);

  } catch (e) {
    return responseError(e.message);
  }
}

// Función auxiliar local para limpiar precios específicos de este sheet
function parsearMoney(text) {
  if (!text) return 0;
  // Elimina '$' y '.' -> Convierte a número
  let val = text.toString().replace(/\$/g, '').replace(/\./g, '');
  return Number(val);
}

function getCategoriasConfig() {
  try {
    const datos = getSheetDataAsJSON("Config"); // Hoja CONFIG.csv
    return responseSuccess(datos);
  } catch (e) {
    return responseError(e.message);
  }
}