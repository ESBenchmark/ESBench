import { BarController, BarElement, CategoryScale, Chart, Colors, Legend, LinearScale, Tooltip } from "chart.js";
import { BarWithErrorBarsController } from "chartjs-chart-error-bars";
import "./app.css";

Chart.register(BarWithErrorBarsController, BarController, Tooltip, Colors, CategoryScale, LinearScale, BarElement, Legend);

export { default as Page } from "./App.vue";
