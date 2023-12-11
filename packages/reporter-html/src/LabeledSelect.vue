<template>
	<label :class='$style.label'>
		{{ label }}
		<SimpleSelect
			:model-value='modelValue'
			:disabled='disabled'
			:class='$style.select'
			@update:model-value='delegate'
		>
			<slot/>
		</SimpleSelect>
	</label>
</template>

<script setup lang="ts">
import SimpleSelect from "./SimpleSelect.vue";

interface LabeledSelectProps {
	label: string;
	modelValue: any;
	disabled?: boolean;
}

defineProps<LabeledSelectProps>();
const emit = defineEmits(["update:modelValue"]);

const delegate = emit.bind(null, "update:modelValue");
</script>

<style module>
.label {
	display: block;
}
.select {
    margin-top: 4px;
}
</style>
