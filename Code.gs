// Code.gs

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Cotizador - La Pezcadería')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* Función para incluir partes de HTML (CSS, JS, Vistas) */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}