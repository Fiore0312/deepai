import React, { useState } from 'react';
import { processBatch } from '../api/api';

// URL base dell'API: usa un URL di produzione quando è in produzione, altrimenti usa localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const BatchProcessor = () => {
  const [batchInput, setBatchInput] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleInputChange = (e) => {
    setBatchInput(e.target.value);
  };

  const handleProcessBatch = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    const descriptions = batchInput.split('\n').filter(desc => desc.trim() !== '');
    const batchSize = descriptions.length;
    const processedResults = [];
    
    for (let i = 0; i < batchSize; i++) {
      try {
        const result = await processBatch([descriptions[i]], API_BASE_URL);
        processedResults.push({
          original: descriptions[i],
          improved: result.data[0] || 'Errore nella generazione'
        });
        setProgress(((i + 1) / batchSize) * 100);
      } catch (error) {
        processedResults.push({
          original: descriptions[i],
          improved: 'Errore: ' + error.message
        });
      }
    }
    
    setResults(processedResults);
    setIsProcessing(false);
  };

  const handleExportCSV = () => {
    const csvContent = 'Originale,Migliorato\n' + 
      results.map(r => `"${r.original.replace(/"/g, '""')}","${r.improved.replace(/"/g, '""')}"`).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'batch_results.csv');
    link.click();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md batch-processor">
      <h2 className="mb-4 text-xl font-semibold">Elaborazione Batch</h2>
      
      <div className="mb-4">
        <textarea
          className="w-full p-2 border rounded"
          rows={10}
          placeholder="Inserisci descrizioni, una per riga (max 50)"
          value={batchInput}
          onChange={handleInputChange}
        />
      </div>
      
      <button
        className="px-4 py-2 text-white bg-blue-500 rounded disabled:bg-gray-400"
        onClick={handleProcessBatch}
        disabled={isProcessing || batchInput.trim() === ''}
      >
        {isProcessing ? `Elaborazione... ${Math.round(progress)}%` : 'Elabora Batch'}
      </button>
      
      {results.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium">Risultati</h3>
            <button
              className="px-3 py-1 text-sm text-white bg-green-500 rounded"
              onClick={handleExportCSV}
            >
              Esporta CSV
            </button>
          </div>
          
          <div className="overflow-y-auto max-h-96">
            {results.map((result, index) => (
              <div key={index} className="p-2 mb-3 border-b">
                <p className="text-gray-600"><strong>Originale:</strong> {result.original}</p>
                <p className="font-medium text-gray-800"><strong>Migliorato:</strong> {result.improved}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchProcessor;
