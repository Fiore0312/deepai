import React from 'react';

const HistoryPanel = ({ history, onSelectHistoryItem }) => {
  if (!history || history.length === 0) {
    return (
      <div className="p-4 border rounded-lg history-panel bg-gray-50">
        <h3 className="mb-2 text-lg font-medium">Cronologia</h3>
        <p className="text-sm text-gray-500">Nessuna cronologia disponibile</p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <h3 className="mb-2 text-lg font-medium">Ultime descrizioni:</h3>
      <ul className="space-y-2 overflow-y-auto max-h-60">
        {history.slice(0, 10).map((item, index) => (
          <li 
            key={index} 
            className="p-2 transition-colors rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100"
            onClick={() => onSelectHistoryItem(item)}
          >
            <div className="text-sm font-medium">{item.input}</div>
            <div className="text-xs text-gray-500 truncate">{item.output}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HistoryPanel;
