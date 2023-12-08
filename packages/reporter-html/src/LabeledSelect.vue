<template>
	<label :class='$style.label'>
		{{ label }}
		<SimpleSelect
			:model-value='modelValue'
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
}

defineProps<LabeledSelectProps>();
const emit = defineEmits(["update:modelValue"]);

const delegate = emit.bind(null, "update:modelValue");
</script>

<style module>
.select {
    margin-top: 5px;
}
</style>
