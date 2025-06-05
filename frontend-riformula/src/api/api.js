// Funzione per l'elaborazione di una singola descrizione
export const riformulaDescrizione = async (descrizione, apiBaseUrl) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/riformula`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: descrizione }),
    });

    if (!response.ok) {
      throw new Error('Errore nella richiesta API');
    }

    return await response.json();
  } catch (error) {
    console.error('Errore API:', error);
    throw error;
  }
};

// Funzione per l'elaborazione batch
export const processBatch = async (descriptions, apiBaseUrl) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ descriptions }),
    });

    if (!response.ok) {
      throw new Error('Errore nella richiesta batch API');
    }

    return await response.json();
  } catch (error) {
    console.error('Errore API batch:', error);
    throw error;
  }
};
