import { BarController, BarElement, CategoryScale, Chart, Colors, Legend, LinearScale, Tooltip } from "chart.js";
import "./app.css";

Chart.register(BarController, Tooltip, Colors, CategoryScale, LinearScale, BarElement, Legend);

export { default as Page } from "./App.vue";
