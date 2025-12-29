import { useState } from "react";
import "./popup.css";

function Popup() {
  const [videoUrl, setVideoUrl] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [isVideoInPlaylist, setIsVideoInPlaylist] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistProgress, setPlaylistProgress] = useState<{
    total: number;
    current: number;
    completed: number;
    failed: number;
  } | null>(null);
  const [playlistResults, setPlaylistResults] = useState<Array<{
    videoUrl: string;
    success: boolean;
    fileName?: string;
    driveWebViewLink?: string;
    error?: string;
  }>>([]);

  const detectVideoUrl = () => {
    chrome.runtime.sendMessage({ type: "GET_YT_URL" }, (response: { url?: string }) => {
      if (response?.url) {
        const url = response.url;
        const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
        const isFacebook = url.includes("facebook.com") || url.includes("fb.com") || url.includes("fb.watch");
        
        if (isYouTube || isFacebook) {
          setVideoUrl(url);
          setError("");
          setPlaylistProgress(null);
          setPlaylistResults([]);
          
          // Check if it's a direct playlist URL
          const isDirectPlaylist = url.includes("youtube.com/playlist");
          
          // Check if it's a video URL that contains a playlist parameter
          const isVideoWithPlaylist = url.includes("youtube.com/watch") && url.includes("list=");
          
          if (isDirectPlaylist) {
            setIsPlaylist(true);
            setIsVideoInPlaylist(false);
            setPlaylistUrl(url);
          } else if (isVideoWithPlaylist) {
            // Extract playlist ID from URL
            const urlObj = new URL(url);
            const listParam = urlObj.searchParams.get("list");
            if (listParam) {
              setIsPlaylist(false);
              setIsVideoInPlaylist(true);
              // Construct the full playlist URL
              const fullPlaylistUrl = `https://www.youtube.com/playlist?list=${listParam}`;
              setPlaylistUrl(fullPlaylistUrl);
            } else {
              setIsPlaylist(false);
              setIsVideoInPlaylist(false);
              setPlaylistUrl("");
            }
          } else {
            setIsPlaylist(false);
            setIsVideoInPlaylist(false);
            setPlaylistUrl("");
          }
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
    setPlaylistProgress(null);
    setPlaylistResults([]);

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

  const extractPlaylist = async () => {
    const urlToUse = playlistUrl || videoUrl;
    if (!urlToUse) {
      setError("Please detect a playlist URL first");
      return;
    }

    setPlaylistLoading(true);
    setError("");
    setPlaylistProgress(null);
    setPlaylistResults([]);

    try {
      const res = await fetch("http://localhost:5000/extract-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistUrl: urlToUse })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        setPlaylistProgress({
          total: data.totalVideos,
          current: data.totalVideos,
          completed: data.successCount,
          failed: data.failureCount
        });
        setPlaylistResults(data.results || []);
        setError("");
        
        // Show success notification
        try {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("/vite.svg"),
            title: "✅ Playlist Extraction Complete!",
            message: `Successfully processed ${data.successCount} out of ${data.totalVideos} videos.`
          });
        } catch (e) {
          console.log("Notification failed:", e);
        }
      } else {
        throw new Error(data.error || "Playlist extraction failed");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to extract playlist";
      console.error("Playlist extraction error:", errorMessage);
      setError(errorMessage);
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        setError("Cannot connect to backend server. Make sure it's running on http://localhost:5000");
      }
    } finally {
      setPlaylistLoading(false);
    }
  };

  const isYouTube = videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be"));
  const isFacebook = videoUrl && (videoUrl.includes("facebook.com") || videoUrl.includes("fb.com") || videoUrl.includes("fb.watch"));
  const platform = isYouTube ? "YouTube" : isFacebook ? "Facebook" : "Video";

  return (
    <div className="popup-container">
      <h3>Video Audio Extractor</h3>
      <p className="subtitle">YouTube & Facebook</p>

      <button onClick={detectVideoUrl} disabled={loading || playlistLoading}>
        Detect Video URL
      </button>

      <p className="url-display">
        {videoUrl ? (
          <>
            <strong>{platform}:</strong> {videoUrl.length > 50 ? videoUrl.substring(0, 50) + "..." : videoUrl}
            {isVideoInPlaylist && (
              <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
                📋 This video is part of a playlist
              </div>
            )}
          </>
        ) : (
          "No URL detected"
        )}
      </p>

      {isVideoInPlaylist ? (
        <>
          <div style={{ marginTop: "12px", marginBottom: "8px", fontSize: "13px", fontWeight: "500" }}>
            Choose extraction option:
          </div>
          <button 
            onClick={extractAudio} 
            disabled={loading || playlistLoading || !videoUrl}
            className="extract-button"
            style={{ marginBottom: "8px" }}
          >
            {loading ? "Extracting..." : "Extract Current Video Only"}
          </button>
          <button 
            onClick={extractPlaylist} 
            disabled={playlistLoading || loading || !playlistUrl}
            className="extract-button"
            style={{ backgroundColor: "#fbbc04", marginBottom: "8px" }}
          >
            {playlistLoading ? "Processing Playlist..." : "Extract Entire Playlist"}
          </button>

          {playlistProgress && (
            <div className="playlist-progress">
              <p><strong>Progress:</strong> {playlistProgress.completed} / {playlistProgress.total} completed</p>
              {playlistProgress.failed > 0 && (
                <p style={{ color: "#ea4335" }}>{playlistProgress.failed} failed</p>
              )}
            </div>
          )}

          {playlistResults.length > 0 && (
            <div className="playlist-results">
              <h4>Results:</h4>
              <div style={{ maxHeight: "200px", overflowY: "auto", fontSize: "12px" }}>
                {playlistResults.map((result, index) => (
                  <div key={index} style={{ marginBottom: "8px", padding: "4px", border: "1px solid #ddd", borderRadius: "4px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                      Video {index + 1}: {result.success ? "✅" : "❌"}
                    </div>
                    {result.success && result.driveWebViewLink && (
                      <a href={result.driveWebViewLink} target="_blank" style={{ color: "#1a73e8", fontSize: "11px" }}>
                        View in Drive
                      </a>
                    )}
                    {!result.success && (
                      <div style={{ color: "#ea4335", fontSize: "11px" }}>{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {success && !loading && (
            <div className="success-message">
              ✅ Audio extracted successfully! Ready to download.
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
        </>
      ) : isPlaylist ? (
        <>
          <button 
            onClick={extractPlaylist} 
            disabled={playlistLoading || !videoUrl}
            className="extract-button"
          >
            {playlistLoading ? "Processing Playlist..." : "Extract Playlist Audio"}
          </button>

          {playlistProgress && (
            <div className="playlist-progress">
              <p><strong>Progress:</strong> {playlistProgress.completed} / {playlistProgress.total} completed</p>
              {playlistProgress.failed > 0 && (
                <p style={{ color: "#ea4335" }}>{playlistProgress.failed} failed</p>
              )}
            </div>
          )}

          {playlistResults.length > 0 && (
            <div className="playlist-results">
              <h4>Results:</h4>
              <div style={{ maxHeight: "200px", overflowY: "auto", fontSize: "12px" }}>
                {playlistResults.map((result, index) => (
                  <div key={index} style={{ marginBottom: "8px", padding: "4px", border: "1px solid #ddd", borderRadius: "4px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                      Video {index + 1}: {result.success ? "✅" : "❌"}
                    </div>
                    {result.success && result.driveWebViewLink && (
                      <a href={result.driveWebViewLink} target="_blank" style={{ color: "#1a73e8", fontSize: "11px" }}>
                        View in Drive
                      </a>
                    )}
                    {!result.success && (
                      <div style={{ color: "#ea4335", fontSize: "11px" }}>{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
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

          {downloadUrl && !loading && (
            <div className="download-section">
              <a href={downloadUrl} target="_blank" download>
                <button className="download-button">📂 Open in Google Drive</button>
              </a>
              <p className="download-hint">This opens your uploaded WebM audio file in Google Drive</p>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
    </div>
  );
}

export default Popup;
