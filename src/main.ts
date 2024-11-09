import './assets/main.css';

import { createApp } from 'vue';

import { createPinia } from 'pinia';

import 'vuetify/styles';

import { createVuetify } from 'vuetify';

import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { VDateInput } from 'vuetify/labs/VDateInput';
import { VNumberInput } from 'vuetify/labs/VNumberInput';

import '@mdi/font/css/materialdesignicons.css';

import dayjs from 'dayjs';

import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Calendar, setupCalendar } from 'v-calendar';

import 'v-calendar/style.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());
app.use(router);

const vuetify = createVuetify({
  components: { ...components, VDateInput, VNumberInput },
  directives,
});

app.use(vuetify);

dayjs.extend(customParseFormat);

// V-Calendar
app.use(setupCalendar, {});
app.component('Calendar', Calendar);

app.mount('#app');
