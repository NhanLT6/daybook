<template>
  <div class="textarea-container">
    <div class="line-numbers">
      <span v-for="n in lineCount" :key="n">{{ n }}</span>
    </div>

    <v-textarea
      v-model="taskInput"
      variant="outlined"
      class="font-monospace"
      label="Enter tasks and subtasks"
      :error-messages="errorMessages"
      :rows="8"
      :placeholder="placeholder"
      multiple
      auto-grow
      clearable
      @update:modelValue="onChange"
    />
  </div>

  <div v-if="parsedTasks.length > 0" class="mt-4">
    <v-list>
      <v-list-subheader>Parsed Tasks:</v-list-subheader>

      <v-list-item v-for="(task, index) in parsedTasks" :key="index" :title="task.title">
        <template v-if="task.subtasks.length > 0">
          <v-list-item
            v-for="subtask in task.subtasks"
            :key="subtask.title"
            :title="subtask.title"
            class="pl-8"
            density="compact"
          >
            <template v-slot:prepend>
              <v-icon icon="mdi-minus" size="small"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { XeroProject } from '@/interfaces/XeroProject';

const taskInput = ref<string>('');
const errorMessages = ref<string[]>([]);
const parsedTasks = ref<XeroProject[]>([]);
const lineCount = ref<number>(1);

const placeholder = `Example:
Buy groceries
    Get vegetables
    Get fruits

Clean house
    Vacuum living room`;

// Validation function
const validateTaskInput = (value: string): string | true => {
  if (!value) {
    parsedTasks.value = [];
    return 'Input is required';
  }

  const lines = value.split('\n');
  let currentTask = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    if (!line.trim()) continue; // Skip empty lines

    // Check if line is indented (subtask)
    const isSubtask = line.startsWith(' ') || line.startsWith('\t');

    if (!isSubtask) {
      // Main task validation
      if (line.trim().length < 3) return `Line ${i + 1}: Main task must be at least 3 characters`;

      currentTask = line;
    } else {
      // Subtask validation
      if (!currentTask) return `Line ${i + 1}: Subtask found without a main task`;

      if (line.trim().length < 2) return `Line ${i + 1}: Subtask must be at least 2 characters`;
    }
  }

  return true;
};

const onChange = (value: string) => {
  const validationResult = validateTaskInput(value);

  errorMessages.value = validationResult === true ? [''] : [validationResult];

  if (validationResult === true) parsedTasks.value = parseInput(value);
};

// Watch text for changes and update line count accordingly
watch(taskInput, async () => {
  lineCount.value = taskInput.value.split('\n').length;
});

// Parse input into structured tasks
const parseInput = (input: string) => {
  if (!input) return [];

  const lines = input.split('\n');
  const tasks = [];
  let currentTask: XeroProject | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const isSubtask = line.startsWith(' ') || line.startsWith('\t');

    if (!isSubtask) {
      currentTask = {
        title: line.trim(),
        subtasks: [],
      };

      tasks.push(currentTask);
    } else if (currentTask) {
      currentTask.subtasks.push({ title: line.trim(), parentTask: currentTask.title } satisfies XeroSubTask);
    }
  }

  return tasks;
};
</script>

<style scoped>
.font-monospace {
  font-family: monospace !important;
}

.textarea-container {
  display: flex;
  position: relative;
}

.line-numbers {
  display: flex;
  flex-direction: column;
  padding: 1rem 10px 0 0;
  margin: 0 5px 30px 0;
  line-height: 24px; /* Adjust to match textarea line height */
  color: gray;
  text-align: right;
  width: 30px; /* Width of the line number column */
  background-color: #eeeeee;
  border-radius: 8px 0 0 8px;
}

v-textarea .v-input__control {
  padding-left: 40px; /* Offset for the line numbers column */
}
</style>
