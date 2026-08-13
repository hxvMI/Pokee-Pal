import { createContext, useContext, useState } from "react";

const CloudflareCredentialsContext = createContext(null);

export function CloudflareCredentialsProvider({ children }) {
  // Session storage intentionally keeps user-supplied credentials temporary;
  // server environment credentials remain the safer production configuration.
  const [accountId, setAccountId] = useState(
    () => sessionStorage.getItem("CLOUDFLARE_ACCOUNT_ID") || "",
  );
  const [apiToken, setApiToken] = useState(
    () => sessionStorage.getItem("CLOUDFLARE_API_TOKEN") || "",
  );

  function saveCredentials(newAccountId, newApiToken) {
    const cleanedAccountId = newAccountId.trim();
    const cleanedApiToken = newApiToken.trim();

    setAccountId(cleanedAccountId);
    setApiToken(cleanedApiToken);
    sessionStorage.setItem("CLOUDFLARE_ACCOUNT_ID", cleanedAccountId);
    sessionStorage.setItem("CLOUDFLARE_API_TOKEN", cleanedApiToken);
  }

  return (
    <CloudflareCredentialsContext.Provider value={{ accountId, apiToken, saveCredentials }}>
      {children}
    </CloudflareCredentialsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCloudflareCredentials() {
  const context = useContext(CloudflareCredentialsContext);
  if (!context) {
    throw new Error("useCloudflareCredentials must be used inside CloudflareCredentialsProvider");
  }
  return context;
}
