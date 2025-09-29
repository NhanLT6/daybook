import './assets/main.css';

import { createApp } from 'vue';

import 'vuetify/styles';

import { createVuetify } from 'vuetify';

import { createPinia } from 'pinia';

import '@mdi/font/css/materialdesignicons.css';

import dayjs from 'dayjs';

import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Calendar, setupCalendar } from 'v-calendar';

import 'v-calendar/style.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());
app.use(router);

const vuetify = createVuetify({
  defaults: {
    VTooltip: {
      location: 'top',
    },
  },
});

app.use(vuetify);

dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(relativeTime);

// V-Calendar setup - using minimal config to avoid date rule errors
app.use(setupCalendar, {});
app.component('Calendar', Calendar);

app.mount('#app');
