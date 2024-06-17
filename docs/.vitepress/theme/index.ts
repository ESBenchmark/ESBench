import DefaultTheme from "vitepress/theme";
import { Theme } from "vitepress";
import { createNotivue } from "notivue";

import "notivue/notification.css";
import "./styles.css";

const notivue = createNotivue({
	avoidDuplicates: true,
	notifications: {
		global: {
			duration: 4000,
		},
	},
});

export default <Theme>{
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.use(notivue);
	},
};
