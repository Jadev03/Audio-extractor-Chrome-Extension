import { useState } from "react";
import "./popup.css";

function Popup() {
  const [videoUrl, setVideoUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const detectVideoUrl = () => {
    chrome.runtime.sendMessage({ type: "GET_YT_URL" }, (response: { url?: string }) => {
      if (response?.url) {
        const url = response.url;
        const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
        const isFacebook = url.includes("facebook.com") || url.includes("fb.com") || url.includes("fb.watch");
        
        if (isYouTube || isFacebook) {
          setVideoUrl(url);
          setError("");
        } else {
          setError("Could not detect video URL. Make sure you're on a YouTube or Facebook video page.");
        }
      } else {
        setError("Could not detect video URL. Make sure you're on a YouTube or Facebook video page.");
      }
    });
  };

  const extractAudio = async () => {
    if (!videoUrl) {
      setError("Please detect a video URL first");
      return;
    }

    setLoading(true);
    setError("");
    setDownloadUrl("");
    setSuccess(false);

    try {
      const res = await fetch("http://localhost:5000/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success && (data.driveWebViewLink || data.driveWebContentLink)) {
        // Prefer webViewLink (opens in Drive UI), fallback to direct content link
        const link = data.driveWebViewLink || data.driveWebContentLink;
        setDownloadUrl(link);
        setError("");
        setSuccess(true);
        
        // Show success notification
        try {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("/vite.svg"),
            title: "✅ Audio Extraction Complete!",
            message: "Your audio file is ready to download. Click the download button in the extension popup."
          });
        } catch (e) {
          console.log("Notification failed:", e);
        }
      } else {
        throw new Error(data.error || "Extraction failed");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to extract audio";
      console.error("Extraction error:", errorMessage);
      setError(errorMessage);
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        setError("Cannot connect to backend server. Make sure it's running on http://localhost:5000");
      }
    } finally {
      setLoading(false);
    }
  };

  const isYouTube = videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be"));
  const isFacebook = videoUrl && (videoUrl.includes("facebook.com") || videoUrl.includes("fb.com") || videoUrl.includes("fb.watch"));
  const platform = isYouTube ? "YouTube" : isFacebook ? "Facebook" : "Video";

  return (
    <div className="popup-container">
      <h3>Video Audio Extractor</h3>
      <p className="subtitle">YouTube & Facebook</p>

      <button onClick={detectVideoUrl} disabled={loading}>
        Detect Video URL
      </button>

      <p className="url-display">
        {videoUrl ? (
          <>
            <strong>{platform}:</strong> {videoUrl.length > 50 ? videoUrl.substring(0, 50) + "..." : videoUrl}
          </>
        ) : (
          "No URL detected"
        )}
      </p>

      <button 
        onClick={extractAudio} 
        disabled={loading || !videoUrl}
        className="extract-button"
      >
        {loading ? "Extracting..." : "Extract Audio"}
      </button>

      {success && !loading && (
        <div className="success-message">
          ✅ Audio extracted successfully! Ready to download.
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {downloadUrl && !loading && (
        <div className="download-section">
          <a href={downloadUrl} target="_blank" download>
            <button className="download-button">📂 Open in Google Drive</button>
          </a>
          <p className="download-hint">This opens your uploaded WebM audio file in Google Drive</p>
        </div>
      )}
    </div>
  );
}

export default Popup;
