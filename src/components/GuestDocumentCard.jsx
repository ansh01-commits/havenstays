import { downloadGuestDocument } from '../utils/downloadHelper'; // adjusting path as needed
import { useState } from 'react';

export default function GuestDocumentCard({ guest }) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Assuming your guest object contains: { name: "Malhar", document_path: "ids/malhar_passport.pdf" }
  const hasDocument = !!guest?.document_path;

  const handleDownload = async () => {
    setIsDownloading(true);
    // Extracted file extension dynamically
    const fileExtension = guest.document_path.split('.').pop();
    const cleanFileName = `${guest.name.replace(/\s+/g, '_')}_Document.${fileExtension}`;

    await downloadGuestDocument('client-documents', guest.document_path, cleanFileName);
    setIsDownloading(false);
  };

  return (
    <div className="p-4 rounded-xl bg-ink-900 border border-ink-800 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-white">Client Verification File</h3>
        <p className="text-xs text-gray-500">
          {hasDocument ? 'Encrypted document attached' : 'No document uploaded'}
        </p>
      </div>

      <button
        type="button"
        disabled={!hasDocument || isDownloading}
        onClick={handleDownload}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          ${hasDocument 
            ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20' 
            : 'bg-ink-950 text-gray-600 border border-ink-800 cursor-not-allowed'
          }`}
      >
        {isDownloading ? (
          <span>Downloading...</span>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download Document
          </>
        )}
      </button>
    </div>
  );
}