import { useState, useEffect } from "react";
import "./popup.css";

const BACKEND_URL = "http://13.200.189.31:5000";

interface UserInfo {
  email: string;
  id: string;
  authenticated: boolean;
}

function Popup() {
  const [videoUrl, setVideoUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check localStorage for user info (set by OAuth callback page)
      const storedUserId = localStorage.getItem("userId");
      const storedEmail = localStorage.getItem("userEmail");
      
      if (storedUserId && storedEmail) {
        // Verify with backend that token is still valid
        const statusResponse = await fetch(`${BACKEND_URL}/auth/user/${storedUserId}`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.authenticated) {
            setUserInfo({
              email: storedEmail,
              id: storedUserId,
              authenticated: true
            });
            return;
          }
        }
      }
      
      // Check if OAuth just completed (from callback page)
      const oauthComplete = localStorage.getItem("oauth_complete");
      if (oauthComplete === "true") {
        const oauthUserId = localStorage.getItem("oauth_userId");
        const oauthEmail = localStorage.getItem("oauth_userEmail");
        
        if (oauthUserId && oauthEmail) {
          // Store in regular storage
          localStorage.setItem("userId", oauthUserId);
          localStorage.setItem("userEmail", oauthEmail);
          localStorage.removeItem("oauth_complete");
          localStorage.removeItem("oauth_userId");
          localStorage.removeItem("oauth_userEmail");
          
          setUserInfo({
            email: oauthEmail,
            id: oauthUserId,
            authenticated: true
          });
          return;
        }
      }
      
      setUserInfo({
        email: "",
        id: "",
        authenticated: false
      });
    } catch (err) {
      console.error("Auth check error:", err);
      setUserInfo({
        email: "",
        id: "",
        authenticated: false
      });
    }
  };

  const authenticateUser = async () => {
    setAuthLoading(true);
    setError("");

    try {
      // Get OAuth URL from backend
      const authUrlResponse = await fetch(`${BACKEND_URL}/auth/google`);
      if (!authUrlResponse.ok) {
        throw new Error("Failed to get authentication URL");
      }

      const { authUrl } = await authUrlResponse.json();

      // Open OAuth flow in a new tab
      const authTab = await chrome.tabs.create({
        url: authUrl,
        active: true
      });

      // Listen for tab updates to detect when OAuth completes
      const tabUpdateListener = (tabId: number, changeInfo: { url?: string; status?: string }) => {
        if (tabId === authTab.id && changeInfo.url?.includes("oauth2callback")) {
          // OAuth callback happened
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          
          // Wait for backend to process OAuth and get user info
          setTimeout(async () => {
            try {
              // Get latest authenticated user from backend
              await checkAuthStatusAfterOAuth();
              setAuthLoading(false);
            } catch (err) {
              // Fallback: check backend directly
              await checkAuthStatusAfterOAuth();
              setAuthLoading(false);
            }
          }, 3000);
        }
      };

      chrome.tabs.onUpdated.addListener(tabUpdateListener);
      
      // Helper function to check auth status after OAuth
      const checkAuthStatusAfterOAuth = async () => {
        try {
          // Get latest authenticated user from backend
          const latestResponse = await fetch(`${BACKEND_URL}/auth/latest`);
          if (latestResponse.ok) {
            const latest = await latestResponse.json();
            if (latest.userId && latest.email) {
              // Store user info
              localStorage.setItem("userId", latest.userId);
              localStorage.setItem("userEmail", latest.email);
              
              // Refresh auth status
              await checkAuthStatus();
              
              // Close the auth tab
              chrome.tabs.remove(authTab.id!);
              
              // Show success notification
              chrome.notifications.create({
                type: "basic",
                iconUrl: chrome.runtime.getURL("/vite.svg"),
                title: "✅ Authentication Successful!",
                message: `Logged in as ${latest.email}`
              });
              return;
            }
          }
        } catch (err) {
          console.error("Error getting latest user:", err);
        }
        
        // Fallback: just refresh
        await checkAuthStatus();
        chrome.tabs.remove(authTab.id!);
        
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("/vite.svg"),
          title: "✅ Authentication Complete!",
          message: "Please close and reopen the extension popup"
        });
      };

      // Also listen for tab removal (user closed it)
      const tabRemoveListener = (tabId: number) => {
        if (tabId === authTab.id) {
          chrome.tabs.onRemoved.removeListener(tabRemoveListener);
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          setAuthLoading(false);
        }
      };

      chrome.tabs.onRemoved.addListener(tabRemoveListener);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
      console.error("Authentication error:", err);
      setAuthLoading(false);
    }
  };

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

    // Check if user is authenticated
    if (!userInfo?.authenticated || !userInfo?.id) {
      setError("Please authenticate with Google first");
      return;
    }

    setLoading(true);
    setError("");
    setDownloadUrl("");
    setSuccess(false);

    try {
      const res = await fetch(`${BACKEND_URL}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          youtubeUrl: videoUrl,
          userId: userInfo.id,
          userEmail: userInfo.email
        })
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
            message: `Uploaded to Google Drive as ${userInfo.email}`
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
        setError("Cannot connect to backend server. Make sure it's running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="popup-container">
      <h3>YouTube Audio Extractor</h3>

      {/* Authentication Section */}
      <div className="auth-section">
        {userInfo?.authenticated ? (
          <div className="auth-status authenticated">
            <span>✅ Logged in as: {userInfo.email}</span>
          </div>
        ) : (
          <div className="auth-status not-authenticated">
            <p>🔒 Please authenticate with Google</p>
            <button 
              onClick={authenticateUser} 
              disabled={authLoading}
              className="auth-button"
            >
              {authLoading ? "Authenticating..." : "🔐 Sign in with Google"}
            </button>
          </div>
        )}
      </div>

      <button onClick={getYouTubeUrl} disabled={loading || !userInfo?.authenticated}>
        Detect YouTube URL
      </button>

      <p className="url-display">URL: {videoUrl || "No URL detected"}</p>

      <button 
        onClick={extractAudio} 
        disabled={loading || !videoUrl || !userInfo?.authenticated}
        className="extract-button"
      >
        {loading ? "Extracting..." : "Extract Audio"}
      </button>

      {success && !loading && (
        <div className="success-message">
          ✅ Audio extracted and uploaded to Google Drive!
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {downloadUrl && !loading && (
        <div className="download-section">
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <button className="download-button">📥 Open in Google Drive</button>
          </a>
          <p className="download-hint">File uploaded as: {userInfo?.email}</p>
        </div>
      )}
    </div>
  );
}

export default Popup;
