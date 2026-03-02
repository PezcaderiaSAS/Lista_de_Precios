/**
 * ===============================================================
 * GESTIÓN DE CLIENTES (Backend_Clientes.gs)
 * ===============================================================
 */

function getClientesLista() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = getCachedLongString(cache, "CLIENTES_CACHE");
    if (cached) {
      return responseSuccess(JSON.parse(cached));
    }

    const clientes = getSheetDataAsJSON("BD_Clientes");
    
    // Guardar en caché por 25 minutos
    putCachedLongString(cache, "CLIENTES_CACHE", JSON.stringify(clientes), 1500);

    return responseSuccess(clientes);
  } catch (e) {
    console.error("Error en getClientesLista:", e.toString());
    return responseError(e.toString());
  }
}

/**
 * Guarda un cliente (Nuevo o Existente)
 * Si el cliente tiene ID, busca y actualiza. Si no, crea uno nuevo.
 */
function guardarClienteBackend(dataCliente) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Evitar colisiones

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("BD_Clientes");
    const data = sheet.getDataRange().getValues();
    
    // Encabezados para identificar columnas (Asumiendo orden fijo del CSV para escritura)
    // 0:ID, 1:Cliente, 2:Razon, 3:Identificacion, 4:TipoID, 5:Direccion, 6:Tel, 7:Ciudad
    
    let idParaGuardar = dataCliente.id_cliente_bodega;
    let filaDestino = -1;

    // 1. Lógica de Actualización (Editar)
    if (idParaGuardar) {
      // Buscar la fila del ID existente (saltando header)
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) == String(idParaGuardar)) {
          filaDestino = i + 1; // +1 porque sheet es base 1
          break;
        }
      }
    }

    // 2. Lógica de Creación (Nuevo)
    if (filaDestino === -1) {
      // Calcular nuevo ID = Max ID actual + 1
      let maxId = 0;
      for (let i = 1; i < data.length; i++) {
        let val = parseInt(data[i][0]);
        if (!isNaN(val) && val > maxId) maxId = val;
      }
      idParaGuardar = maxId + 1;
      filaDestino = sheet.getLastRow() + 1;
    }

    // Preparar el Array para guardar (Mismo orden que BD)
    const filaDatos = [
      idParaGuardar,
      dataCliente.cliente.toUpperCase(),
      dataCliente.razon_social || dataCliente.cliente,
      dataCliente.identificacion,
      dataCliente.tipo_de_id || 'Cédula de ciudadanía',
      dataCliente.direccion,
      dataCliente.telefono,
      dataCliente.ciudad
    ];

    // Escribir en la hoja
    sheet.getRange(filaDestino, 1, 1, filaDatos.length).setValues([filaDatos]);

    // Invalidar caché de clientes
    removeCachedLongString(CacheService.getScriptCache(), "CLIENTES_CACHE");

    return responseSuccess({ 
      mensaje: "Cliente guardado exitosamente", 
      id: idParaGuardar 
    });

  } catch (e) {
    console.error("Error en guardarClienteBackend:", e.toString());
    return responseError("Error guardando cliente: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}