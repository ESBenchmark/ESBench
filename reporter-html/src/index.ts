import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from "chart.js";
import { BarWithErrorBarsController } from "chartjs-chart-error-bars";
import "./app.css";

Chart.register(BarWithErrorBarsController, BarController, Tooltip, CategoryScale, LinearScale, BarElement, Legend);

export { default as Page } from "./App.vue";
export { default as SuiteReport } from "./SuiteReport.vue";
