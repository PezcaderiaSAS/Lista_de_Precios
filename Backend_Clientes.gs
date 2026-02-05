// Backend_Clientes.gs

function getClientesLista() {
  try {
    const clientes = getSheetDataAsJSON("BD_Clientes");
    return responseSuccess(clientes);
  } catch (e) {
    return responseError(e.message);
  }
}

function guardarCliente(clienteData) {
  const lock = LockService.getScriptLock();
  try {
    // Esperar hasta 10 segundos para obtener el candado
    lock.waitLock(10000); 
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("BD_Clientes");
    
    // Generar ID si es nuevo (ID max + 1) o usar el existente
    let idCliente = clienteData.id || (Math.max(...sheet.getRange("A2:A").getValues().flat().filter(Number)) + 1);
    
    // Mapeo según tu CSV Clientes: 
    // ID_Cliente_Bodega, Cliente, Razón Social, Identificación, Tipo de ID, Direccion, Telefono, Ciudad
    const nuevaFila = [
      idCliente,
      clienteData.nombre,       // Cliente
      clienteData.razonSocial,  // Razón Social
      clienteData.identificacion,
      clienteData.tipoId,
      clienteData.direccion,
      clienteData.telefono,
      clienteData.ciudad
    ];

    sheet.appendRow(nuevaFila);
    return responseSuccess({ id: idCliente, mensaje: "Cliente guardado exitosamente" });

  } catch (e) {
    return responseError("Error guardando cliente: " + e.message);
  } finally {
    lock.releaseLock();
  }
}