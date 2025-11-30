import { useState } from "react";
import "./popup.css";

function Popup() {
  const [videoUrl, setVideoUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const getYouTubeUrl = () => {
    chrome.runtime.sendMessage({ type: "GET_YT_URL" }, (response: { url?: string }) => {
      if (response?.url) {
        setVideoUrl(response.url);
      }
    });
  };

  const extractAudio = async () => {
    const res = await fetch("http://localhost:5000/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: videoUrl })
    });

    const data = await res.json();
    setDownloadUrl(data.fileUrl);
  };

  return (
    <div className="popup-container">
      <h3>YouTube Audio Extractor</h3>

      <button onClick={getYouTubeUrl}>Detect YouTube URL</button>

      <p>URL: {videoUrl}</p>

      <button onClick={extractAudio}>Extract Audio</button>

      {downloadUrl && (
        <a href={downloadUrl} target="_blank" download>
          <button className="download-button">Download Audio</button>
        </a>
      )}
    </div>
  );
}

export default Popup;
