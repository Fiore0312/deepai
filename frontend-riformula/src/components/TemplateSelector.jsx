import React from 'react';

const TemplateSelector = ({ selectedTemplate, onTemplateChange }) => {
  const templates = [
    { id: 'installazione', label: 'Installazione' },
    { id: 'riparazione', label: 'Riparazione' },
    { id: 'test', label: 'Test' },
    { id: 'configurazione', label: 'Configurazione' },
    { id: 'manutenzione', label: 'Manutenzione' },
    { id: 'altro', label: 'Altro' }
  ];

  return (
    <div className="template-selector">
      <label className="block mb-2 text-sm font-medium text-gray-700">
        Tipo di attività:
      </label>
      <div className="grid grid-cols-3 gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              selectedTemplate === template.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => onTemplateChange(template.id)}
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;
