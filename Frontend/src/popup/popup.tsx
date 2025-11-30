import { useState } from "react";
import "./popup.css";

function Popup() {
  const [videoUrl, setVideoUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const getYouTubeUrl = () => {
    chrome.runtime.sendMessage({ type: "GET_YT_URL" }, (response: { url?: string }) => {
      if (response?.url) {
        setVideoUrl(response.url);
        setError("");
      } else {
        setError("Could not detect YouTube URL. Make sure you're on a YouTube video page.");
      }
    });
  };

  const extractAudio = async () => {
    if (!videoUrl) {
      setError("Please detect a YouTube URL first");
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
        body: JSON.stringify({ youtubeUrl: videoUrl })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success && data.fileUrl) {
        setDownloadUrl(data.fileUrl);
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

  return (
    <div className="popup-container">
      <h3>YouTube Audio Extractor</h3>

      <button onClick={getYouTubeUrl} disabled={loading}>
        Detect YouTube URL
      </button>

      <p className="url-display">URL: {videoUrl || "No URL detected"}</p>

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
            <button className="download-button">📥 Download Audio</button>
          </a>
          <p className="download-hint">Click to download the MP3 file</p>
        </div>
      )}
    </div>
  );
}

export default Popup;
