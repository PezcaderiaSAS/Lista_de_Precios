// Utils.gs

function getSheetDataAsJSON(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`La hoja "${sheetName}" no existe.`);
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data.shift(); 
  
  return data.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      // NORMALIZACIÓN AVANZADA:
      // 1. Minúsculas
      // 2. Quitar tildes (NFD)
      // 3. Reemplazar espacios por guiones bajos
      // 4. Eliminar caracteres raros
      let cleanHeader = String(header).trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      obj[cleanHeader] = parsearNumero(row[index]);
    });
    return obj;
  });
}

function parsearNumero(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    if (valor.trim() === '') return '';
    // Detecta formato moneda/numero: $ 20.000 o 20,000
    if (valor.match(/^[$\d.,% -]+$/)) {
      // Asume formato latino: punto para miles, coma para decimales
      let limpio = valor.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
      let numero = parseFloat(limpio);
      return isNaN(numero) ? valor : numero;
    }
  }
  return valor;
}

function responseSuccess(data) {
  return { status: 'success', data: data };
}

function responseError(mensaje) {
  return { status: 'error', message: mensaje };
}

function formatoMoneda(valor) {
  if (valor == null) return "$ 0";
  // Formato simple para COP: $ 10.000
  return "$ " + Number(valor).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * CACHE HELPERS (Avoid limits of 100KB per value)
 */
function putCachedLongString(cache, key, value, expirationInSeconds) {
  const chunkSize = 90000; // Safe limit below 100KB (100,000 bytes)
  const chunks = [];
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.substring(i, i + chunkSize));
  }
  
  cache.put(key + "_CHUNKS", chunks.length.toString(), expirationInSeconds);
  
  const cacheObj = {};
  chunks.forEach((chunk, index) => {
    cacheObj[key + "_" + index] = chunk;
  });
  cache.putAll(cacheObj, expirationInSeconds);
}

function getCachedLongString(cache, key) {
  const chunksCountStr = cache.get(key + "_CHUNKS");
  
  // If no chunks format exists, check if there's a legacy non-chunked value
  if (!chunksCountStr) {
    return cache.get(key);
  }
  
  const chunksCount = parseInt(chunksCountStr, 10);
  const chunkKeys = [];
  for (let i = 0; i < chunksCount; i++) {
    chunkKeys.push(key + "_" + i);
  }
  
  const chunks = cache.getAll(chunkKeys);
  let value = "";
  for (let i = 0; i < chunksCount; i++) {
    const chunk = chunks[key + "_" + i];
    if (chunk === null || chunk === undefined) {
      // Chunk missing, cache is invalid
      return null;
    }
    value += chunk;
  }
  
  return value;
}

function removeCachedLongString(cache, key) {
  const chunksCountStr = cache.get(key + "_CHUNKS");
  if (chunksCountStr) {
    const chunksCount = parseInt(chunksCountStr, 10);
    const chunkKeys = [key + "_CHUNKS"];
    for (let i = 0; i < chunksCount; i++) {
      chunkKeys.push(key + "_" + i);
    }
    cache.removeAll(chunkKeys);
  }
  cache.remove(key); // Remove legacy non-chunked key too
}