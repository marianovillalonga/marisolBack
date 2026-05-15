const fs = require('fs');
const path = require('path');

const validationRulesPath = path.resolve(__dirname, 'validation-rules.json');

function loadValidationRules() {
  if (!fs.existsSync(validationRulesPath)) {
    throw new Error(
      `No se encontro el archivo de reglas compartidas en ${validationRulesPath}. Verifica que validation-rules.json exista dentro de src/config y este incluido en git/deploy.`,
    );
  }

  return require(validationRulesPath);
}

module.exports = loadValidationRules();
