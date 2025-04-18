function generateDescription() {
    const activityType = document.getElementById('activityType').value;
    const details = document.getElementById('details').value;
    const softwareElements = document.querySelectorAll('input[name="software"]:checked');
    
    // Validazione campi obbligatori
    if (!activityType || !details || details.length < 200) {
        alert('Compila tutti i campi obbligatori e assicurati che il dettaglio abbia almeno 200 caratteri');
        return;
    }

    // Costruzione descrizione
    let description = `Attività di ${activityType}:\n`;
    description += `- Intervento: ${details}\n\n`;
    
    // Lista software/hardware
    if (softwareElements.length > 0) {
        description += 'Componenti coinvolti:\n';
        softwareElements.forEach(el => {
            description += `• ${el.value}\n`;
        });
        description += '\n';
    }

    // Aggiunta timestamp
    const now = new Date();
    description += `Operazione completata il ${now.toLocaleDateString('it-IT')} alle ${now.toLocaleTimeString('it-IT')}`;

    // Visualizza anteprima
    const preview = document.getElementById('preview');
    preview.textContent = description;
    preview.style.borderColor = '#27ae60';
}

function copyToClipboard() {
    const preview = document.getElementById('preview');
    
    navigator.clipboard.writeText(preview.textContent).then(() => {
        preview.style.borderColor = '#27ae60';
        preview.style.backgroundColor = '#e8f5e9';
        setTimeout(() => {
            preview.style.backgroundColor = '';
        }, 1000);
    }).catch(err => {
        preview.style.borderColor = '#c0392b';
        console.error('Errore durante la copia:', err);
    });
}

// Validazione in tempo reale per il textarea
document.getElementById('details').addEventListener('input', function(e) {
    if (e.target.value.length < 200) {
        e.target.style.borderColor = '#c0392b';
    } else {
        e.target.style.borderColor = '#ddd';
    }
});
