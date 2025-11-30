chrome.runtime.onMessage.addListener((
    msg: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { url?: string }) => void
) => {
    if (msg.type === "GET_YT_URL") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
            sendResponse({ url: tabs[0].url });
        });
        return true;
    }
});
