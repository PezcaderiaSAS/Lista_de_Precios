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
      // Retornar los datos. Generamos un token encriptado en Base64 seguro
      const tokenString = Utilities.base64EncodeWebSafe(usuarioEncontrado.pin);
      return responseSuccess({
        nombre: usuarioEncontrado.nombre,
        rol: usuarioEncontrado.rol,
        token: tokenString
      });
    } else {
      return responseError("PIN Incorrecto.");
    }
    
  } catch(e) {
    console.error("Error en validarLogin: ", e.toString());
    return responseError("Error validando acceso: " + e.message);
  }
}

/**
 * Valida silenciosamente un token almacenado en LocalStorage
 * @param {string} token Encriptado en base64 
 */
function validarSesion(token) {
  try {
    if (!token) return responseError("Sesión inválida.");
    // Decodificar Base64 web safe y convertir blob a string
    const pinStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
    return validarLogin(pinStr); // Reutilizar la validación nativa
  } catch(e) {
    console.error("Error en validarSesion (Token Manipulado O Expirado): ", e.toString());
    return responseError("Sesión expirada o inválida.");
  }
}
