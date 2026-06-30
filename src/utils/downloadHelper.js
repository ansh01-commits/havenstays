import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/**
 * Downloads a private file from Supabase storage by creating a temporary signed URL.
 * @param {string} bucketName - The name of your storage bucket (e.g., 'client-documents')
 * @param {string} filePath - The path/name of the file stored in the DB row (e.g., 'folder/guest_id.pdf')
 * @param {string} downloadName - What the file should be named when downloaded (e.g., 'JohnDoe_ID.pdf')
 */
export const downloadGuestDocument = async (bucketName, filePath, downloadName = 'document') => {
  try {
    let downloadUrl = filePath;

    if (!filePath.startsWith('http')) {
      // 1. Generate a secure, temporary signed URL valid for 60 seconds
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      downloadUrl = data.signedUrl;
    }

    // 2. Fetch the file data using the URL
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();

    // 3. Create a temporary anchor tag in the browser to force the download
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', downloadName);
    
    document.body.appendChild(link);
    link.click();
    
    // 4. Clean up the browser memory
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    
    toast.success('Document downloaded successfully!');
  } catch (error) {
    console.error('Download error:', error);
    toast.error('Failed to download document. Please try again.');
  }
};