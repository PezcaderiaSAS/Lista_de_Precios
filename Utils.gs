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