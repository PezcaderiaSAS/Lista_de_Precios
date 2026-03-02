/**
 * ===============================================================
 * GESTIÓN DE USUARIOS Y AUTENTICACIÓN (Backend_Usuarios.gs)
 * ===============================================================
 */

/**
 * Valida un PIN contra la hoja BD_Usuarios y retorna la información del usuario.
 * @param {string|number} pin El PIN a validar
 * @return {object} responseSuccess con los datos del usuario o responseError si falla
 */
function validarLogin(pin) {
  try {
    if (!pin) return responseError("PIN vacío.");
    
    // Convertir el PIN entrante a string para comparación estricta
    const pinStr = String(pin).trim();
    
    // Intentar leer de caché (cache de 5 minutos para reflejar cambios en la hoja rápido)
    const cache = CacheService.getScriptCache();
    const cacheKey = "USUARIOS_CACHE";
    let usuarios = null;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      usuarios = JSON.parse(cachedData);
    } else {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName("BD_Usuarios");
      if (!sheet) {
        // En caso de que no exista la hoja aún, evitamos el choque crítico.
        return responseError("Aún no has creado la hoja 'BD_Usuarios' en el Google Sheets.");
      }
      
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return responseError("La hoja 'BD_Usuarios' está vacía. Añade PIN, Nombre y Rol.");
      
      // Construir arreglo de usuarios. Columnas: 0: PIN, 1: Nombre, 2: Rol
      usuarios = [];
      for (let i = 1; i < data.length; i++) {
        // Ignorar filas en blanco
        if (data[i][0] === "") continue;
        
        usuarios.push({
          pin: String(data[i][0]).trim(),
          nombre: String(data[i][1]).trim(),
          rol: String(data[i][2]).trim().toLowerCase() // ej: "admin" o "vendedor"
        });
      }
      
      // Guardar en caché por 5 minutos (300 segundos)
      cache.put(cacheKey, JSON.stringify(usuarios), 300);
    }
    
    // Buscar el usuario
    const usuarioEncontrado = usuarios.find(u => u.pin === pinStr);
    
    if (usuarioEncontrado) {
      // Retornar los datos (excepto el PIN por seguridad en el payload hacia el Frontend)
      return responseSuccess({
        nombre: usuarioEncontrado.nombre,
        rol: usuarioEncontrado.rol
      });
    } else {
      return responseError("PIN Incorrecto.");
    }
    
  } catch(e) {
    console.error("Error en validarLogin: ", e.toString());
    return responseError("Error validando acceso: " + e.message);
  }
}
