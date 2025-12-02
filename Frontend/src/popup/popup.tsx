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

  // Check authentication status on mount and periodically
  useEffect(() => {
    checkAuthStatus();
    
    // Also check every 2 seconds in case OAuth just completed
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 2000);
    
    return () => clearInterval(interval);
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
      
      // If no stored user, check backend for recently authenticated user
      try {
        // Add cache-busting to prevent 304 responses
        const latestResponse = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (latestResponse.ok || latestResponse.status === 304) {
          // Handle 304 by using cached data or retrying without cache
          let latest;
          if (latestResponse.status === 304) {
            // 304 means not modified, try again with fresh request
            const freshResponse = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
              cache: 'reload',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              }
            });
            if (freshResponse.ok) {
              latest = await freshResponse.json();
            } else {
              return; // Skip if still failing
            }
          } else {
            latest = await latestResponse.json();
          }
          
          if (latest && latest.userId && latest.email) {
            // Store user info
            localStorage.setItem("userId", latest.userId);
            localStorage.setItem("userEmail", latest.email);
            
            setUserInfo({
              email: latest.email,
              id: latest.userId,
              authenticated: true
            });
            return;
          }
        }
      } catch (latestErr) {
        console.log("Could not get latest user:", latestErr);
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
          console.log("OAuth callback detected:", changeInfo.url);
          // OAuth callback happened
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          
          // Wait for backend to process OAuth and get user info
          // Try multiple times with increasing delays to handle backend processing time
          let retryCount = 0;
          const maxRetries = 5;
          
          const tryGetAuthStatus = async () => {
            try {
              console.log(`Checking for authenticated user (attempt ${retryCount + 1}/${maxRetries})...`);
              const latestResponse = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache'
                }
              });
              
              let latest;
              if (latestResponse.status === 304) {
                // Force fresh request
                const freshResponse = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
                  cache: 'reload',
                  headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'If-None-Match': ''
                  }
                });
                if (freshResponse.ok) {
                  latest = await freshResponse.json();
                }
              } else if (latestResponse.ok) {
                latest = await latestResponse.json();
              }
              
              if (latest && latest.userId && latest.email) {
                console.log("✅ User authenticated:", latest.email);
                localStorage.setItem("userId", latest.userId);
                localStorage.setItem("userEmail", latest.email);
                await checkAuthStatus();
                setAuthLoading(false);
                try {
                  chrome.tabs.remove(authTab.id!);
                } catch (e) {
                  console.log("Tab already closed");
                }
                chrome.notifications.create({
                  type: "basic",
                  iconUrl: chrome.runtime.getURL("/vite.svg"),
                  title: "✅ Authentication Successful!",
                  message: `Logged in as ${latest.email}`
                });
                return;
              }
              
              // If no user yet, retry
              retryCount++;
              if (retryCount < maxRetries) {
                setTimeout(tryGetAuthStatus, 2000); // Wait 2 seconds before retry
              } else {
                console.log("Max retries reached, using fallback");
                await checkAuthStatusAfterOAuth();
                setAuthLoading(false);
              }
            } catch (err) {
              console.error("Error checking auth status:", err);
              retryCount++;
              if (retryCount < maxRetries) {
                setTimeout(tryGetAuthStatus, 2000);
              } else {
                await checkAuthStatusAfterOAuth();
                setAuthLoading(false);
              }
            }
          };
          
          // Start checking after 2 seconds
          setTimeout(tryGetAuthStatus, 2000);
        }
      };

      chrome.tabs.onUpdated.addListener(tabUpdateListener);
      
      // Helper function to check auth status after OAuth
      const checkAuthStatusAfterOAuth = async () => {
        try {
          console.log("Fetching latest authenticated user from backend...");
          // Get latest authenticated user from backend with cache-busting
          const latestResponse = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          console.log("Latest response status:", latestResponse.status);
          
          let latest;
          if (latestResponse.status === 304) {
            // 304 means cached, force a fresh request
            console.log("Got 304, forcing fresh request...");
            const freshResponse = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
              cache: 'reload',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'If-None-Match': ''
              }
            });
            if (freshResponse.ok) {
              latest = await freshResponse.json();
            }
          } else if (latestResponse.ok) {
            latest = await latestResponse.json();
          }
          
          console.log("Latest user data:", latest);
          
          if (latest && latest.userId && latest.email) {
            console.log("Storing user info:", latest.userId, latest.email);
            // Store user info
            localStorage.setItem("userId", latest.userId);
            localStorage.setItem("userEmail", latest.email);
            
            // Refresh auth status
            await checkAuthStatus();
            
            // Close the auth tab
            try {
              chrome.tabs.remove(authTab.id!);
            } catch (e) {
              console.log("Tab already closed");
            }
            
            // Show success notification
            chrome.notifications.create({
              type: "basic",
              iconUrl: chrome.runtime.getURL("/vite.svg"),
              title: "✅ Authentication Successful!",
              message: `Logged in as ${latest.email}`
            });
            return;
          } else {
            console.log("No user data in response, trying again in 2 seconds...");
            // Retry after 2 more seconds with fresh request
            setTimeout(async () => {
              const retryResponse = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
                cache: 'reload',
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache'
                }
              });
              if (retryResponse.ok || retryResponse.status === 304) {
                let retryData;
                if (retryResponse.status === 304) {
                  // Force fresh request
                  const freshRetry = await fetch(`${BACKEND_URL}/auth/latest?t=${Date.now()}`, {
                    cache: 'reload',
                    headers: {
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                      'If-None-Match': ''
                    }
                  });
                  if (freshRetry.ok) {
                    retryData = await freshRetry.json();
                  }
                } else {
                  retryData = await retryResponse.json();
                }
                
                if (retryData && retryData.userId && retryData.email) {
                  localStorage.setItem("userId", retryData.userId);
                  localStorage.setItem("userEmail", retryData.email);
                  await checkAuthStatus();
                  try {
                    chrome.tabs.remove(authTab.id!);
                  } catch (e) {}
                  chrome.notifications.create({
                    type: "basic",
                    iconUrl: chrome.runtime.getURL("/vite.svg"),
                    title: "✅ Authentication Successful!",
                    message: `Logged in as ${retryData.email}`
                  });
                  return;
                }
              }
              // Final fallback
              await checkAuthStatus();
              try {
                chrome.tabs.remove(authTab.id!);
              } catch (e) {}
            }, 2000);
          }
        } catch (err) {
          console.error("Error getting latest user:", err);
        }
        
        // Fallback: just refresh
        await checkAuthStatus();
        try {
          chrome.tabs.remove(authTab.id!);
        } catch (e) {}
        
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

    // Check if user is authenticated - refresh status first
    await checkAuthStatus();
    
    // Re-check after refresh (need to wait a bit for state update)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get fresh user info from localStorage as fallback
    const storedUserId = localStorage.getItem("userId");
    const storedEmail = localStorage.getItem("userEmail");
    
    const currentUserId = userInfo?.id || storedUserId;
    const currentUserEmail = userInfo?.email || storedEmail;
    
    if (!currentUserId) {
      setError("Please authenticate with Google first. Click 'Sign in with Google' button.");
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
          userId: currentUserId,
          userEmail: currentUserEmail || ""
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
            message: `Uploaded to Google Drive as ${currentUserEmail || "your account"}`
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
            <button 
              onClick={checkAuthStatus} 
              className="auth-button"
              style={{ marginTop: "8px", fontSize: "12px", padding: "6px 12px" }}
            >
              🔄 Refresh
            </button>
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
            <button 
              onClick={checkAuthStatus} 
              className="auth-button"
              style={{ marginTop: "8px", fontSize: "12px", padding: "6px 12px", backgroundColor: "#666" }}
            >
              🔄 Check Status
            </button>
          </div>
        )}
      </div>

      <button onClick={getYouTubeUrl} disabled={loading}>
        Detect YouTube URL
      </button>

      <p className="url-display">URL: {videoUrl || "No URL detected"}</p>

      <button 
        onClick={extractAudio} 
        disabled={loading || !videoUrl || (!userInfo?.authenticated && !localStorage.getItem("userId"))}
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
