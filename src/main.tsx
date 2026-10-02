import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/index.css";
import App from "./app/App.tsx";
import { CreatureCatalog } from "./features/catalog/CreatureCatalog.tsx";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const path = window.location.pathname.replace(/\/+$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{path === `${basePath}/creatures` ? <CreatureCatalog /> : <App />}</StrictMode>,
);
