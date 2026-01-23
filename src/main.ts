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
      location: 'bottom',
    },
    // Islands theme defaults - no gutters for clean spacing control
    VRow: {
      noGutters: true,
    },
    // Islands theme defaults - rounded corners, no borders, flat appearance
    VCard: {
      rounded: 'lg',
      elevation: 0,
      flat: true,
    },
    VDialog: {
      rounded: 'lg',
    },
    VExpansionPanels: {
      rounded: 'lg',
    },
    VExpansionPanel: {
      rounded: 'lg',
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#388E3C', // green-darken-3
          secondary: '#757575', // grey-darken-1
          accent: '#7B1FA2', // purple-darken-2
          'accent-light': '#E1BEE7', // purple-lighten-4
          container: '#F5F5F5', // grey-lighten-4
          // Islands theme colors - page background darker than card surfaces
          surface: '#FFFFFF', // white surface for cards
          'page-background': '#EBEEF1',
        },
      },
      dark: {
        colors: {
          primary: '#4CAF50', // lighter green for dark mode
          secondary: '#9E9E9E', // grey
          accent: '#CE93D8', // purple-lighten-3
          'accent-light': '#4A148C', // purple-darken-4
          container: '#424242', // grey-darken-3
          // Islands theme colors - page background darker than card surfaces
          surface: '#2D2D2D', // lighter surface for cards
          'page-background': '#1E1E1E',
        },
      },
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
