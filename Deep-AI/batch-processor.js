const { riformulaDescrizione } = require('./riformulaDescrizione');
const { validateInput } = require('./input-validator');

async function processBatch(descriptions) {
  // Validiamo tutti gli input prima di elaborarli
  const validatedDescriptions = descriptions.map(desc => {
    const validation = validateInput(desc);
    return validation.valid ? validation.normalized : desc;
  });

  // Elaboriamo ogni descrizione in parallelo
  const processingPromises = validatedDescriptions.map(desc => 
    riformulaDescrizione(desc).catch(error => {
      console.error(`Errore nell'elaborazione della descrizione: ${desc}`, error);
      return `Errore: ${error.message}`;
    })
  );

  // Attendiamo il completamento di tutte le elaborazioni
  const results = await Promise.all(processingPromises);

  return {
    success: true,
    data: results,
    metrics: {
      processed: results.length,
      errors: results.filter(r => r.startsWith('Errore')).length
    }
  };
}

module.exports = { processBatch };
