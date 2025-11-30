import { useState } from "react";
import "./popup.css";

function Popup() {
  const [videoUrl, setVideoUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {downloadUrl && !loading && (
        <a href={downloadUrl} target="_blank" download>
          <button className="download-button">Download Audio</button>
        </a>
      )}
    </div>
  );
}

export default Popup;
