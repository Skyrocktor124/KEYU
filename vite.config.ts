import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const deepseekKey = env.DEEPSEEK_API_KEY || '';
    const deepseekBase = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // DeepSeek 走开发服务器代理：浏览器请求 /ds-api/*，由 Vite 附上鉴权头转发，
        // 从而绕开浏览器 CORS 限制，且 API Key 只留在本地、不会被打进前端包。
        proxy: deepseekKey
          ? {
              '/ds-api': {
                target: deepseekBase,
                changeOrigin: true,
                secure: true,
                rewrite: (p: string) => p.replace(/^\/ds-api/, ''),
                configure: (proxy: any) => {
                  proxy.on('proxyReq', (proxyReq: any) => {
                    proxyReq.setHeader('Authorization', `Bearer ${deepseekKey}`);
                  });
                },
              },
            }
          : undefined,
      },
      plugins: [react(), tailwindcss()],
      define: {
        // Gemini：SDK 直连（Google 端点允许浏览器调用），key 注入前端
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // DeepSeek：仅注入「是否已配置」的布尔标记，真正的 key 留在代理层
        'process.env.DEEPSEEK_ENABLED': JSON.stringify(deepseekKey ? '1' : ''),
        // 可选：AI_PROVIDER=deepseek|gemini 强制指定；不设则自动优先 DeepSeek
        'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || ''),
        'process.env.DEEPSEEK_MODEL': JSON.stringify(env.DEEPSEEK_MODEL || 'deepseek-chat'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
