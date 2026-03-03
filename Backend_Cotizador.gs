// Backend_Cotizador.gs

function generarCotizacionPDF(payload) {
  try {
    return executeWithRetries(() => {
      // 1. Validar payload
      if (!payload || !payload.cliente || !payload.carrito) {
        return responseError("Datos incompletos para generar la cotización.");
      }

      // 2. Preparar datos para la plantilla
      // Agregamos ID y Fecha si no vienen
      const fechaHoy = new Date();
      const cotizacionData = {
        idCotizacion: "COT-" + Math.floor(Math.random() * 100000), // ID Temporal o generar consecutivo real
        fecha: Utilities.formatDate(fechaHoy, Session.getScriptTimeZone(), "dd/MM/yyyy"),
        cliente: payload.cliente,
        items: payload.carrito,
        total: payload.total
      };

      // 3. Cargar template
      const template = HtmlService.createTemplateFromFile('Template_Cotizacion');
      template.datos = cotizacionData; // Pasamos los datos al objeto 'datos' que espera el HTML

      // 4. Evaluar y convertir a PDF
      const blob = template.evaluate().getAs(MimeType.PDF);
      const pdfName = `Cotización_${cotizacionData.idCotizacion}_${payload.cliente.cliente}.pdf`;
      blob.setName(pdfName);

      // 5. Guardar en Drive (Raíz o carpeta específica)
      // Buscamos si existe carpeta "Cotizaciones", si no, la creamos
      const folders = DriveApp.getFoldersByName("Cotizaciones La Pezcadería");
      let folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("Cotizaciones La Pezcadería");
      }

      const file = folder.createFile(blob);
      
      // 6. Retornar URL y estado
      // setSharing para asegurar que el usuario pueda verlo si es necesario, 
      // aunque si es el mismo usuario propietario no hace falta.
      // file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return responseSuccess({
        url: file.getUrl(),
        nombre: pdfName,
        mensaje: "Cotización generada exitosamente"
      });
    });

  } catch (e) {
    console.error("Error generarCotizacionPDF: " + e.toString());
    return responseError("Error generando PDF: " + e.message);
  }
}
