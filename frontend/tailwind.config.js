/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // WhatsApp-inspired palette.
        wa: {
          green: '#00a884',
          darkgreen: '#008069',
          teal: '#128c7e',
          bg: '#efeae2',
          panel: '#f0f2f5',
          bubble: '#d9fdd3',
          bubbleIn: '#ffffff',
          dark: '#111b21',
          sidebar: '#ffffff',
        },
      },
      backgroundImage: {
        chat: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
