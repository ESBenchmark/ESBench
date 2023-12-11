<template>
	<div :class='$style.container'>
		<select
			v-model='forward'
			:class='$style.select'
			:disabled='disabled'
		>
			<slot></slot>
		</select>
		<IconCaretDownFilled :class='$style.icon'/>
	</div>
</template>

<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { IconCaretDownFilled } from "@tabler/icons-vue";

export interface SelectProps {
	modelValue: any;
	disabled?: boolean;
}

const props = defineProps<SelectProps>();
const emit = defineEmits(["update:modelValue"]);

const forward = useVModel(props, "modelValue", emit);
</script>

<style module>
.container {
	display: block;
	position: relative;

    background: white;
	border: solid 1px rgba(0, 0, 0, 0.1);
	border-radius: 4px;
}

.select {
	appearance: none;

	width: 100%;
	padding: 5px 30px 5px 10px;
	border: none;

	font: inherit;
	background: none;

	&:not(:disabled) {
        cursor: pointer;
	}
}

.icon {
	position: absolute;
	right: 10px;
	top: 50%;
	width: 16px;

	transform: translateY(-50%);
	pointer-events: none;
}
</style>
