import "./App.css";

import { useEffect } from "react";
import KeyViewer from "./KeyViewer";
import SettingsView from "./SettingsView";

function App() {
  const windowType = new URLSearchParams(window.location.search).get("window");
  const isSettingsWindow = windowType === "settings";

  useEffect(() => {
    document.body.classList.toggle("window-settings", isSettingsWindow);
    document.body.classList.toggle("window-main", !isSettingsWindow);

    return () => {
      document.body.classList.remove("window-settings", "window-main");
    };
  }, [isSettingsWindow]);

  if (isSettingsWindow) return <SettingsView />;
  return <KeyViewer />;
}

export default App;
