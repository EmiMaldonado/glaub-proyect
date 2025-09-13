import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupConsoleErrorFiltering, setupDevelopmentErrorHelpers } from "./utils/errorFiltering";

// Initialize error filtering
setupConsoleErrorFiltering();
setupDevelopmentErrorHelpers();

createRoot(document.getElementById("root")!).render(<App />);
