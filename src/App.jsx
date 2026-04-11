import "./App.css";

import { useEffect } from "react";
import KeyViewer from "./KeyViewer";
import SettingsView from "./SettingsView";

function App() {
  const isSettingsWindow = new URLSearchParams(window.location.search).get("window") === "settings";

  useEffect(() => {
    document.body.classList.toggle("window-settings", isSettingsWindow);
    document.body.classList.toggle("window-main", !isSettingsWindow);

    return () => {
      document.body.classList.remove("window-settings", "window-main");
    };
  }, [isSettingsWindow]);

  return isSettingsWindow ? <SettingsView /> : <KeyViewer />;
}

export default App;
