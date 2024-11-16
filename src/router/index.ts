import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';

const router = createRouter({
  history: import.meta.env.IS_ELECTRON ? createWebHashHistory() : createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/task',
      name: 'task',
      component: () => import('../views/TaskView.vue'),
    },
    {
      path: '/setting',
      name: 'setting',
      component: async () => import('../views/SettingView.vue'),
    },
  ],
});

export default router;
