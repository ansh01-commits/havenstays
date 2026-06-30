import { downloadGuestDocument } from '../utils/downloadHelper'; // adjusting path as needed
import { useState } from 'react';

export default function GuestDocumentCard({ guest }) {
  const [isDownloading, setIsDownloading] = useState(false);

  // The database column is id_photo_url, which might be a comma-separated string
  const documentPathsStr = guest?.id_photo_url || guest?.document_path;
  const hasDocument = !!documentPathsStr;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const paths = documentPathsStr.split(',').map(p => p.trim()).filter(Boolean);
      
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const fileExtension = path.split('.').pop() || 'jpg';
        const suffix = paths.length > 1 ? `_Part${i + 1}` : '';
        const cleanFileName = `${(guest?.name || 'Guest').replace(/\s+/g, '_')}_Document${suffix}.${fileExtension}`;

        await downloadGuestDocument('id-photos', path, cleanFileName);
      }
    } catch (err) {
      console.error(err);
    }
    setIsDownloading(false);
  };

  return (
    <div className="p-4 rounded-xl bg-ink-900 border border-ink-800 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-white">Client Verification File</h3>
        <p className="text-xs text-gray-500">
          {hasDocument ? (documentPathsStr.includes(',') ? 'Multiple encrypted documents attached' : 'Encrypted document attached') : 'No document uploaded'}
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